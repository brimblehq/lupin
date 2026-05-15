export type TransferDomainWorkspacePayload = {
  domainId?: string;
  targetTeamId?: string | null;
  twoFactorToken?: string;
};
