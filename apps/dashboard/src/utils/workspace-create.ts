import * as Yup from "yup";

export const TEAM_PLAN_TYPE = "TEAM_PLAN" as const;
export const WORKSPACE_MIN_BUILDS = 1;
export const WORKSPACE_MAX_BUILDS = 10;

export type WorkspaceNameStepValues = {
  name: string;
  slug: string;
};

export type WorkspaceConfigStepValues = {
  teamSize: number;
  concurrentBuilds: number;
  promoCode: string;
  startupCodeReference: string;
};

export type WorkspaceInviteRow = {
  id: number;
  email: string;
  role: string;
};

export type WorkspaceInviteStepValues = {
  invites: WorkspaceInviteRow[];
};

export function slugifyWorkspaceName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const workspaceNameStepSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .required("Workspace name is required"),
  slug: Yup.string()
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only")
    .required("Workspace URL is required"),
});

export const workspaceConfigStepSchema = Yup.object({
  teamSize: Yup.number().min(1).required(),
  concurrentBuilds: Yup.number()
    .min(WORKSPACE_MIN_BUILDS)
    .max(WORKSPACE_MAX_BUILDS)
    .required(),
  promoCode: Yup.string().default(""),
  startupCodeReference: Yup.string().default(""),
});

export const workspaceInviteStepSchema = Yup.object({
  invites: Yup.array()
    .of(
      Yup.object({
        id: Yup.number().required(),
        role: Yup.string().default("Member"),
        email: Yup.string()
          .trim()
          .test("email-or-empty", "Enter a valid email address", (value) => {
            if (!value?.trim()) return true;
            return Yup.string().email().isValidSync(value.trim());
          }),
      }),
    )
    .test("unique-emails", "Duplicate invite emails are not allowed", (rows) => {
      if (!rows) return true;
      const seen = new Set<string>();
      for (const row of rows) {
        const email = row?.email?.trim().toLowerCase();
        if (!email) continue;
        if (seen.has(email)) return false;
        seen.add(email);
      }
      return true;
    }),
});

export function extractInvitedEmails(rows: WorkspaceInviteRow[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

export function buildCreateWorkspacePayload(input: {
  workspaceName: string;
  teamSize: number;
  concurrentBuilds: number;
  promoCode?: string;
  startupCodeReference?: string;
  invitedEmails: string[];
}) {
  return {
    team_name: input.workspaceName.trim(),
    type: TEAM_PLAN_TYPE,
    members: input.invitedEmails,
    startup_code_reference:
      input.startupCodeReference?.trim() || input.promoCode?.trim() || "",
    specifications: {
      members: input.teamSize,
      concurrent_builds: input.concurrentBuilds,
    },
    accept_terms: true,
  } as const;
}
