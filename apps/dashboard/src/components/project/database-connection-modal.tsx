import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  Modal,
  ModalCancelButton,
  ModalFooter,
  ModalHeader,
} from "../shared/modal";
import { decryptDatabaseConnectionUriServerFn } from "@/server/projects/actions";
import { maskSecretWithAsterisks } from "@/utils/dashboard";

interface DatabaseConnectionModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionUri?: string;
  isActive: boolean;
}

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

function getEnvPrefix(protocol: string): Record<string, string> {
  const p = protocol.toLowerCase();
  if (p === "mysql") {
    return { HOST: "MYSQL_HOST", PORT: "MYSQL_PORT", DATABASE: "MYSQL_DATABASE", USER: "MYSQL_USER", PASSWORD: "MYSQL_PASSWORD" };
  }
  if (p === "mongodb" || p === "mongodb+srv") {
    return { HOST: "MONGO_HOST", PORT: "MONGO_PORT", DATABASE: "MONGO_DATABASE", USER: "MONGO_USER", PASSWORD: "MONGO_PASSWORD" };
  }
  if (p === "redis" || p === "rediss") {
    return { HOST: "REDIS_HOST", PORT: "REDIS_PORT", DATABASE: "REDIS_DATABASE", USER: "REDIS_USER", PASSWORD: "REDIS_PASSWORD" };
  }
  return { HOST: "PGHOST", PORT: "PGPORT", DATABASE: "PGDATABASE", USER: "PGUSER", PASSWORD: "PGPASSWORD" };
}

function buildParamsText(parsed: ParsedConnection, showPassword: boolean): string {
  const prefix = getEnvPrefix(parsed.protocol);
  const pw = showPassword ? parsed.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return [
    `${prefix.HOST}=${parsed.host}`,
    `${prefix.PORT}=${parsed.port}`,
    `${prefix.DATABASE}=${parsed.database}`,
    `${prefix.USER}=${parsed.user}`,
    `${prefix.PASSWORD}=${pw}`,
  ].join("\n");
}

function buildCopyableParams(parsed: ParsedConnection): string {
  const prefix = getEnvPrefix(parsed.protocol);
  return [
    `${prefix.HOST}=${parsed.host}`,
    `${prefix.PORT}=${parsed.port}`,
    `${prefix.DATABASE}=${parsed.database}`,
    `${prefix.USER}=${parsed.user}`,
    `${prefix.PASSWORD}=${parsed.password}`,
  ].join("\n");
}

export function DatabaseConnectionModal({
  open,
  onOpenChange,
  connectionUri,
  isActive,
}: DatabaseConnectionModalProps) {
  const decryptConnectionUri = useServerFn(decryptDatabaseConnectionUriServerFn as any) as (args: {
    data: { encryptedConnectionUri: string };
  }) => Promise<{ connectionUri: string }>;
  const [uriCopied, setUriCopied] = useState(false);
  const [paramsCopied, setParamsCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string>("");
  const [decryptingUri, setDecryptingUri] = useState(false);

  const parsed = decryptedUri ? parseConnectionUri(decryptedUri) : null;

  async function ensureDecrypted(): Promise<string> {
    if (!connectionUri) {
      throw new Error("Connection URI not available yet.");
    }

    if (decryptedUri) {
      return decryptedUri;
    }

    setDecryptingUri(true);
    try {
      const result = await decryptConnectionUri({
        data: { encryptedConnectionUri: connectionUri },
      });
      const nextValue = result?.connectionUri?.trim();
      if (!nextValue) {
        throw new Error("Failed to decrypt database connection URI");
      }
      setDecryptedUri(nextValue);
      return nextValue;
    } finally {
      setDecryptingUri(false);
    }
  }

  async function handleRevealToggle() {
    if (decryptingUri) return;

    if (revealed) {
      setRevealed(false);
      return;
    }

    try {
      await ensureDecrypted();
      setRevealed(true);
    } catch (error: any) {
      toast.error("Failed to decrypt connection URI", {
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    }
  }

  async function handleCopyUri() {
    if (!connectionUri || decryptingUri) return;

    try {
      const decrypted = await ensureDecrypted();
      await navigator.clipboard.writeText(decrypted);
      setUriCopied(true);
      setTimeout(() => setUriCopied(false), 1500);
      toast.success("Connection URI copied");
    } catch (error: any) {
      toast.error("Failed to copy connection URI", {
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    }
  }

  async function handleCopyParams() {
    if (!connectionUri || decryptingUri) return;

    try {
      const decrypted = await ensureDecrypted();
      const p = parseConnectionUri(decrypted);
      if (!p) {
        toast.error("Could not parse connection URI");
        return;
      }
      await navigator.clipboard.writeText(buildCopyableParams(p));
      setParamsCopied(true);
      setTimeout(() => setParamsCopied(false), 1500);
      toast.success("Connection parameters copied");
    } catch (error: any) {
      toast.error("Failed to copy connection parameters", {
        description: typeof error?.message === "string" ? error.message : "Please try again.",
      });
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={560}>
      <ModalHeader
        title="Database Connection"
        description="Copy your connection details below."
      />

      <div className="flex flex-col gap-5 px-6 py-5">
        {!isActive && (
          <p className="text-xs text-dash-text-faded">
            Connection details are available when the database is active.
          </p>
        )}

        {/* Full URI */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.08em] text-dash-text-faded">
              Connection URI
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { void handleRevealToggle(); }}
                disabled={!connectionUri || decryptingUri}
                className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-40"
              >
                {decryptingUri ? (
                  <span className="inline-block size-3 animate-spin rounded-full border border-current border-t-transparent" />
                ) : revealed ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
                <span>{decryptingUri ? "Decrypting..." : revealed ? "Hide" : "Reveal"}</span>
              </button>
              <button
                onClick={() => { void handleCopyUri(); }}
                disabled={!connectionUri || decryptingUri}
                className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong disabled:opacity-40"
              >
                {uriCopied ? (
                  <Check className="size-3 text-[#13d282]" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{uriCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[6px] bg-[#222528]">
            <code className="block break-all px-4 py-3 font-family-mono text-[12px] leading-5 text-[#e8eaed]">
              {!connectionUri
                ? "Connection URI not available yet."
                : revealed && decryptedUri
                  ? decryptedUri
                  : maskSecretWithAsterisks(connectionUri)}
            </code>
          </div>
        </div>

        {/* Connection Parameters — only show once decrypted & parsed */}
        {parsed && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-dash-text-faded">
                Connection Parameters
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  <span>{showPassword ? "Hide" : "Reveal"}</span>
                </button>
                <button
                  onClick={() => { void handleCopyParams(); }}
                  className="flex items-center gap-1 text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
                >
                  {paramsCopied ? (
                    <Check className="size-3 text-[#13d282]" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{paramsCopied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[6px] bg-[#222528]">
              <pre className="px-4 py-3 font-family-mono text-[12px] leading-5 text-[#e8eaed]">
                {buildParamsText(parsed, showPassword)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <span />
      </ModalFooter>
    </Modal>
  );
}
