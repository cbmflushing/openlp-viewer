const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const workflow = '.github/workflows/viewer-pages.yml';

test('Pages workflow deploys only main with scoped permissions and pinned official actions', () => {
  const y = readFileSync(workflow, 'utf8');
  assert.match(y, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(y, /workflow_dispatch:/);
  assert.match(y, /if:\s*\$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(y, /group:\s*pages/);
  assert.match(y, /cancel-in-progress:\s*false/);
  assert.match(y, /contents:\s*read/);
  assert.match(y, /pages:\s*write/);
  assert.match(y, /id-token:\s*write/);
  assert.doesNotMatch(y, /contents:\s*write/);
  for (const action of ['checkout', 'configure-pages', 'upload-pages-artifact', 'deploy-pages']) {
    assert.match(y, new RegExp(`actions/${action}@[0-9a-f]{40}`));
  }
  assert.match(y, /ref:\s*\$\{\{ github\.sha \}\}/);
  assert.match(y, /persist-credentials:\s*false/);
  assert.match(y, /name:\s*github-pages/);
  assert.match(y, /path:\s*\$\{\{ steps\.prepare\.outputs\.path \}\}/);
});

test('artifact preparation copies only the unchanged standalone page as index.html', () => {
  const y = readFileSync(workflow, 'utf8');
  const match = y.match(/      - name: Prepare Pages artifact\n        id: prepare\n        run: \|\n((?:          .+\n)+)/);
  assert.ok(match, 'preparation script exists');
  const script = match[1].replace(/^          /gm, '');
  const dir = mkdtempSync(join(tmpdir(), 'viewer-pages-test-'));
  try {
    const workspace = join(dir, 'workspace');
    const runner = join(dir, 'runner');
    mkdirSync(workspace); mkdirSync(runner);
    const html = Buffer.from('<!doctype html>\r\nViewer\r\n');
    writeFileSync(join(workspace, 'lyrics-display.html'), html);
    writeFileSync(join(workspace, 'private.txt'), 'not for publishing');
    const output = join(dir, 'output');
    const result = spawnSync('bash', ['-e', '-c', script], {
      cwd: workspace, encoding: 'utf8', env: {...process.env, RUNNER_TEMP: runner, GITHUB_OUTPUT: output},
    });
    assert.equal(result.status, 0, result.stderr);
    const entry = readFileSync(output, 'utf8').trim();
    assert.match(entry, /^path=/);
    const artifact = entry.slice(5);
    assert.deepEqual(readdirSync(artifact), ['index.html']);
    assert.deepEqual(readFileSync(join(artifact, 'index.html')), html);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
