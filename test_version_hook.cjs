'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = path.join(__dirname, 'scripts');
const html = 'lyrics-display.html';
function run(cwd, command, args, ok = true) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
    if (ok) assert.equal(result.status, 0, `${command} ${args.join(' ')}: ${result.stderr || result.error}`);
    return result;
}
function git(dir, ...args) { return run(dir, 'git', args); }
function setup(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewer-hook-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'user.email', 'test@example.com');
    fs.cpSync(source, path.join(dir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(dir, html), '<script>\r\n// old viewer\r\n</script>\r\n');
    git(dir, 'add', html);
    git(dir, 'commit', '-qm', 'old viewer');
    return dir;
}
function install(dir, ok = true) { return run(dir, process.execPath, ['scripts/install-version-hook.cjs'], ok); }
function contents(version, extra = '') { return `<script>\r\nconst VIEWER_VERSION = '${version}';\r\n${extra}</script>\r\n`; }
function write(dir, name, data) { fs.writeFileSync(path.join(dir, name), data); }
function show(dir, ref) { return git(dir, 'show', `${ref}:${html}`).stdout; }
function bootstrap(dir) {
    install(dir);
    write(dir, html, contents('1.0.0'));
    git(dir, 'add', html);
    git(dir, 'commit', '-qm', 'introduce version');
    assert.equal(show(dir, 'HEAD'), contents('1.0.0'));
}

test('bootstrap, successive HTML and non-HTML commits increment from HEAD', t => {
    const dir = setup(t);
    bootstrap(dir);
    write(dir, html, contents('1.0.0', '// change\r\n'));
    git(dir, 'add', html);
    git(dir, 'commit', '-qm', 'html');
    assert.equal(show(dir, 'HEAD'), contents('1.1.0', '// change\r\n'));
    write(dir, 'other.txt', 'other');
    git(dir, 'add', 'other.txt');
    git(dir, 'commit', '-qm', 'other');
    assert.equal(show(dir, 'HEAD'), contents('1.2.0', '// change\r\n'));
    assert.equal(fs.readFileSync(path.join(dir, html), 'utf8'), show(dir, 'HEAD'));
});

test('failed commit retry derives the same version from HEAD', t => {
    const dir = setup(t);
    bootstrap(dir);
    write(dir, '.git/hooks/commit-msg', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(dir, '.git/hooks/commit-msg'), 0o755);
    write(dir, 'other.txt', 'other');
    git(dir, 'add', 'other.txt');
    assert.notEqual(run(dir, 'git', ['commit', '-qm', 'fails'], false).status, 0);
    assert.equal(show(dir, ''), contents('1.1.0')); // staged blob
    assert.notEqual(run(dir, 'git', ['commit', '-qm', 'fails again'], false).status, 0);
    assert.equal(show(dir, ''), contents('1.1.0'));
    fs.unlinkSync(path.join(dir, '.git/hooks/commit-msg'));
    git(dir, 'commit', '-qm', 'retry');
    assert.equal(show(dir, 'HEAD'), contents('1.1.0'));
});

test('rejects partially staged HTML without changing index or working file', t => {
    const dir = setup(t);
    bootstrap(dir);
    const staged = contents('1.0.0', '// staged\r\n');
    const working = contents('1.0.0', '// staged\r\n// unstaged\r\n');
    write(dir, html, staged);
    git(dir, 'add', html);
    write(dir, html, working);
    const result = run(dir, 'git', ['commit', '-qm', 'unsafe'], false);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unstaged/i);
    assert.equal(show(dir, ''), staged);
    assert.equal(fs.readFileSync(path.join(dir, html), 'utf8'), working);
});

test('rejects unmerged HTML without changing conflict entries', t => {
    const dir = setup(t);
    bootstrap(dir);
    const hash = git(dir, 'hash-object', '-w', html).stdout.trim();
    git(dir, 'update-index', '--force-remove', html);
    const result = spawnSync('git', ['update-index', '--index-info'], {
        cwd: dir, encoding: 'utf8', input: `100644 ${hash} 1\t${html}\n100644 ${hash} 2\t${html}\n100644 ${hash} 3\t${html}\n`
    });
    assert.equal(result.status, 0, result.stderr);
    const before = git(dir, 'ls-files', '-u', '--', html).stdout;
    assert.notEqual(run(dir, 'git', ['commit', '-qm', 'conflict'], false).status, 0);
    assert.equal(git(dir, 'ls-files', '-u', '--', html).stdout, before);
});

test('installation is repeatable and refuses existing hooks and core.hooksPath', t => {
    const dir = setup(t);
    const hook = path.join(dir, '.git/hooks/pre-commit');
    write(dir, '.git/hooks/pre-commit', '#!/bin/sh\necho existing\n');
    assert.notEqual(install(dir, false).status, 0);
    assert.equal(fs.readFileSync(hook, 'utf8'), '#!/bin/sh\necho existing\n');
    fs.unlinkSync(hook);
    git(dir, 'config', 'core.hooksPath', '.custom-hooks');
    assert.notEqual(install(dir, false).status, 0);
    assert.equal(fs.existsSync(hook), false);
    git(dir, 'config', '--unset', 'core.hooksPath');
    install(dir);
    const installed = fs.readFileSync(hook, 'utf8');
    install(dir);
    assert.equal(fs.readFileSync(hook, 'utf8'), installed);
});

test('unstaged HTML on an unrelated commit is refused, even when marked assume-unchanged', t => {
    const dir = setup(t);
    bootstrap(dir);
    git(dir, 'update-index', '--assume-unchanged', html);
    const working = contents('1.0.0', '// private unstaged\r\n');
    write(dir, html, working);
    write(dir, 'other.txt', 'staged');
    git(dir, 'add', 'other.txt');
    const result = run(dir, 'git', ['commit', '-qm', 'unsafe'], false);
    assert.notEqual(result.status, 0);
    assert.equal(show(dir, ''), contents('1.0.0'));
    assert.equal(fs.readFileSync(path.join(dir, html), 'utf8'), working);
    assert.equal(git(dir, 'show', ':other.txt').stdout, 'staged');
});

test('refuses assume-unchanged and skip-worktree even when HTML is clean', t => {
    for (const flag of ['--assume-unchanged', '--skip-worktree']) {
        const dir = setup(t);
        bootstrap(dir);
        git(dir, 'update-index', flag, html);
        write(dir, 'other.txt', 'staged');
        git(dir, 'add', 'other.txt');
        assert.notEqual(run(dir, 'git', ['commit', '-qm', 'unsafe'], false).status, 0);
        assert.equal(show(dir, ''), contents('1.0.0'));
        assert.equal(fs.readFileSync(path.join(dir, html), 'utf8'), contents('1.0.0'));
    }
});

test('path-limited commits are refused without changing the real index or HTML', t => {
    const dir = setup(t);
    bootstrap(dir);
    write(dir, 'other.txt', 'other');
    git(dir, 'add', 'other.txt');
    const result = run(dir, 'git', ['commit', '-qm', 'path commit', '--', 'other.txt'], false);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /index/i);
    assert.equal(show(dir, ''), contents('1.0.0'));
    assert.equal(fs.readFileSync(path.join(dir, html), 'utf8'), contents('1.0.0'));
});

test('patch is reset and staged unrelated changes are retained', t => {
    const dir = setup(t);
    install(dir);
    write(dir, html, contents('4.7.9'));
    git(dir, 'add', html);
    git(dir, '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'existing version');
    write(dir, 'other.txt', 'included');
    git(dir, 'add', 'other.txt');
    git(dir, 'commit', '-qm', 'bump');
    assert.equal(show(dir, 'HEAD'), contents('4.8.0'));
    assert.equal(git(dir, 'show', 'HEAD:other.txt').stdout, 'included');
});

test('bootstrap requires exactly one staged baseline declaration', t => {
    const dir = setup(t);
    install(dir);
    write(dir, html, contents('1.2.0'));
    git(dir, 'add', html);
    assert.notEqual(run(dir, 'git', ['commit', '-qm', 'wrong baseline'], false).status, 0);
    assert.equal(show(dir, ''), contents('1.2.0'));
    write(dir, html, contents('1.0.0', "const VIEWER_VERSION = '1.0.0';\r\n"));
    git(dir, 'add', html);
    assert.notEqual(run(dir, 'git', ['commit', '-qm', 'duplicate'], false).status, 0);
});
