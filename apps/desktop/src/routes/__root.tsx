import { createRootRouteWithContext } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { SplashScreen } from "~/shared/splash-screen";
import type { Context } from "~/types";

const MainAppLayout = lazy(() => import("~/shared/main-app-layout"));

export const Route = createRootRouteWithContext<Partial<Context>>()({
  component: Component,
});

function Component() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <MainAppLayout />
    </Suspense>
  );
}

export const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : lazy(() =>
        import("@tanstack/react-router-devtools").then((res) => ({
          default: (
            props: React.ComponentProps<typeof res.TanStackRouterDevtools>,
          ) => <res.TanStackRouterDevtools {...props} />,
        })),
      );
