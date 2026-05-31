import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function cacheHeaders(): Plugin {
  const IMMUTABLE = "public, max-age=31536000, immutable";
  const REVALIDATE_DAILY = "public, max-age=86400, must-revalidate";
  return {
    name: "brimble:cache-headers",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (/^\/assets\//.test(url)) {
          res.setHeader("Cache-Control", IMMUTABLE);
        } else if (/^\/(icons|images|abc-marfa-font-family)\//.test(url)) {
          res.setHeader("Cache-Control", REVALIDATE_DAILY);
        }
        next();
      });
    },
  };
}

const config = defineConfig({
  envPrefix: ["VITE_", "APP_ENV"],
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    cacheHeaders(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "types\\.ts$|project-route-cache\\.ts$",
      },
    }),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryTanstackStart({
            org: "brimble",
            project: "brimble-dashboard",
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
    viteReact(),
  ],
  server: {
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@stripe/")) return "stripe";
          if (id.includes("/ably/")) return "ably";
          if (id.includes("/motion/") || id.includes("/framer-motion/")) return "motion";
          if (id.includes("/lucide-react/")) return "lucide";
          if (id.includes("@phosphor-icons/")) return "phosphor";
          if (id.includes("@sentry/")) return "sentry";
          if (id.includes("/formik/") || id.includes("/yup/")) return "forms";
          if (id.includes("/recharts/") || id.includes("/d3-")) return "recharts";
        },
      },
    },
  },
});

export default config;
