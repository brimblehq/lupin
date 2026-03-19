import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function staleAssetGuard(): Plugin {
  return {
    name: "brimble:stale-asset-guard",
    configurePreviewServer: {
      order: "post",
      handler(server) {
        return () => {
          const assetPattern =
            /^\/(assets|icons|images|abc-marfa-font-family)\//;
          server.middlewares.use((req, res, next) => {
            const url = req.url?.split("?")[0] ?? "";
            if (assetPattern.test(url)) {
              res.statusCode = 404;
              res.setHeader("Cache-Control", "no-cache");
              res.end();
              return;
            }
            next();
          });
        };
      },
    },
  };
}

const config = defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    staleAssetGuard(),
    tanstackStart(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryTanstackStart({
            org: "brimble",
            project: "brimble-dashboard-new",
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
    viteReact(),
  ],
  server: {
    allowedHosts: true,
  },
});

export default config;
