import type { NextConfig } from "next";

/** The consent screen must never be framed (clickjacking). */
export const authorizeHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/connect/authorize", headers: authorizeHeaders }];
  },
  // Optional deps that wallet SDKs probe for (React Native storage, pretty logs); the browser never needs them.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "@react-native-async-storage/async-storage": false, "pino-pretty": false };
    return config;
  },
};

export default nextConfig;
