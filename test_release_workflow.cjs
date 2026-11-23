const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const helper = resolve('scripts/publish-viewer-release.sh');
const stub = `#!/usr/bin/env node
const fs = require('fs');
const p = process.env.STUB_STATE;
const s = JSON.parse(fs.readFileSync(p));
const args = process.argv.slice(2);
s.calls.push(args);
function save() { fs.writeFileSync(p, JSON.stringify(s)); }
function fail() { save(); process.exit(1); }
if (args[0] === 'api' && args.includes('--slurp')) {
  if (s.failList) fail();
  console.log(JSON.stringify([s.release ? [{tag_name: 'viewer-' + process.env.GITHUB_RUN_ID, ...s.release}] : []]));
} else if (args[0] === 'api' && args[1].includes('/git/matching-refs/tags/')) {
  console.log(JSON.stringify(s.sha ? [{ref: 'refs/tags/viewer-' + process.env.GITHUB_RUN_ID, object: {type: 'commit', sha: s.sha}}] : []));
} else if (args[0] === 'api' && args[1].includes('/git/ref/tags/')) {
  if (!s.sha && (!s.release || s.release.draft)) fail();
  console.log(JSON.stringify({object: {type: 'commit', sha: s.sha || s.release.target_commitish || process.env.GITHUB_SHA}}));
} else if (args[0] === 'release' && args[1] === 'create') {
  if (s.failCreate || s.release) fail();
  s.release = {draft: true, assets: [], name: args[args.indexOf('--title') + 1], target_commitish: args[args.indexOf('--target') + 1]};
} else if (args[0] === 'release' && args[1] === 'upload') {
  if (s.failUpload) fail();
  s.uploaded = fs.readFileSync(args[3], 'base64');
  s.release.assets = [{name: args[3], state: 'uploaded'}];
} else if (args[0] === 'release' && args[1] === 'edit') {
  s.release.draft = false;
} else fail();
save();
`;
function fixture(initial = {}, runId = '123') {
  const dir = mkdtempSync(join(tmpdir(), 'viewer-release-'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/gh'), stub);
  chmodSync(join(dir, 'bin/gh'), 0o755);
  writeFileSync(join(dir, 'lyrics-display.html'), "        const VIEWER_VERSION = '1.2.3';\r\ncontent\r\n");
  const state = join(dir, 'state.json');
  writeFileSync(state, JSON.stringify({calls: [], ...initial}));
  const run = () => spawnSync('bash', [helper], {cwd: dir, encoding: 'utf8', env: {...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH, STUB_STATE: state, GITHUB_REPOSITORY: 'example/viewer', GITHUB_RUN_ID: runId, GITHUB_SHA: 'abc123'}});
  return {run, state: () => JSON.parse(readFileSync(state)), close: () => rmSync(dir, {recursive: true, force: true})};
}

test('workflow runs on every main push with least checkout persistence', () => {
  const y = readFileSync('.github/workflows/viewer-release.yml', 'utf8');
  assert.match(y, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.doesNotMatch(y, /paths:|cancel-in-progress:/);
  assert.match(y, /contents:\s*write/);
  assert.match(y, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(y, /ref:\s*\$\{\{ github.sha \}\}/);
  assert.match(y, /persist-credentials:\s*false/);
  assert.match(y, /GH_TOKEN:\s*\$\{\{ github.token \}\}/);
});

test('creates a draft for the run SHA, uploads unchanged asset, publishes, and reruns safely', () => {
  const f = fixture();
  try {
    let r = f.run(); assert.equal(r.status, 0, r.stderr);
    let s = f.state();
    const create = s.calls.find(c => c[1] === 'create');
    assert.deepEqual(create, ['release', 'create', 'viewer-123', '--target', 'abc123', '--title', 'Viewer v1.2.3', '--draft']);
    assert.ok(s.calls.some(c => c[1] === 'upload' && c[3] === 'lyrics-display.html'));
    assert.equal(Buffer.from(s.uploaded, 'base64').toString(), "        const VIEWER_VERSION = '1.2.3';\r\ncontent\r\n");
    assert.equal(s.release.draft, false);
    const n = s.calls.length;
    r = f.run(); assert.equal(r.status, 0, r.stderr);
    assert.ok(f.state().calls.slice(n).every(c => c[0] === 'api'));
  } finally { f.close(); }
});

test('recovers a draft, but rejects incomplete published releases and wrong tags', () => {
  for (const [initial, success] of [
    [{release: {draft: true, assets: [], name: 'Viewer v1.2.3', target_commitish: 'abc123'}}, true],
    [{release: {draft: false, assets: [], name: 'Viewer v1.2.3'}}, false],
    [{release: {draft: false, name: 'Viewer v1.2.3', assets: [{name: 'lyrics-display.html', state: 'uploaded'}]}, sha: 'wrong'}, false],
    [{failCreate: true}, false],
    [{failUpload: true}, false],
    [{failList: true}, false],
  ]) {
    const f = fixture(initial);
    try { const r = f.run(); assert.equal(r.status === 0, success, r.stderr); }
    finally { f.close(); }
  }
});

test('a draft with a wrong target or existing tag is never uploaded or published', () => {
  for (const [target_commitish, sha] of [['wrong', undefined], ['abc123', 'wrong']]) {
    const f = fixture({release: {draft: true, assets: [], name: 'Viewer v1.2.3', target_commitish}, sha});
    try {
      assert.notEqual(f.run().status, 0);
      assert.equal(f.state().release.draft, true);
      assert.ok(f.state().calls.every(c => c[0] === 'api'));
    } finally { f.close(); }
  }
});

test('another push of the same viewer version uses a different release tag', () => {
  const f = fixture({}, '124');
  try {
    const r = f.run(); assert.equal(r.status, 0, r.stderr);
    const create = f.state().calls.find(c => c[1] === 'create');
    assert.deepEqual(create.slice(2), ['viewer-124', '--target', 'abc123', '--title', 'Viewer v1.2.3', '--draft']);
  } finally { f.close(); }
});
