import type { AuthSession } from "@/backend";
import { RefreshSessionStatus } from "./enums";

export type RefreshSessionServerResult =
  | {
      status: RefreshSessionStatus.Ok;
      user: AuthSession["user"];
    }
  | {
      status: Exclude<RefreshSessionStatus, RefreshSessionStatus.Ok>;
    };
