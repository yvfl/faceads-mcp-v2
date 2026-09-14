import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, symlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root, startStdio } from '../support/mcp-client.mjs';

test('manifesto npm inclui os três guias curados', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const file of ['SKILL.md', 'PLAYBOOK.md', 'ANDROMEDA.md']) assert.ok(pkg.files.includes(file), file);
});

test('npm ci planeja instalação offline sem Puppeteer ou Turndown', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'faceads-npm-plan-'));
  try {
    for (const file of ['package.json', 'package-lock.json']) await cp(path.join(root, file), path.join(directory, file));
    const { stdout } = await promisify(execFile)('npm', ['ci', '--dry-run', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {
      cwd: directory, env: { PATH: process.env.PATH, HOME: process.env.HOME }, timeout: 15000,
    });
    assert.doesNotMatch(stdout, /^add (?:puppeteer|turndown)(?: |$)/m);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('artefato descrito pelo Dockerfile entrega todos os guias que anuncia', async () => {
  const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
  const runtime = dockerfile.split(/FROM node:[^\n]+\n/g).at(-1);
  const directory = await mkdtemp(path.join(tmpdir(), 'faceads-docker-artifact-'));
  let client;
  try {
    await cp(path.join(root, 'dist'), path.join(directory, 'dist'), { recursive: true });
    await cp(path.join(root, 'package.json'), path.join(directory, 'package.json'));
    await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    await mkdir(path.join(directory, 'docs'));
    await cp(path.join(root, 'docs/advantage-campaigns.md'), path.join(directory, 'docs/advantage-campaigns.md'));
    // Materialize root guides only if the production Dockerfile copies them.
    for (const file of ['SKILL.md', 'PLAYBOOK.md', 'ANDROMEDA.md']) {
      const copyLines = runtime.split('\n').filter(line => /^COPY\s/.test(line));
      if (copyLines.some(line => line.includes(file) || /COPY\s+(?:\.\/)?\*\.md\s/.test(line))) {
        await cp(path.join(root, file), path.join(directory, file));
      }
    }
    client = await startStdio({ directory });
    const { resources } = await client.listResources();
    const failures = [];
    for (const resource of resources.filter(r => r.uri.includes('://guides/'))) {
      try { await client.readResource({ uri: resource.uri }); }
      catch { failures.push(resource.uri); }
    }
    assert.deepEqual(failures, [], 'Guias anunciados não existem no artefato Docker');
  } finally {
    await client?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
