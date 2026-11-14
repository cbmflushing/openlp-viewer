'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hook = '#!/bin/sh\n# OpenLP viewer version hook (managed by install-version-hook.cjs)\nexec node "$(git rev-parse --show-toplevel)/scripts/bump-viewer-version.cjs"\n';
function git(...args) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
}
try {
    const root = git('rev-parse', '--show-toplevel');
    if (root.status !== 0 || path.resolve(root.stdout.trim()) !== path.resolve(__dirname, '..')) {
        throw new Error('Run this installer from the viewer repository.');
    }
    const config = git('config', '--get-all', 'core.hooksPath');
    if (config.status === 0) throw new Error('core.hooksPath is configured; integrate the hook manually instead.');
    if (config.status !== 1) throw new Error(`Cannot inspect core.hooksPath: ${config.stderr}`);
    const resolved = git('rev-parse', '--git-path', 'hooks/pre-commit');
    if (resolved.status !== 0) throw new Error(resolved.stderr);
    const target = path.resolve(resolved.stdout.trim());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
        fs.writeFileSync(target, hook, { flag: 'wx', mode: 0o755 });
        console.log(`Installed ${target}`);
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const info = fs.lstatSync(target);
        if (!info.isFile() || fs.readFileSync(target, 'utf8') !== hook) {
            throw new Error(`Existing pre-commit hook at ${target}; not replacing it.`);
        }
        fs.chmodSync(target, info.mode | 0o111);
        console.log(`Already installed: ${target}`);
    }
} catch (error) {
    console.error(`Version hook installation: ${error.message}`);
    process.exitCode = 1;
}
