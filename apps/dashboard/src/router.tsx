import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorComponent } from "./components/shared/default-error";

let sentryInitialized = false;

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultStaleTime: 300_000,
    defaultPreloadStaleTime: 300_000,
    defaultGcTime: 30 * 60_000,
    defaultPendingMs: 300,
    defaultErrorComponent: DefaultErrorComponent,
  });

  if (!router.isServer && !sentryInitialized) {
    Sentry.init({
      dsn: "https://640585a158652a63a2d0928bfb50a950@o4506456636915712.ingest.us.sentry.io/4510945202470912",
      sendDefaultPii: true,
    });
    sentryInitialized = true;
  }

  if (typeof document !== "undefined") {
    import("nprogress").then((mod) => {
      const NProgress = mod.default;
      import("nprogress/nprogress.css");
      NProgress.configure({ showSpinner: false, trickleSpeed: 200 });

      router.subscribe("onBeforeLoad", ({ pathChanged }) => {
        if (pathChanged) NProgress.start();
      });

      router.subscribe("onLoad", () => {
        NProgress.done();
      });
    });
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
