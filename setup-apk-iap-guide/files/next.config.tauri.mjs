/** @type {import('next').NextConfig} */
const nextConfig = {
    // Static export para Tauri (APK/Desktop)
    output: 'export',

    // Images: unoptimized for static export
    images: {
        unoptimized: true,
    },

    // Turbopack config for client-side module resolution
    turbopack: {
        resolveAlias: {
            // Provide empty modules for Node.js-only modules in browser
            fs: './lib/empty-module.js',
            path: './lib/empty-module.js',
        },
    },

    // Webpack config for fallback
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
            };
        }

        return config;
    },
};

export default nextConfig;
