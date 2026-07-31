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
  // The scene lived at /system through sprints 1-7 and moved to / once it
  // became the whole site. 308 rather than 302 so the old URL is transferred
  // rather than indexed alongside the new one.
  async redirects() {
    return [{ source: "/system", destination: "/", permanent: true }];
  },
};

export default nextConfig;
