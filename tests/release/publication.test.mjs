import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationFindings } from '../../scripts/check-publication.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = path.join(root, 'scripts/check-publication.mjs');

function repository(t) {
  const parent = path.join(root, '.audit-results/publication-guard-tests');
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, 'repo-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: directory });
  return directory;
}

test('private configuration and real audit artifacts are rejected even without recognizable tokens', () => {
  for (const file of [
    '.env', '.env.production', '.env.staging', '.env.backup', 'nested/.env.local',
    '.audit-results/run.json', 'audits/report.md', '.claude/mcp.json',
    'tests/live/account.local.json', '.scrape-cache/response.json',
    'credentials.json', 'service-account.production.json', 'id_ed25519', 'connection.p12', 'server.key',
  ]) {
    assert.ok(publicationFindings(file, 'private data').some(f => f.rule === 'private-file'), file);
  }
  for (const file of ['.env.example', '.env.test.example', 'tests/live/account.example.json', 'audit/review.md']) {
    assert.deepEqual(publicationFindings(file, 'TOKEN=<YOUR_TOKEN>'), [], file);
  }
});

test('recognizable credentials are rejected without including values in findings', () => {
  const samples = [
    ['meta-access-token', 'EAA' + 'x'.repeat(80)],
    ['github-token', 'ghp_' + 'x'.repeat(36)],
    ['github-token', 'github_pat_' + 'x'.repeat(60)],
    ['slack-token', 'xoxb-' + '1'.repeat(12) + '-' + 'a'.repeat(24)],
    ['provider-api-key', 'sk-proj-' + 'a'.repeat(48)],
    ['google-api-key', 'AIza' + 'a'.repeat(35)],
    ['aws-access-key', 'AKIA' + 'A'.repeat(16)],
    ['signed-jwt', 'eyJ' + 'a'.repeat(12) + '.eyJ' + 'b'.repeat(12) + '.' + 'c'.repeat(32)],
    ['private-key', '-----BEGIN ' + 'PRIVATE KEY-----\nsynthetic'],
  ];
  for (const [rule, sample] of samples) {
    const findings = publicationFindings('.env.example', `# example\nTOKEN=${sample}`);
    assert.ok(findings.some(f => f.rule === rule && f.line === 2), rule);
    assert.ok(!JSON.stringify(findings).includes(sample), 'findings must omit matched credentials');
  }
});

test('public IDs, placeholders and local-only test database URLs do not become false positives', () => {
  assert.deepEqual(publicationFindings('docs/example.md', [
    'act_123456789012345', 'https://graph.facebook.com/v26.0/123456789012345',
    '<YOUR_META_ACCESS_TOKEN>', '${META_ACCESS_TOKEN}',
    'postgresql://test:local_test_only@127.0.0.1:5432/test',
  ].join('\n')), []);
});

test('CLI rejects tracked secret content, emits only locations and ignores untracked local files', t => {
  const directory = repository(t);
  const token = 'EAA' + 'x'.repeat(80);
  writeFileSync(path.join(directory, 'example.md'), `# example\n${token}\n`);
  writeFileSync(path.join(directory, '.env'), 'private local configuration');
  execFileSync('git', ['add', 'example.md'], { cwd: directory });
  const failed = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /"example\.md":2 \[meta-access-token; index\]/);
  assert.ok(!failed.stderr.includes(token));
  assert.ok(!failed.stdout.includes(token));
  writeFileSync(path.join(directory, 'example.md'), '<YOUR_META_ACCESS_TOKEN>\n');
  const stagedSecret = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(stagedSecret.status, 1, 'a safe working tree must not hide a staged credential');
  execFileSync('git', ['add', 'example.md'], { cwd: directory });
  const passed = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(passed.status, 0, passed.stderr);
  writeFileSync(path.join(directory, 'example.md'), token);
  const workingSecret = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(workingSecret.status, 1, 'a safe index must not hide a working-tree credential');
  assert.match(workingSecret.stderr, /meta-access-token; working-tree/);
  writeFileSync(path.join(directory, 'example.md'), '<YOUR_META_ACCESS_TOKEN>\n');
  execFileSync('git', ['add', '.env'], { cwd: directory });
  const privateFile = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(privateFile.status, 1);
  assert.match(privateFile.stderr, /"\.env":1 \[private-file; index\]/);
});

test('tracked symlinks are not followed into local credential files', t => {
  const directory = repository(t);
  writeFileSync(path.join(directory, '.env'), 'EAA' + 'x'.repeat(80));
  symlinkSync('.env', path.join(directory, 'example-link'));
  execFileSync('git', ['add', 'example-link'], { cwd: directory });
  const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('gitignore protects environment variants while allowing safe example templates', t => {
  const directory = repository(t);
  writeFileSync(path.join(directory, '.gitignore'), readFileSync(path.join(root, '.gitignore')));
  for (const file of [
    '.env', '.env.production', '.env.staging', '.env.backup', '.env.test', '.env.local',
    '.env.production.local', 'nested/.env.production', '.audit-results/report.json',
    'audits/report.md', 'tests/live/account.local.json', '.claude/mcp.json',
  ]) {
    const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', file], { cwd: directory });
    assert.equal(result.status, 0, file);
  }
  for (const file of ['.env.example', '.env.test.example', 'tests/live/account.example.json']) {
    const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', file], { cwd: directory });
    assert.equal(result.status, 1, file);
  }
});
