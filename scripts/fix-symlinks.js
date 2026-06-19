/**
 * fix-symlinks.js
 * Replaces all symlinks in .next/standalone/.next/node_modules/ with real copies.
 * This prevents electron-builder EPERM errors on Windows while keeping
 * Turbopack's hashed module references (e.g. @prisma/client-xxxx) intact.
 */
const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), '.next', 'standalone', '.next', 'node_modules');

if (!fs.existsSync(targetDir)) {
  console.log('No .next/standalone/.next/node_modules found, skipping.');
  process.exit(0);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(srcPath);
        const stat = fs.statSync(real);
        if (stat.isDirectory()) copyRecursive(real, destPath);
        else fs.copyFileSync(real, destPath);
      } catch { /* skip broken symlinks */ }
    } else if (item.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (item.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function fixDir(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(fullPath);
        const stat = fs.statSync(real);
        console.log(`  Replacing symlink: ${item.name}`);
        fs.unlinkSync(fullPath);
        if (stat.isDirectory()) copyRecursive(real, fullPath);
        else fs.copyFileSync(real, fullPath);
      } catch (e) {
        console.log(`  Removing broken symlink: ${item.name}`);
        try { fs.unlinkSync(fullPath); } catch {}
      }
    } else if (item.isDirectory()) {
      // Recurse into scoped packages like @prisma/
      fixDir(fullPath);
    }
  }
}

console.log('Fixing symlinks in .next/standalone/.next/node_modules/...');
fixDir(targetDir);
console.log('Done!');
