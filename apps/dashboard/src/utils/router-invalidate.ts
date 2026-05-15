type RouterLike = {
  state?: {
    matches?: Array<{ routeId?: string }>;
  };
  invalidate: (options?: { filter?: (route: { routeId?: string }) => boolean }) => Promise<void>;
};

function getActiveRouteIds(router: RouterLike): string[] {
  const matches = router.state?.matches ?? [];
  const routeIds = matches.map((match) => match.routeId).filter((routeId): routeId is string => Boolean(routeId));
  return [...new Set(routeIds)];
}

export async function invalidateActiveMatches(router: RouterLike): Promise<void> {
  const routeIds = getActiveRouteIds(router).filter((routeId) => routeId !== "__root__");

  if (routeIds.length === 0) {
    await router.invalidate();
    return;
  }

  await router.invalidate({
    filter: (route) => Boolean(route.routeId && routeIds.includes(route.routeId)),
  });
}
