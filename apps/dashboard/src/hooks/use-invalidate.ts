import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

export function useInvalidate() {
  const router = useRouter();

  return useCallback(() => {
    void invalidateActiveMatches(router);
  }, [router]);
}

export function useInvalidatingServerFn<TArgs extends { data?: unknown }, TResult>(serverFn: (args: TArgs) => Promise<TResult>) {
  const router = useRouter();

  return useCallback(
    async (args: TArgs): Promise<TResult> => {
      const result = await serverFn(args);
      void invalidateActiveMatches(router);
      return result;
    },
    [router, serverFn],
  );
}
