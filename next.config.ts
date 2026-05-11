import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Evita que Next infiera como raíz el directorio del usuario cuando hay otro lockfile (p. ej. package-lock.json en %USERPROFILE%).
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
