#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

function execCommand(command: string, args: string[], errorMessage: string) {
    console.log(`Executing: ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, {
        stdio: "inherit",
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
    const PROJECT_ROOT = resolve(__dirname, "..");
    const MACOS_DIR = join(PROJECT_ROOT, "macos");
    const RELEASE_PRODUCTS_DIR = join(MACOS_DIR, "build/Build/Products/Release");

    // Change directory to macos
    process.chdir(MACOS_DIR);
    log("Changed directory to macos");

    // Remove previous Release outputs if they exist
    for (const artifact of ["LegendMusic.app", "LegendMusic.app.dSYM"]) {
        const artifactPath = join(RELEASE_PRODUCTS_DIR, artifact);
        if (existsSync(artifactPath)) {
            log(`Removing previous ${artifact}`);
            rmSync(artifactPath, { recursive: true, force: true });
        }
    }

    // Run xcodebuild
    log("Building app with xcodebuild");
    execCommand(
        "xcodebuild",
        [
            "-workspace",
            "LegendMusic.xcworkspace",
            "-scheme",
            "LegendMusic-macOS",
            "-configuration",
            "Release",
            "-derivedDataPath",
            "./build",
            "ONLY_ACTIVE_ARCH=YES",
        ],
        "Error building app:",
    );

    log("Build completed successfully");
}

// Run the script
main();
