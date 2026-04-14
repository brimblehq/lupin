import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isProduction = process.env.NODE_ENV === "production";

const config = defineConfig({
  server: {
    allowedHosts: true,
  },
  plugins: [
    ...(isProduction ? [] : [devtools()]),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    sourcemap: false,
    minify: "esbuild",
  },
});

export default config;
