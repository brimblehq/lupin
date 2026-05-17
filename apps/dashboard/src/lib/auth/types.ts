export type RefreshSessionServerResult =
  | {
      status: "ok";
      user: {
        id?: string;
        firstName?: string;
      };
    }
  | { status: "missing" | "expired" | "error" };
