#!/usr/bin/env node

/**
 * Build script to prepare React build for Google Apps Script deployment
 * Run with: npm run build:gas
 * 
 * This script:
 * 1. Builds the React app with Vite
 * 2. Copies dist/index.html to backend-gas/index.html
 * 3. Copies dist/assets to backend-gas/assets
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const clientDir = __dirname;
const distDir = path.join(clientDir, 'dist');
const gasDir = path.join(clientDir, 'backend-gas');
const gasIndexPath = path.join(gasDir, 'index.html');
const gasAssetsPath = path.join(gasDir, 'assets');

try {
  console.log('🔨 Building React app...');
  execSync('npm run build', { 
    cwd: clientDir, 
    stdio: 'inherit' 
  });

  console.log('📦 Preparing files for Google Apps Script...');

  // Copy index.html
  const distIndexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndexPath)) {
    fs.copyFileSync(distIndexPath, gasIndexPath);
    console.log(`✓ Copied index.html to backend-gas/index.html`);
  } else {
    throw new Error('dist/index.html not found');
  }

  // Copy assets folder
  if (fs.existsSync(gasAssetsPath)) {
    fs.rmSync(gasAssetsPath, { recursive: true });
  }
  
  const distAssetsPath = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsPath)) {
    copyDir(distAssetsPath, gasAssetsPath);
    console.log(`✓ Copied assets to backend-gas/assets`);
  }

  console.log('\n📝 Next steps:');
  console.log('1. Go to script.google.com');
  console.log('2. Open your "Globe RSC Data Manager" project');
  console.log('3. Replace the content of index.html with the content of backend-gas/index.html');
  console.log('4. Click Deploy > New deployment');
  console.log('5. Select "Web app" and deploy');
  console.log('\nOr if using clasp CLI: clasp push && clasp deploy\n');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}
