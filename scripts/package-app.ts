#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import path, { join, resolve } from "node:path";

const ENABLE_CHANGELOG = false;

// Types
interface AppConfig {
    APP_NAME: string;
    TEAM_NAME: string;
    TEAM_ID: string;
    APPLE_ID: string;
    APP_PASSWORD: string;
    version: string;
}

// Helper functions
function execCommand(command: string, args: string[], errorMessage: string) {
    console.log(`Executing: ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, { stdio: "inherit" });

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

function getBundleVersion(version: string) {
    const sanitized = version.replace(/\./g, "");
    return sanitized.length > 0 ? sanitized : version;
}

function ensureInfoPlistVersion(plistPath: string, shortVersion: string, bundleVersion: string, label: string) {
    if (!existsSync(plistPath)) {
        console.error(`Error: Info.plist not found at ${plistPath}`);
        process.exit(1);
    }

    const replaceKey = (content: string, key: string, value: string) => {
        const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);

        if (!pattern.test(content)) {
            console.error(`Error: ${key} not found in Info.plist at ${plistPath}`);
            process.exit(1);
        }

        const updated = content.replace(pattern, `$1${value}$3`);
        return { updated, changed: updated !== content };
    };

    let plistContent = readFileSync(plistPath, "utf-8");

    const shortResult = replaceKey(plistContent, "CFBundleShortVersionString", shortVersion);
    plistContent = shortResult.updated;
    const bundleResult = replaceKey(plistContent, "CFBundleVersion", bundleVersion);
    plistContent = bundleResult.updated;

    if (shortResult.changed || bundleResult.changed) {
        writeFileSync(plistPath, plistContent, "utf-8");
        log(`Updated ${label} Info.plist versions to ${shortVersion} / ${bundleVersion}`);
    } else {
        log(`${label} Info.plist versions already set to ${shortVersion} / ${bundleVersion}`);
    }
}

// Get configuration
const PROJECT_ROOT = resolve(__dirname, "..");

// Load and parse configuration
function loadConfig(): AppConfig {
    // Get version from package.json
    const packageJsonPath = join(PROJECT_ROOT, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const version = packageJson.version;

    // Default values
    const config: AppConfig = {
        APP_NAME: "Legend Music",
        TEAM_NAME: "",
        TEAM_ID: "",
        APPLE_ID: "",
        APP_PASSWORD: "",
        version,
    };

    // Load from .env file if exists
    const envFilePath = join(PROJECT_ROOT, ".env");
    if (existsSync(envFilePath)) {
        console.log("Loading configuration from .env file");
        const envContent = readFileSync(envFilePath, "utf-8");

        // Extract environment variables directly
        const envVars = ["APP_NAME", "TEAM_NAME", "TEAM_ID", "APPLE_ID", "APP_PASSWORD"] as const;

        envVars.forEach((key) => {
            const pattern = new RegExp(`${key}=["']?([^"'\\n]+)["']?`);
            const match = envContent.match(pattern);
            if (match && match[1]) {
                config[key] = match[1];
            }
        });
    } else {
        console.error("Warning: .env file not found at", envFilePath);
        process.exit(1);
    }

    return config;
}

// Function to notarize the app
function notarizeApp(appPath: string, config: AppConfig, safeAppName: string) {
    log(`Starting notarization process for ${appPath}`);

    const appName = config.APP_NAME;
    const targetBaseName = appName.replace(/\s+/g, "");
    const targetFolderName = `${targetBaseName}-macOS`;
    const entitlementsPath = join(
        PROJECT_ROOT,
        "macos",
        targetFolderName,
        `${targetBaseName}-macOS.entitlements`,
    );

    // Step 1: Code Sign the app
    log("Code signing app");
    execCommand(
        "codesign",
        [
            "--force",
            "--deep",
            "--entitlements",
            entitlementsPath,
            "--sign",
            `Developer ID Application: ${config.TEAM_NAME} (${config.TEAM_ID})`,
            "--options",
            "runtime",
            appPath,
        ],
        "Error code signing app:",
    );

    // Step 2: Create a ZIP archive for submission
    log("Creating notarization ZIP archive");
    const notarizationZipPath = `/tmp/${safeAppName}_notarize_temp.zip`;
    execCommand(
        "ditto",
        ["-c", "-k", "--keepParent", appPath, notarizationZipPath],
        "Error creating notarization zip archive:",
    );

    // Step 3: Submit for notarization
    log("Submitting for notarization (this may take a while)");
    execCommand(
        "xcrun",
        [
            "notarytool",
            "submit",
            notarizationZipPath,
            "--apple-id",
            config.APPLE_ID,
            "--password",
            config.APP_PASSWORD,
            "--team-id",
            config.TEAM_ID,
            "--wait",
        ],
        "Error submitting for notarization:",
    );

    // Step 4: Staple the notarization ticket to the app
    log("Stapling notarization ticket to app");
    execCommand("xcrun", ["stapler", "staple", appPath], "Error stapling notarization ticket:");

    log("Notarization process completed successfully");
}

// Function to create a version info file for Sparkle
function createVersionInfoFile(distDir: string, config: AppConfig, zipFileName: string) {
    const infoPath = join(distDir, "sparkle-version-info.plist");
    const bundleVersion = getBundleVersion(config.version);
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleShortVersionString</key>
    <string>${config.version}</string>
    <key>CFBundleVersion</key>
    <string>${bundleVersion}</string>
    <key>FileName</key>
    <string>${zipFileName}</string>
</dict>
</plist>`;

    writeFileSync(infoPath, content, "utf-8");
    console.log(`Created version info file at: ${infoPath}`);
}

// Function to parse CHANGELOG.md and generate HTML update files for each version
function generateChangelogHtml(distDir: string, config: AppConfig, appName: string) {
    log("Generating HTML update files from CHANGELOG.md");

    const changelogPath = join(PROJECT_ROOT, "CHANGELOG.md");
    if (!existsSync(changelogPath)) {
        console.warn(`Warning: CHANGELOG.md not found at ${changelogPath}`);
        console.warn("Skipping HTML update file generation");
        return;
    }

    const changelogContent = readFileSync(changelogPath, "utf-8");

    // Parse changelog into version blocks
    // Format expected: ## x.x.x followed by release notes
    const versionRegex = /## (\d+\.\d+\.\d+)\s+([\s\S]*?)(?=## \d+\.\d+\.\d+|$)/g;
    let match: RegExpExecArray | null = null;

    // biome-ignore lint/suspicious/noAssignInExpressions: whatevs
    while ((match = versionRegex.exec(changelogContent)) !== null) {
        const version = match[1];
        const notes = match[2].trim();

        // Save HTML file with the same naming pattern as the zip but with .html extension
        const htmlFileName = `${appName} ${version}.html`;
        const htmlFilePath = join(distDir, htmlFileName);

        writeFileSync(htmlFilePath, notes, "utf-8");
        console.log(`Generated HTML update file for version ${version}: ${htmlFilePath}`);
    }

    log("HTML update file generation complete");
}

// Function to check if version exists in CHANGELOG.md
function checkVersionInChangelog(config: AppConfig) {
    log("Checking for version in CHANGELOG.md");

    const changelogPath = join(PROJECT_ROOT, "CHANGELOG.md");
    if (!existsSync(changelogPath)) {
        console.error(`Error: CHANGELOG.md not found at ${changelogPath}`);
        process.exit(1);
    }

    const changelogContent = readFileSync(changelogPath, "utf-8");

    // Look for the version header in the changelog
    const versionHeaderRegex = new RegExp(`## ${config.version.replace(/\./g, "\\.")}`);

    if (!versionHeaderRegex.test(changelogContent)) {
        console.error(`Error: Version ${config.version} not found in CHANGELOG.md`);
        console.error("Please add release notes for this version before packaging");
        process.exit(1);
    }

    log(`Found version ${config.version} in CHANGELOG.md`);
}

// Function to generate appcast
function generateAppcast(distDir: string, config: AppConfig) {
    // Find generate-appcast
    const generateAppcastPath = path.resolve(__dirname, "../macos/Pods/Sparkle/bin/generate_appcast");

    if (!existsSync(generateAppcastPath)) {
        console.warn(`Warning: generate_appcast not found at ${generateAppcastPath}`);
        console.warn("Skipping appcast generation. To enable this feature, set SPARKLE_PATH in .env");
        return;
    }

    log("Generating appcast from dist folder");
    execCommand(
        generateAppcastPath,
        [
            distDir,
            "--download-url-prefix",
            `https://github.com/LegendApp/legend-music/releases/download/v${config.version}/`,
        ],
        "Error generating appcast:",
    );
    cpSync(join(distDir, "appcast.xml"), join(PROJECT_ROOT, "appcast.xml"), { force: true });

    log("Appcast generation complete");
}

// Function to replace spaces with hyphens in appcast.xml and delta files
function replaceSpacesInAppcast(distDir: string, appName: string) {
    log("Replacing spaces with hyphens in appcast.xml and delta files");

    const appcastPath = join(distDir, "appcast.xml");
    const appcastContent = readFileSync(appcastPath, "utf-8");

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const encodedAppName = appName.replace(/ /g, "%20");
    const deltaPattern = new RegExp(`${escapeRegExp(encodedAppName)}[^"<>]+\\.delta`, "g");

    const deltaFiles = appcastContent.match(deltaPattern) || [];
    deltaFiles.forEach((deltaFile) => {
        const oldPath = join(distDir, deltaFile.replace(/(%20)+/g, " "));
        const newPath = join(distDir, deltaFile.replace(/(%20)+/g, "-"));

        if (oldPath !== newPath && existsSync(oldPath)) {
            console.log(`Copying ${oldPath} to ${newPath}`);
            cpSync(oldPath, newPath, { force: true });
            rmSync(oldPath, { force: true });
        }
    });

    const updatedContent = appcastContent.replace(deltaPattern, (match) => match.replace(/(%20)+/g, "-"));

    writeFileSync(appcastPath, updatedContent, "utf-8");
    const rootAppcastPath = join(PROJECT_ROOT, "appcast.xml");
    writeFileSync(rootAppcastPath, updatedContent, "utf-8");

    log("Space replacement in appcast.xml and delta files complete");
}

function moveDeltaFilesForVersion(
    distDir: string,
    releaseDir: string,
    appNameForZip: string,
    bundleVersion: string,
) {
    const deltaPrefix = `${appNameForZip}${bundleVersion}`;
    const deltaFiles = readdirSync(distDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.startsWith(deltaPrefix) && entry.name.endsWith(".delta"))
        .map((entry) => entry.name);

    if (deltaFiles.length === 0) {
        log(`No delta files found starting with ${deltaPrefix}`);
        return;
    }

    deltaFiles.forEach((deltaFile) => {
        const sourcePath = join(distDir, deltaFile);
        const targetPath = join(releaseDir, deltaFile);

        if (existsSync(targetPath)) {
            rmSync(targetPath, { force: true });
        }

        try {
            renameSync(sourcePath, targetPath);
            console.log(`Moved delta file to: ${targetPath}`);
        } catch (error) {
            console.error(`Error moving delta file ${deltaFile} to release directory:`, error);
            process.exit(1);
        }
    });
}

// Main execution
function main() {
    // Load configuration
    const config = loadConfig();

    const appName = config.APP_NAME;
    const bundleVersion = getBundleVersion(config.version);
    const targetBaseName = appName.replace(/\s+/g, "");
    const targetFolderName = `${targetBaseName}-macOS`;
    const projectInfoPlistPath = join(PROJECT_ROOT, "macos", targetFolderName, "Info.plist");
    ensureInfoPlistVersion(projectInfoPlistPath, config.version, bundleVersion, "project");

    if (ENABLE_CHANGELOG) {
        // Check if this version exists in the changelog before proceeding
        checkVersionInChangelog(config);
    }

    // Setup paths
    const builtAppPath = join(PROJECT_ROOT, "macos/build/Build/Products/Release", `${appName}.app`);
    const distDir = join(PROJECT_ROOT, "dist");
    const releaseDir = join(distDir, `v${config.version}`);

    const appNameForZip = appName.replace(/\s+/g, "-");
    const safeAppName = appName.replace(/\s+/g, "_");

    // Use the same base filename both for the app and zip
    const versionedAppName = `${appName}.app`;
    const zipFileName = `${appNameForZip}-${config.version}.zip`;
    const releaseAppPath = join(releaseDir, versionedAppName);
    const distZipPath = join(distDir, zipFileName);
    const releaseZipPath = join(releaseDir, zipFileName);

    // Check if app exists
    if (!existsSync(builtAppPath)) {
        console.error(`Error: App not found at ${builtAppPath}`);
        console.error(`Make sure to build the app first with 'bun run build'`);
        process.exit(1);
    }
    const builtInfoPlistPath = join(builtAppPath, "Contents", "Info.plist");
    ensureInfoPlistVersion(builtInfoPlistPath, config.version, bundleVersion, "built app");

    // Create dist directory if needed
    if (!existsSync(distDir)) {
        console.log(`Creating distribution directory: ${distDir}`);
        mkdirSync(distDir, { recursive: true });
    }

    // Reset the release directory for this version
    if (existsSync(releaseDir)) {
        log(`Removing existing release directory at ${releaseDir}`);
        try {
            rmSync(releaseDir, { recursive: true, force: true });
        } catch (error) {
            console.error("Error removing existing release directory:", error);
            process.exit(1);
        }
    }

    console.log(`Creating release directory: ${releaseDir}`);
    mkdirSync(releaseDir, { recursive: true });

    // Copy the app to the release folder with versioned name
    log(`Copying app to release directory as ${versionedAppName}`);
    try {
        cpSync(builtAppPath, releaseAppPath, { recursive: true, force: true });
        console.log(`App copied successfully to: ${releaseAppPath}`);
    } catch (error) {
        console.error("Error copying app to release directory:", error);
        process.exit(1);
    }
    const releaseInfoPlistPath = join(releaseAppPath, "Contents", "Info.plist");
    ensureInfoPlistVersion(releaseInfoPlistPath, config.version, bundleVersion, "packaged app");

    // Notarize the copied app
    notarizeApp(releaseAppPath, config, safeAppName);

    // Create final zip
    log(`Packaging ${appName} v${config.version}`);
    log(`Creating distribution ZIP archive: ${zipFileName}`);
    execCommand(
        "ditto",
        ["-ck", "-rsrc", "--sequesterRsrc", "--keepParent", releaseAppPath, distZipPath],
        "Error creating distribution zip archive:",
    );

    log("Packaging complete");
    console.log(`App has been packaged to: ${distZipPath}`);

    try {
        cpSync(distZipPath, releaseZipPath, { force: true });
        console.log(`Copied zip to release directory: ${releaseZipPath}`);
    } catch (error) {
        console.error("Error copying zip to release directory:", error);
        process.exit(1);
    }

    // Create version info file for Sparkle
    createVersionInfoFile(distDir, config, zipFileName);

    if (ENABLE_CHANGELOG) {
        // Generate HTML update files from CHANGELOG.md
        generateChangelogHtml(distDir, config, appName);

        const releaseNotesFileName = `${appName} ${config.version}.html`;
        const distReleaseNotesPath = join(distDir, releaseNotesFileName);
        const releaseNotesPath = join(releaseDir, releaseNotesFileName);

        if (existsSync(distReleaseNotesPath)) {
            cpSync(distReleaseNotesPath, releaseNotesPath, { force: true });
            console.log(`Copied release notes to: ${releaseNotesPath}`);
        }
    }

    // Generate appcast
    generateAppcast(distDir, config);

    replaceSpacesInAppcast(distDir, appName);

    const distAppcastPath = join(distDir, "appcast.xml");
    const releaseAppcastPath = join(releaseDir, "appcast.xml");
    if (existsSync(distAppcastPath)) {
        cpSync(distAppcastPath, releaseAppcastPath, { force: true });
        console.log(`Copied appcast to: ${releaseAppcastPath}`);
    }

    moveDeltaFilesForVersion(distDir, releaseDir, appNameForZip, bundleVersion);
}

// Run the script
main();
