// Check repository rules in an isolated Git repository, independent of local excludes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewer-ignore-'));
const env = { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull };
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_CONFIG_COUNT']) delete env[key];
function git(...args) {
    return spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' });
}
try {
    const init = git('init', '-q');
    assert.equal(init.status, 0, init.stderr);
    const rules = path.join(__dirname, '.gitignore');
    if (fs.existsSync(rules)) fs.copyFileSync(rules, path.join(dir, '.gitignore'));
    const cases = [
        ['.env', true], ['.env.production.local', true], ['nested/.env.test', true],
        ['node_modules/pkg/index.js', true], ['nested/node_modules/pkg/index.js', true],
        ['.venv/bin/python', true], ['venv/bin/python', true],
        ['__pycache__/test.pyc', true], ['.pytest_cache/v/cache/nodeids', true],
        ['.mypy_cache/data', true], ['.cache/data', true], ['nested/a.pyc', true],
        ['.scratch/feature/issues/01.md', true],
        ['.claude/settings.local.json', true], ['nested/.claude/settings.local.json', true],
        ['debug.log', true], ['nested/debug.log', true], ['npm-debug.log.1', true],
        ['lyrics-display.html', false], ['README.md', false], ['scripts/tool.cjs', false],
        ['test_viewer.cjs', false], ['docs/logging.md', false], ['.claude/settings.json', false],
    ];
    let failures = 0;
    for (const [name, ignored] of cases) {
        const result = git('check-ignore', '--no-index', '-q', '--', name);
        if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr);
        const actual = result.status === 0;
        if (actual !== ignored) {
            console.error(`FAIL ${name}: expected ${ignored ? 'ignored' : 'visible'}, got ${actual ? 'ignored' : 'visible'}`);
            failures++;
        }
    }
    console.log(`${cases.length - failures}/${cases.length} ignore checks passed`);
    if (failures) process.exitCode = 1;
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}
