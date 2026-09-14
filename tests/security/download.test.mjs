import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import https from 'node:https';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { isPublicAddress, parsePublicImageUrl, downloadPublicImage } from '../../dist/utils/safe-download.js';

test('public image addresses reject reserved IPv4, private IPv6 and mapped/translation ranges', () => {
  for (const value of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) assert.equal(isPublicAddress(value), true, value);
  for (const value of ['0.1.2.3','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.4.5','192.168.1.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','64:ff9b::7f00:1','fe80::1','fc00::1','2001:db8::1','2002:7f00:1::1','3fff::1','not-an-ip']) assert.equal(isPublicAddress(value), false, value);
});
test('URL normalization closes decimal, hex and shorthand loopback bypasses', () => {
  assert.equal(parsePublicImageUrl('https://cdn.example/image.png').hostname, 'cdn.example');
  for (const value of ['http://2130706433/x', 'http://0x7f000001/x', 'http://127.1/x', 'http://[::ffff:127.0.0.1]/x', 'file:///etc/passwd', 'ftp://example.com/x', 'https://name:password@example.com/x', 'https://example.com:8443/x']) assert.throws(() => parsePublicImageUrl(value), undefined, value);
});
async function withNetworkMock({ dnsAnswers = () => [{ address: '93.184.216.34', family: 4 }], replies = [] }, callback) {
  const originalLookup = dns.promises.lookup; const originalHttps = https.request; const originalHttp = http.request;
  const requests = []; const lookups = [];
  dns.promises.lookup = async hostname => { lookups.push(hostname); return dnsAnswers(hostname, lookups.length); };
  const mockRequest = (url, options, onResponse) => {
    requests.push({ url, options });
    const request = new EventEmitter();
    request.end = () => {
      const reply = replies[requests.length - 1] || { body: Buffer.from('image-data') };
      const response = Readable.from(reply.chunks || [reply.body || Buffer.from('image-data')]);
      response.statusCode = reply.status || 200;
      response.headers = { 'content-type': 'image/png', ...reply.headers };
      queueMicrotask(() => onResponse(response));
    };
    return request;
  };
  https.request = mockRequest; http.request = mockRequest;
  try { await callback({ requests, lookups }); }
  finally { dns.promises.lookup = originalLookup; https.request = originalHttps; http.request = originalHttp; }
}
test('download pins the socket to validated DNS answers and sends no credentials', async () => {
  await withNetworkMock({ replies: [{ body: Buffer.from('png-content') }] }, async ({ requests, lookups }) => {
    const bytes = await downloadPublicImage('https://cdn.example/file.png');
    assert.equal(bytes.toString(), 'png-content'); assert.deepEqual(lookups, ['cdn.example']);
    const options = requests[0].options;
    assert.equal(options.method, 'GET'); assert.equal(options.agent, false); assert.equal(options.headers.Authorization, undefined);
    await new Promise(resolve => options.lookup('cdn.example', {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4); resolve(); }));
    await new Promise(resolve => options.lookup('cdn.example', { all: true }, (error, addresses) => { assert.equal(error, null); assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]); resolve(); }));
    assert.deepEqual(lookups, ['cdn.example'], 'Pinned lookup never resolves DNS a second time');
  });
});
test('mixed public/private DNS answers are rejected before connecting', async () => {
  await withNetworkMock({ dnsAnswers: () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }] }, async ({ requests }) => {
    await assert.rejects(() => downloadPublicImage('https://cdn.example/image.png'), /privada/);
    assert.equal(requests.length, 0);
  });
});
test('redirect to private metadata address is blocked before the second request', async () => {
  await withNetworkMock({ replies: [{ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }] }, async ({ requests }) => {
    await assert.rejects(() => downloadPublicImage('https://cdn.example/image.png'), /privadas/);
    assert.equal(requests.length, 1);
  });
});
test('redirect destinations get independent DNS validation including rebinding', async () => {
  await withNetworkMock({ dnsAnswers: (_host, count) => [{ address: count === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }], replies: [{ status: 302, headers: { location: '/other.png' } }] }, async ({ requests, lookups }) => {
    await assert.rejects(() => downloadPublicImage('https://cdn.example/image.png'), /privada/);
    assert.equal(requests.length, 1); assert.equal(lookups.length, 2);
  });
});
test('non-images, SVG, oversized declared bodies and oversized streams are rejected', async () => {
  for (const reply of [{ headers: { 'content-type': 'text/html' } }, { headers: { 'content-type': 'image/svg+xml' } }, { headers: { 'content-length': String(11 * 1024 * 1024) } }, { chunks: [Buffer.alloc(6 * 1024 * 1024), Buffer.alloc(5 * 1024 * 1024)] }]) {
    await withNetworkMock({ replies: [reply] }, async () => { await assert.rejects(() => downloadPublicImage('https://cdn.example/image.png')); });
  }
});
test('redirect loops have a finite request budget', async () => {
  const reply = { status: 302, headers: { location: '/again.png' } };
  await withNetworkMock({ replies: [reply, reply, reply, reply] }, async ({ requests }) => {
    await assert.rejects(() => downloadPublicImage('https://cdn.example/image.png'), /muitas vezes/);
    assert.equal(requests.length, 4);
  });
});
