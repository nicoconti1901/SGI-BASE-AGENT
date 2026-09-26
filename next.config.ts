import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Adjuntos de hallazgos: máx. app 15 MB + overhead multipart
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
