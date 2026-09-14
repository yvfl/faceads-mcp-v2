import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { OperationRecord, OperationStore } from './types.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uncertain = (record: OperationRecord) => record.status === 'pending' || record.status === 'unknown';

/** Durable stdio journal. A crash while holding a lock fails closed until inspected locally. */
export class FileOperationStore implements OperationStore {
  constructor(private readonly directory = resolve(process.cwd(), '.audit-results/operations')) {}

  private async ownerDirectory(ownerHash: string): Promise<string> {
    const directory = join(this.directory, digest(ownerHash));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    return directory;
  }
  private filename(record: Pick<OperationRecord, 'requestId' | 'ordinal'>): string {
    return `${digest(record.requestId)}.${record.ordinal}.json`;
  }
  private async read(path: string): Promise<OperationRecord | null> {
    try { return JSON.parse(await readFile(path, 'utf8')) as OperationRecord; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  private async save(directory: string, name: string, value: unknown): Promise<void> {
    const temporary = join(directory, `.tmp-${randomUUID()}`);
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, join(directory, name));
    const directoryHandle = await open(directory, 'r');
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  }
  private async locked<T>(directory: string, fingerprint: string, execute: () => Promise<T>): Promise<T> {
    const lock = join(directory, `.lock-${fingerprint}`);
    let acquired = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    if (!acquired) throw new Error('Journal de operações ocupado ou interrompido. Nenhuma nova escrita foi enviada; inspecione o journal local antes de recuperar a trava.');
    try { return await execute(); } finally { await rmdir(lock); }
  }
  async reserve(record: OperationRecord): Promise<{ created: boolean; record: OperationRecord }> {
    const directory = await this.ownerDirectory(record.ownerHash);
    // Request lock also serializes different payloads trying to reuse one request ID.
    return this.locked(directory, `request-${digest(record.requestId)}`, () => this.locked(directory, record.fingerprint, async () => {
      const existing = await this.read(join(directory, this.filename(record)));
      if (existing) return { created: false, record: existing };
      const indexName = `fingerprint-${record.fingerprint}.json`;
      const previous = await this.read(join(directory, indexName));
      if (previous) {
        const current = await this.read(join(directory, this.filename(previous)));
        if (!current || uncertain(current)) return { created: false, record: current ?? previous };
      }
      // Both writes are durable before dispatch. A crash before the index cannot
      // have sent a mutation, and the request record remains inspectable.
      await this.save(directory, this.filename(record), record);
      await this.save(directory, indexName, record);
      return { created: true, record };
    }));
  }
  async finish(record: OperationRecord): Promise<void> {
    const directory = await this.ownerDirectory(record.ownerHash);
    await this.locked(directory, record.fingerprint, () => this.save(directory, this.filename(record), record));
  }
  async list(ownerHash: string, requestId: string): Promise<OperationRecord[]> {
    const directory = await this.ownerDirectory(ownerHash);
    const prefix = `${digest(requestId)}.`;
    const files = (await readdir(directory)).filter(file => file.startsWith(prefix) && file.endsWith('.json'));
    const records = await Promise.all(files.map(file => this.read(join(directory, file))));
    return records.filter((record): record is OperationRecord => record !== null).sort((a, b) => a.ordinal - b.ordinal);
  }
}

/** Uses the application's PostgreSQL pool. The advisory lock is transaction scoped. */
export class PostgresOperationStore implements OperationStore {
  async reserve(record: OperationRecord): Promise<{ created: boolean; record: OperationRecord }> {
    const { getPrisma } = await import('../db/prisma.js');
    return getPrisma().$transaction(async tx => {
      // A consistent lock order avoids deadlocks across simultaneous idempotency conflicts.
      const locks = [`request:${record.ownerHash}:${record.requestId}`, `fingerprint:${record.ownerHash}:${record.fingerprint}`].sort();
      for (const lock of locks) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text`;
      const existing = await tx.adsOperation.findUnique({ where: { key: record.key } });
      if (existing) return { created: false, record: existing.record as unknown as OperationRecord };
      const blocked = await tx.adsOperation.findFirst({ where: { ownerHash: record.ownerHash, fingerprint: record.fingerprint, status: { in: ['pending', 'unknown'] } } });
      if (blocked) return { created: false, record: blocked.record as unknown as OperationRecord };
      await tx.adsOperation.create({ data: { key: record.key, ownerHash: record.ownerHash, requestId: record.requestId, fingerprint: record.fingerprint, status: record.status, record: JSON.parse(JSON.stringify(record)) } });
      return { created: true, record };
    });
  }
  async finish(record: OperationRecord): Promise<void> {
    const { getPrisma } = await import('../db/prisma.js');
    await getPrisma().adsOperation.update({ where: { key: record.key }, data: { status: record.status, record: JSON.parse(JSON.stringify(record)) } });
  }
  async list(ownerHash: string, requestId: string): Promise<OperationRecord[]> {
    const { getPrisma } = await import('../db/prisma.js');
    return (await getPrisma().adsOperation.findMany({ where: { ownerHash, requestId } })).map(row => row.record as unknown as OperationRecord).sort((a, b) => a.ordinal - b.ordinal);
  }
}
