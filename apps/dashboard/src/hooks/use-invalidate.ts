import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

export function useInvalidate() {
  const router = useRouter();

  return useCallback(() => {
    router.invalidate();
  }, [router]);
}

export function useInvalidatingServerFn<TArgs extends { data?: unknown }, TResult>(serverFn: (args: TArgs) => Promise<TResult>) {
  const router = useRouter();

  return useCallback(
    async (args: TArgs): Promise<TResult> => {
      const result = await serverFn(args);
      router.invalidate();
      return result;
    },
    [router, serverFn],
  );
}
