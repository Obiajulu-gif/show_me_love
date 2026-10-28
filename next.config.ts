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
};

export default nextConfig;
