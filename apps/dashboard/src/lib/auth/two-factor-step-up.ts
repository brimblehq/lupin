/**
 * The server fn prepends `[STEP_UP|<action>|<resource_id>] ` to the error
 * message for any backend 403 with `requires_2fa`. We parse from the
 * message — `name` and `stack` aren't reliably preserved across seroval's
 * SSR/client serialization, but `message` is.
 */
const STEP_UP_MESSAGE_RE = /^\[STEP_UP\|([^|]+)\|([^|\]]+)\]\s*/;

export interface StepUpRequirement {
  action: string;
  resourceId: string;
}

export function parseStepUpRequirement(error: unknown): StepUpRequirement | null {
  const message = (error as { message?: unknown })?.message;
  if (typeof message !== "string") return null;

  const match = message.match(STEP_UP_MESSAGE_RE);
  if (!match) return null;

  return { action: match[1], resourceId: match[2] };
}

/**
 * Detect the team-2FA-setup-required 403. Backend message starts with
 * "This team requires 2FA" for both team-mutation gating and invitation accept.
 */
export function isTeamTwoFactorSetupRequiredError(error: unknown): boolean {
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && /this team requires 2fa/i.test(message);
}

/** Strip the step-up sentinel from a message before showing it to the user. */
export function stripStepUpPrefix(message: string): string {
  return message.replace(STEP_UP_MESSAGE_RE, "");
}

export async function withStepUp<T>(
  fn: (token?: string) => Promise<T>,
  requestToken: (req: StepUpRequirement) => Promise<string | null>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const requirement = parseStepUpRequirement(error);
    if (!requirement) throw error;

    // Clean the sentinel from message in case the user cancels and the
    // error bubbles up to a toast.
    const err = error as { message?: string };
    if (typeof err.message === "string") {
      err.message = stripStepUpPrefix(err.message);
    }

    const token = await requestToken(requirement);
    if (!token) throw error;

    return fn(token);
  }
}
