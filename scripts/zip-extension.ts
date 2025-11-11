import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, copyFileSync } from "fs";
import { join, dirname } from "path";

const rootDir = join(import.meta.dir, "..");
const buildDir = join(rootDir, "build");
const distZip = join(rootDir, "smartschool-grid.zip");

if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true });
}
if (existsSync(distZip)) {
  rmSync(distZip);
}

mkdirSync(buildDir);

const filesToCopy = [
  "manifest.json",
  "dist/content.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "README.md"
];

console.log("Creating production build...");

for (const file of filesToCopy) {
  const srcPath = join(rootDir, file);
  const destPath = join(buildDir, file);

  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`Copied ${file}`);
  } else {
    console.warn(`Missing ${file}`);
  }
}

console.log("\nCreating ZIP archive...");
const isWindows = process.platform === "win32";

if (isWindows) {
  await $`powershell -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${distZip}' -Force"`;
} else {
  await $`cd ${buildDir} && zip -r ${distZip} .`;
}

rmSync(buildDir, { recursive: true });

console.log(`\nProduction build created: smartschool-grid.zip`);
console.log(`Ready to upload to Chrome Web Store!`);