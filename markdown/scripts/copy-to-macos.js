import path from 'node:path';
import fs from 'fs-extra';

async function main() {
    try {
        const sourceFile = path.resolve('dist/index.html');
        const targetDir = path.resolve('../macos/LegendMusic-macOS/Resources');
        const targetFile = path.join(targetDir, 'MarkdownEditor.html');

        // Make sure the target directory exists
        await fs.ensureDir(targetDir);

        // Copy the file
        await fs.copy(sourceFile, targetFile);

        console.log(`Successfully copied ${sourceFile} to ${targetFile}`);
    } catch (error) {
        console.error('Error copying file:', error);
        process.exit(1);
    }
}

main();
