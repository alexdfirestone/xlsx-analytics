import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@duckdb/node-api'],
  },
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
        '@duckdb/node-bindings-win32-x64'
      );
    }

    return config;
  },
};

export default nextConfig;
