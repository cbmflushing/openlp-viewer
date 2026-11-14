'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const file = 'lyrics-display.html';

function git(...args) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
}
function checked(...args) {
    const result = git(...args);
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
    return result.stdout;
}
function version(text, description, allowMissing = false) {
    const declarations = [...text.matchAll(/\bconst\s+VIEWER_VERSION\b/g)];
    if (declarations.length === 0 && allowMissing) return null;
    const matches = [...text.matchAll(/\bconst\s+VIEWER_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'\s*;/g)];
    if (declarations.length !== 1 || matches.length !== 1) {
        throw new Error(`${description} must contain exactly one valid VIEWER_VERSION declaration.`);
    }
    return matches[0];
}
try {
    const normalEnv = { ...process.env };
    delete normalEnv.GIT_INDEX_FILE;
    const indexResult = spawnSync('git', ['rev-parse', '--git-path', 'index'], { encoding: 'utf8', env: normalEnv });
    if (indexResult.error || indexResult.status !== 0) throw new Error('Cannot locate the normal Git index.');
    const normalIndex = path.resolve(indexResult.stdout.trim());
    if (process.env.GIT_INDEX_FILE && path.resolve(process.env.GIT_INDEX_FILE) !== normalIndex) {
        throw new Error('Temporary or alternate Git index is unsupported; commit the staged index without path arguments.');
    }
    if (checked('ls-files', '-u', '--', file).trim()) throw new Error(`${file} has unresolved conflicts.`);
    if (!checked('ls-files', '-v', '--', file).startsWith('H ')) {
        throw new Error(`${file} must be tracked without assume-unchanged or skip-worktree flags.`);
    }
    const diff = git('diff', '--quiet', '--', file);
    if (diff.status === 1) throw new Error(`${file} has unstaged changes; stage or stash them before committing.`);
    if (diff.status !== 0) throw new Error(`Cannot inspect unstaged ${file}: ${diff.stderr.trim()}`);

    const entry = checked('ls-files', '--stage', '--', file).trim();
    const entryMatch = /^(100644|100755) ([0-9a-f]+) 0\t/.exec(entry);
    if (!entryMatch || !fs.lstatSync(file).isFile()) throw new Error(`${file} must be a tracked regular file.`);
    const workHash = checked('hash-object', `--path=${file}`, '--', file).trim();
    if (workHash !== entryMatch[2]) throw new Error(`${file} has unstaged changes; stage or stash them before committing.`);
    const staged = checked('show', `:${file}`);
    const stagedVersion = version(staged, 'Staged HTML');
    const headExists = git('rev-parse', '--verify', '--quiet', 'HEAD');
    if (headExists.status !== 0 && headExists.status !== 1) throw new Error('Cannot inspect HEAD.');
    let headVersion = null;
    if (headExists.status === 0) {
        const headFile = git('cat-file', '-e', `HEAD:${file}`);
        if (headFile.status === 0) headVersion = version(checked('show', `HEAD:${file}`), 'HEAD HTML', true);
        else if (headFile.status !== 1 && headFile.status !== 128) throw new Error('Cannot inspect HEAD HTML.');
    }
    if (!headVersion) {
        if (stagedVersion[1] !== '1' || stagedVersion[2] !== '0' || stagedVersion[3] !== '0') {
            throw new Error('The first versioned commit must introduce VIEWER_VERSION 1.0.0.');
        }
        console.log('Viewer version baseline: 1.0.0');
    } else {
        const next = `${headVersion[1]}.${BigInt(headVersion[2]) + 1n}.0`;
        const working = fs.readFileSync(file, 'utf8');
        const workVersion = version(working, 'Working HTML');
        const updated = working.slice(0, workVersion.index) + workVersion[0].replace(
            /'(\d+)\.(\d+)\.(\d+)'/, `'${next}'`
        ) + working.slice(workVersion.index + workVersion[0].length);
        fs.writeFileSync(file, updated);
        checked('add', '--', file);
        console.log(`Viewer version: ${next}`);
    }
} catch (error) {
    console.error(`Viewer version hook: ${error.message}`);
    process.exitCode = 1;
}
