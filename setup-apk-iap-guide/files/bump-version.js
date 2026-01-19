#!/usr/bin/env node
/**
 * Bump version script
 * Updates version in tauri.conf.json (single source of truth)
 *
 * Usage:
 *   node scripts/bump-version.js patch  # 1.0.9 -> 1.0.10
 *   node scripts/bump-version.js minor  # 1.0.9 -> 1.1.0
 *   node scripts/bump-version.js major  # 1.0.9 -> 2.0.0
 *   node scripts/bump-version.js 1.2.3  # Set specific version
 */

const fs = require('fs');
const path = require('path');

const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');

function bumpVersion(currentVersion, type) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            // Assume it's a specific version
            if (/^\d+\.\d+\.\d+$/.test(type)) {
                return type;
            }
            throw new Error(`Invalid version type: ${type}`);
    }
}

function main() {
    const type = process.argv[2] || 'patch';

    // Read tauri.conf.json
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
    const currentVersion = tauriConfig.version;
    const newVersion = bumpVersion(currentVersion, type);

    // Update tauri.conf.json
    tauriConfig.version = newVersion;
    fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');

    console.log(`✅ Version bumped: ${currentVersion} -> ${newVersion}`);
    console.log('');
    console.log('Updated files:');
    console.log(`  - src-tauri/tauri.conf.json`);
    console.log('');
    console.log('The version in app/settings will update automatically via lib/version.ts');
}

main();
