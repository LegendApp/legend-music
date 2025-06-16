#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

function execCommand(command: string, args: string[], errorMessage: string) {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    if (result.error || result.status !== 0) {
        console.error(errorMessage);
        console.error(result.stderr?.toString() || result.error?.message);
        process.exit(1);
    }
    return result;
}

function log(message: string) {
    console.log(`=== ${message} ===`);
}

function main() {
    const PROJECT_ROOT = resolve(__dirname, '..');
    const MACOS_DIR = join(PROJECT_ROOT, 'macos');
    const RELEASE_APP_PATH = join(MACOS_DIR, 'build/Build/Products/Release/Legend Hub.app');

    // Change directory to macos
    process.chdir(MACOS_DIR);
    log('Changed directory to macos');

    // Remove previous Release build if it exists
    if (existsSync(RELEASE_APP_PATH)) {
        log('Removing previous Release build');
        rmSync(RELEASE_APP_PATH, { recursive: true, force: true });
    }

    // Run xcodebuild
    log('Building app with xcodebuild');
    execCommand(
        'xcodebuild',
        [
            '-workspace',
            'LegendMusic.xcworkspace',
            '-scheme',
            'LegendMusic-macOS',
            '-configuration',
            'Release',
            '-derivedDataPath',
            './build',
        ],
        'Error building app:',
    );

    log('Build completed successfully');
}

// Run the script
main();
