#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

console.log('🔨 Building for Tauri (Static Export)...\n');

// 1. Backup current next.config.mjs
const nextConfigPath = path.join(projectRoot, 'next.config.mjs');
const nextConfigBackup = path.join(projectRoot, 'next.config.web.mjs.backup');
const nextConfigTauriPath = path.join(projectRoot, 'next.config.tauri.mjs');

try {
    // Backup web config
    if (fs.existsSync(nextConfigPath)) {
        console.log('📦 Backing up web config...');
        fs.copyFileSync(nextConfigPath, nextConfigBackup);
    }

    // Use Tauri config
    console.log('🔧 Using Tauri config (static export)...');
    fs.copyFileSync(nextConfigTauriPath, nextConfigPath);

    // 2. Backup and use Tauri env
    const envLocalPath = path.join(projectRoot, '.env.local');
    const envLocalBackup = path.join(projectRoot, '.env.local.backup');
    const envTauriPath = path.join(projectRoot, '.env.tauri');

    if (fs.existsSync(envLocalPath)) {
        console.log('📦 Backing up .env.local...');
        fs.copyFileSync(envLocalPath, envLocalBackup);
    }

    if (fs.existsSync(envTauriPath)) {
        console.log('🔧 Using .env.tauri...');
        fs.copyFileSync(envTauriPath, envLocalPath);
    }

    // 3. Rename route.ts files to route.ts.bak to skip API routes (they're called remotely)
    const apiPath = path.join(projectRoot, 'app', 'api');
    const renamedRoutes = [];

    function renameRouteFiles(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    renameRouteFiles(fullPath);
                } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
                    const backupPath = fullPath + '.bak';
                    try {
                        fs.renameSync(fullPath, backupPath);
                        renamedRoutes.push(fullPath);
                    } catch (e) {
                        console.log(`⚠️ Could not rename ${fullPath}: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            console.log(`⚠️ Could not read ${dir}: ${e.message}`);
        }
    }

    if (fs.existsSync(apiPath)) {
        console.log('📦 Hiding API routes (not needed in static export)...');
        renameRouteFiles(apiPath);
        // Save list of renamed routes for restoration
        fs.writeFileSync(path.join(projectRoot, '.renamed-routes.json'), JSON.stringify(renamedRoutes));
    }

    // 4. Also hide app/auth/callback route handler (OAuth callback is web-only)
    const authCallbackPath = path.join(projectRoot, 'app', 'auth', 'callback');

    if (fs.existsSync(authCallbackPath)) {
        console.log('📦 Hiding auth callback route (OAuth is web-only)...');
        renameRouteFiles(authCallbackPath);
    }

    // 4. Build
    console.log('\n🏗️  Running Next.js build...');
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

    console.log('\n✅ Tauri build complete!');
    console.log('📦 Output in: ./out/\n');

} finally {
    // Restore original configs
    console.log('🔄 Restoring original configs...');

    if (fs.existsSync(nextConfigBackup)) {
        fs.copyFileSync(nextConfigBackup, nextConfigPath);
        fs.unlinkSync(nextConfigBackup);
    }

    const envLocalBackup = path.join(projectRoot, '.env.local.backup');
    if (fs.existsSync(envLocalBackup)) {
        fs.copyFileSync(envLocalBackup, path.join(projectRoot, '.env.local'));
        fs.unlinkSync(envLocalBackup);
    }

    // Restore API routes (rename .bak files back)
    const renamedRoutesFile = path.join(projectRoot, '.renamed-routes.json');
    if (fs.existsSync(renamedRoutesFile)) {
        try {
            const renamedRoutes = JSON.parse(fs.readFileSync(renamedRoutesFile, 'utf8'));
            for (const routePath of renamedRoutes) {
                const backupPath = routePath + '.bak';
                if (fs.existsSync(backupPath)) {
                    try {
                        fs.renameSync(backupPath, routePath);
                    } catch (e) {
                        console.log(`⚠️ Could not restore ${routePath}: ${e.message}`);
                    }
                }
            }
            fs.unlinkSync(renamedRoutesFile);
        } catch (e) {
            console.log(`⚠️ Could not read renamed routes file: ${e.message}`);
        }
    }

    // Auth callback routes are already restored via the renamedRoutes list above

    console.log('✅ Configs restored\n');
}
