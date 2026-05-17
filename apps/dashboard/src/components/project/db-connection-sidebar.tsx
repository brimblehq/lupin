import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { decryptDatabaseConnectionUriServerFn } from "@/server/projects/actions";

interface ParsedConnection {
  protocol: string;
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
}

function parseConnectionUri(uri: string): ParsedConnection | null {
  try {
    const url = new URL(uri);
    return {
      protocol: url.protocol.replace(":", ""),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: url.port,
      database: url.pathname.replace("/", ""),
    };
  } catch {
    return null;
  }
}

interface DbConnectionCardProps {
  connectionUri?: string;
  isActive: boolean;
}

interface DbQuickActionsCardProps {
  onDownloadBackup?: () => void | Promise<void>;
  onRestart?: () => void | Promise<void>;
  hasBackup: boolean;
  canRestart: boolean;
  restarting?: boolean;
}

export function DbConnectionCard({ connectionUri, isActive }: DbConnectionCardProps) {
  const haptics = useHaptics();
  const decryptConnectionUri = useServerFn(decryptDatabaseConnectionUriServerFn as any) as (args: {
    data: { encryptedConnectionUri: string };
  }) => Promise<{ connectionUri: string }>;

  const [decryptedUri, setDecryptedUri] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);

  const ensureDecrypted = useCallback(async (): Promise<string> => {
    if (!connectionUri) throw new Error("Connection URI not available.");
    if (decryptedUri) return decryptedUri;
    setDecrypting(true);
    try {
      const result = await decryptConnectionUri({
        data: { encryptedConnectionUri: connectionUri },
      });
      const next = result?.connectionUri?.trim();
      if (!next) throw new Error("Failed to decrypt connection URI");
      setDecryptedUri(next);
      return next;
    } finally {
      setDecrypting(false);
    }
  }, [connectionUri, decryptConnectionUri, decryptedUri]);

  useEffect(() => {
    if (!isActive || !connectionUri || decryptedUri || decrypting) return;
    void ensureDecrypted().catch(() => undefined);
  }, [connectionUri, decryptedUri, decrypting, ensureDecrypted, isActive]);

  useEffect(() => {
    setDecryptedUri("");
    setShowPassword(false);
  }, [connectionUri]);

  const parsed = decryptedUri ? parseConnectionUri(decryptedUri) : null;

  async function handleCopyField(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      haptics.light();
      setFieldCopied(label);
      window.setTimeout(() => setFieldCopied(null), 1200);
    } catch {
      haptics.error();
      toast.error("Couldn't copy");
    }
  }

  function handleToggleReveal() {
    if (!decryptedUri && !decrypting) {
      void ensureDecrypted().catch(() => undefined);
    }
    setShowPassword((v) => !v);
    haptics.selection();
  }

  return (
    <div className="flex flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
        <span className="text-dash-text-strong">Connection</span>
        <div className="flex items-center gap-2">
          {parsed && (
            <button
              type="button"
              onClick={handleToggleReveal}
              className="text-dash-text-faded transition-colors hover:text-dash-text-strong"
              title={showPassword ? "Hide password" : "Reveal password"}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {!isActive ? (
          <p className="text-xs font-light text-dash-text-faded">Connection details become available once the database is active.</p>
        ) : !connectionUri ? (
          <p className="text-xs font-light text-dash-text-faded">Waiting for the database to provision its connection URI.</p>
        ) : !parsed ? (
          <ConnectionFieldsSkeleton />
        ) : (
          <div className="flex flex-col divide-y divide-dash-border-soft">
            <ConnectionField
              label="Host"
              value={parsed.host}
              copied={fieldCopied === "Host"}
              onCopy={() => void handleCopyField("Host", parsed.host)}
            />
            <ConnectionField
              label="Port"
              value={parsed.port}
              copied={fieldCopied === "Port"}
              onCopy={() => void handleCopyField("Port", parsed.port)}
            />
            {parsed.database && (
              <ConnectionField
                label="Database"
                value={parsed.database}
                copied={fieldCopied === "Database"}
                onCopy={() => void handleCopyField("Database", parsed.database)}
              />
            )}
            <ConnectionField
              label="User"
              value={parsed.user}
              copied={fieldCopied === "User"}
              onCopy={() => void handleCopyField("User", parsed.user)}
            />
            <ConnectionField
              label="Password"
              value={showPassword ? parsed.password : "••••••••"}
              copied={fieldCopied === "Password"}
              onCopy={() => void handleCopyField("Password", parsed.password)}
              mono
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function DbQuickActionsCard({ onDownloadBackup, onRestart, hasBackup, canRestart, restarting = false }: DbQuickActionsCardProps) {
  return (
    <div className="flex flex-col overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex h-10 items-center border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
        <span className="text-dash-text-strong">Quick actions</span>
      </div>
      <div className="flex flex-col">
        <ActionButton
          icon={<img src="/icons/download.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />}
          label="Download backup"
          disabled={!hasBackup}
          disabledHint={hasBackup ? undefined : "No backup available yet"}
          onClick={onDownloadBackup}
        />
        <ActionButton
          icon={<img src="/icons/restart.svg" alt="" aria-hidden="true" className="size-4 invert dark:invert-0" />}
          label={restarting ? "Restarting..." : "Restart database"}
          disabled={!canRestart || restarting}
          danger
          onClick={onRestart}
        />
      </div>
    </div>
  );
}

function ConnectionField({
  label,
  value,
  copied,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-dash-text-faded">{label}</span>
      <div className="flex items-start gap-2">
        <span title={value} className={`min-w-0 flex-1 break-all text-sm leading-[1.4] text-dash-text-strong ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="mt-0.5 shrink-0 text-dash-text-extra-faded transition-colors hover:text-dash-text-strong"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="size-3.5 text-[#22c55e]" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  disabledHint,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  disabledHint?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick?.();
      }}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={`flex items-center gap-2.5 border-b-[0.5px] border-dash-border-soft px-3.5 py-3 text-sm font-light text-dash-text-body transition-colors last:border-b-0 hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "hover:text-[#ef2f1f]" : "hover:text-dash-text-strong"
      }`}
    >
      <span className={danger ? "text-[#ef2f1f]/70" : "text-dash-text-extra-faded"}>{icon}</span>
      {label}
    </button>
  );
}

function ConnectionFieldsSkeleton() {
  const fieldWidths = ["w-48", "w-12", "w-24", "w-20", "w-16"];
  return (
    <div className="flex flex-col divide-y divide-dash-border-soft">
      {fieldWidths.map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5 py-2.5">
          <div className="h-2.5 w-10 animate-pulse rounded bg-dash-border-soft" />
          <div className={`h-3.5 ${w} animate-pulse rounded bg-dash-border-soft`} />
        </div>
      ))}
    </div>
  );
}
