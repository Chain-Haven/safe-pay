#!/usr/bin/env node
/**
 * Build script to create the WooCommerce plugin zip file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pluginDir = path.join(__dirname, '..');
const distDir = path.join(pluginDir, 'dist');
const pluginName = 'wc-crypto-gateway';

// Files to include in the zip
const includeFiles = [
  'wc-crypto-gateway.php',
  'includes/',
  'assets/',
  'languages/',
  'readme.txt',
];

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create languages directory if it doesn't exist
const langDir = path.join(pluginDir, 'languages');
if (!fs.existsSync(langDir)) {
  fs.mkdirSync(langDir);
  // Create empty .pot file
  fs.writeFileSync(path.join(langDir, 'wc-crypto-gateway.pot'), '');
}

// Build the zip file
console.log('Building plugin zip...');

try {
  // Change to plugin directory
  process.chdir(pluginDir);
  
  // Create zip file
  const zipPath = path.join(distDir, `${pluginName}.zip`);
  
  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  // Use zip command (available on most systems)
  const filesToZip = includeFiles.filter(f => {
    const fullPath = path.join(pluginDir, f);
    return fs.existsSync(fullPath);
  }).join(' ');
  
  execSync(`zip -r "${zipPath}" ${filesToZip}`, { stdio: 'inherit' });
  
  console.log(`\nPlugin zip created: ${zipPath}`);
  
  // Get file size
  const stats = fs.statSync(zipPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
  
} catch (error) {
  console.error('Error building zip:', error.message);
  
  // Fallback: create a simple zip using Node.js
  console.log('\nTrying fallback method...');
  
  // Just copy files to dist for manual zipping
  const tempDir = path.join(distDir, pluginName);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Copy files
  for (const file of includeFiles) {
    const src = path.join(pluginDir, file);
    const dest = path.join(tempDir, file);
    
    if (fs.existsSync(src)) {
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }
  
  console.log(`Files copied to: ${tempDir}`);
  console.log('Please manually create the zip file or install the "zip" command.');
}
