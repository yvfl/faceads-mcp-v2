import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const textOf = result => (result?.content ?? []).map(part => part.text ?? '').join('\n');

export function cleanEnv(extra = {}) {
  // Deliberately do not inherit credentials, DATABASE_URL or NODE_OPTIONS.
  return {
    PATH: process.env.PATH ?? '',
    META_ACCESS_TOKEN: 'offline-test-fake-token',
    META_API_VERSION: 'v26.0',
    DATABASE_URL: '',
    ...extra,
  };
}

export async function startStdio({ directory = root, offline = true, env = {} } = {}) {
  const args = offline ? ['--import', fileURLToPath(new URL('./deny-network.mjs', import.meta.url))] : [];
  args.push(path.join(directory, 'dist/index.js'));
  const transport = new StdioClientTransport({
    command: process.execPath, args, cwd: directory,
    env: cleanEnv(env), stderr: 'pipe',
  });
  // Consume stderr without persisting tool arguments or account information.
  transport.stderr?.on('data', () => {});
  const client = new Client({ name: 'faceads-audit', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 15000 });
    return client;
  } catch (error) {
    await transport.close();
    throw error;
  }
}
