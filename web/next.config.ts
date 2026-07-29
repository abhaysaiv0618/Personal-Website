import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the workspace root. Without this, Turbopack walks up past the repo and
// picks a stray lockfile in the home directory as the root.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
