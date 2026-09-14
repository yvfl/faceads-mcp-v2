import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// A small checkout guard, not a full secret scanner. It checks both the Git index
// and working-tree contents of tracked files; stage new files before running it.
// It does not inspect Git history, PRs, images via OCR or commercial data.
// Keep real validation evidence in .audit-results; public examples must be synthetic.
const credentialPatterns = [
  ['meta-access-token', /\bEAA[A-Za-z0-9]{75,}\b/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['provider-api-key', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}|sk_live_[A-Za-z0-9]{20,})\b/g],
  ['google-api-key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['signed-jwt', /\beyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{16,}\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
];

export function publicationFindings(file, content) {
  const findings = [];
  const segments = file.split('/');
  const basename = segments.at(-1);
  const environmentFile = /^\.env(?:\.|$)/.test(basename)
    && !['.env.example', '.env.test.example'].includes(basename);
  const privateArtifact = segments.includes('.audit-results')
    || segments.includes('.scrape-cache')
    || file.startsWith('audits/')
    || file === '.claude/mcp.json'
    || /^tests\/live\/.*\.local\.json$/.test(file);
  const credentialFile = /^(?:credentials|service[-_]account)(?:[._-].*)?\.json$/i.test(basename)
    || /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(basename)
    || /\.(?:key|p12|pfx)$/i.test(basename);
  if (environmentFile || privateArtifact || credentialFile) {
    findings.push({ file, line: 1, rule: 'private-file' });
  }
  for (const [rule, pattern] of credentialPatterns) {
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ file, line, rule });
    }
  }
  return findings;
}

export function checkPublication(directory = process.cwd()) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const tracked = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean).map(entry => {
    const match = entry.match(/^([0-7]{6}) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/);
    if (!match || match[3] !== '0') throw new Error('Unmerged Git index');
    return { oid: match[2], file: match[4] };
  });
  const ids = [...new Set(tracked.map(entry => entry.oid))];
  const blobs = new Map();
  if (ids.length) {
    const batch = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root, input: ids.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let offset = 0;
    for (const oid of ids) {
      const newline = batch.indexOf(10, offset);
      const header = batch.subarray(offset, newline).toString('utf8').split(' ');
      const size = Number(header[2]);
      if (header[0] !== oid || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0) {
        throw new Error('Cannot inspect Git object');
      }
      offset = newline + 1;
      if (offset + size >= batch.length) throw new Error('Incomplete Git object');
      blobs.set(oid, batch.subarray(offset, offset + size).toString('utf8'));
      offset += size + 1;
    }
  }
  const findings = [];
  for (const { file, oid } of tracked) {
    findings.push(...publicationFindings(file, blobs.get(oid)).map(f => ({ ...f, source: 'index' })));
    const absolute = path.join(root, file);
    let stat;
    try { stat = lstatSync(absolute); }
    catch (error) {
      if (error.code === 'ENOENT') continue; // Deleted working-tree files.
      throw error;
    }
    // Inspect a tracked symlink itself, never credentials outside the checkout.
    const content = stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute, 'utf8');
    if (content !== blobs.get(oid)) {
      findings.push(...publicationFindings(file, content).map(f => ({ ...f, source: 'working-tree' })));
    }
  }
  return { checkedFiles: tracked.length, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { checkedFiles, findings } = checkPublication();
    if (findings.length) {
      console.error('Publication check failed. Values are omitted; inspect these files locally:');
      for (const { file, line, rule, source } of findings) console.error(`${JSON.stringify(file)}:${line} [${rule}; ${source}]`);
      process.exitCode = 1;
    } else {
      console.log(`Publication check passed for ${checkedFiles} tracked files (Git index and working tree).`);
    }
  } catch {
    // Git or filesystem errors may contain sensitive paths or content; do not echo them.
    console.error('Publication check could not inspect the checkout. Run it inside a readable Git repository.');
    process.exitCode = 1;
  }
}
