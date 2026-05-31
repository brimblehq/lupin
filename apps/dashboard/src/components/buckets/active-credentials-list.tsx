import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { formatRelativeTime } from "@/utils/dashboard";
import type { StorageCredentialRecord } from "@/backend/storage";

const COPY_SUCCESS_MS = 1500;

interface ActiveCredentialsListProps {
  credentials: StorageCredentialRecord[];
  loading: boolean;
  canWrite: boolean;
  revokingId: string | null;
  onRevoke: (credential: StorageCredentialRecord) => void;
}

export function ActiveCredentialsList({ credentials, loading, canWrite, revokingId, onRevoke }: ActiveCredentialsListProps) {
  if (credentials.length === 0) {
    if (loading) {
      return <div className="border-y-[0.5px] border-dash-border py-8 text-sm text-dash-text-faded">Loading credentials…</div>;
    }
    return (
      <div className="flex flex-col gap-1 border-y-[0.5px] border-dash-border py-8">
        <span className="text-sm text-dash-text-faded">No active credentials</span>
        {canWrite && <span className="text-xs text-dash-text-extra-faded">Create one to access this bucket from your apps.</span>}
      </div>
    );
  }

  return (
    <ul className="border-t-[0.5px] border-dash-border">
      {credentials.map((credential) => (
        <CredentialRow
          key={credential.id}
          credential={credential}
          canWrite={canWrite}
          revoking={revokingId === credential.id}
          onRevoke={() => onRevoke(credential)}
        />
      ))}
    </ul>
  );
}

interface CredentialRowProps {
  credential: StorageCredentialRecord;
  canWrite: boolean;
  revoking: boolean;
  onRevoke: () => void;
}

function CredentialRow({ credential, canWrite, revoking, onRevoke }: CredentialRowProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(credential.accessKeyId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPY_SUCCESS_MS);
  }

  return (
    <li className="flex items-center gap-4 border-b-[0.5px] border-dash-border py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-sm leading-[1.3]">
          <span className="truncate font-medium text-dash-text-strong">{credential.name}</span>
          <span className="text-dash-text-extra-faded">·</span>
          <span className="text-dash-text-faded">{credential.role}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs leading-[1.3] text-dash-text-faded">
          <code className="truncate font-mono">{credential.accessKeyId}</code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Access key copied" : "Copy access key"}
            className="shrink-0 rounded p-0.5 text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            {copied ? <Check className="size-3 text-[#13d282]" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>
      <span className="shrink-0 text-xs text-dash-text-faded">{formatRelativeTime(credential.createdAt)}</span>
      {canWrite && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="shrink-0 text-sm text-red-500 transition-colors hover:text-red-400 disabled:opacity-50"
        >
          {revoking ? "Revoking…" : "Revoke"}
        </button>
      )}
    </li>
  );
}
