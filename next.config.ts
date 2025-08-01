import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@duckdb/node-api'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize DuckDB and all its platform-specific bindings
      config.externals.push(
        '@duckdb/node-api',
        '@duckdb/node-bindings',
        '@duckdb/node-bindings-linux-x64',
        '@duckdb/node-bindings-linux-arm64', 
        '@duckdb/node-bindings-darwin-arm64',
        '@duckdb/node-bindings-darwin-x64',
        '@duckdb/node-bindings-win32-x64',
        // Externalize Tailwind CSS platform-specific bindings
        '@tailwindcss/oxide',
        '@tailwindcss/oxide-android-arm64',
        '@tailwindcss/oxide-darwin-arm64',
        '@tailwindcss/oxide-darwin-x64',
        '@tailwindcss/oxide-freebsd-x64',
        '@tailwindcss/oxide-linux-arm-gnueabihf',
        '@tailwindcss/oxide-linux-arm64-gnu',
        '@tailwindcss/oxide-linux-arm64-musl',
        '@tailwindcss/oxide-linux-x64-gnu',
        '@tailwindcss/oxide-linux-x64-musl',
        '@tailwindcss/oxide-wasm32-wasi',
        '@tailwindcss/oxide-win32-arm64-msvc',
        '@tailwindcss/oxide-win32-x64-msvc',
        // Externalize LightningCSS platform-specific bindings
        'lightningcss',
        'lightningcss-darwin-arm64',
        'lightningcss-darwin-x64',
        'lightningcss-freebsd-x64',
        'lightningcss-linux-arm-gnueabihf',
        'lightningcss-linux-arm64-gnu',
        'lightningcss-linux-arm64-musl',
        'lightningcss-linux-x64-gnu',
        'lightningcss-linux-x64-musl',
        'lightningcss-win32-arm64-msvc',
        'lightningcss-win32-x64-msvc'
      );
    }

    return config;
  },
};

export default nextConfig;
