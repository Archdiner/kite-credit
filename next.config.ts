import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  { // Added opening curly brace
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self'", // Removed unsafe-eval/unsafe-inline
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.quiknode.pro https://api.github.com https://api.reclaimprotocol.org https://generativelanguage.googleapis.com",
      "frame-src 'self'",
    ].join("; "),
  }, // Moved closing curly brace
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
