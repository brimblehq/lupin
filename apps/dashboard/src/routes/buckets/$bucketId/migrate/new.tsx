import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { getBucketDetailsServerFn, startStorageMigrationServerFn } from "@/server/storage/actions";
import { parseWorkspaceSearchValue, workspacePageLoaderDeps } from "@/utils/workspace-route-search";
import { GlossyButton } from "@/components/shared/glossy-button";
import { DashInput, dashInputBaseClassName, dashInputClassName } from "@/components/shared/dash-input";
import { Dropdown, type DropdownOption } from "@/components/shared/dropdown";
import { ToggleSwitch } from "@/components/shared/toggle-switch";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { MIGRATION_PROVIDERS, type MigrationProviderId } from "@/lib/storage/migration-providers";
import { validateS3SourceBucket } from "@/lib/storage/validate-s3-source";

export const Route = createFileRoute("/buckets/$bucketId/migrate/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const workspace = parseWorkspaceSearchValue(search.workspace);
    return workspace ? { workspace } : {};
  },
  loaderDeps: ({ search }) => workspacePageLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;
    const bucket = await getBucketDetailsServerFn({ data: { workspace, bucketId: params.bucketId } }).catch(() => null);
    return { workspace, bucket };
  },
  component: NewMigrationPage,
});

const PROVIDER_OPTIONS: DropdownOption[] = MIGRATION_PROVIDERS.map((p) => ({ id: p.id, label: p.name }));

type EnvKey = "AWS_ACCESS_KEY_ID" | "AWS_SECRET_ACCESS_KEY" | "AWS_ENDPOINT_URL_S3" | "AWS_REGION";

const ALLOWED_ENV_KEYS: ReadonlySet<EnvKey> = new Set<EnvKey>([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
]);

const REQUIRED_ENV_KEYS: readonly EnvKey[] = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];

const ENV_LINE_RE = /^(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=\s*(.*)$/;

const ENV_PLACEHOLDER = `AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ENDPOINT_URL_S3=https://s3.us-east-1.amazonaws.com`;

const SOURCE_VALIDATION_DEBOUNCE_MS = 500;
const SOURCE_BUCKET_VALID_CLASS_NAME = "border-[#13d282] focus:border-[#13d282] focus:ring-[#13d282]/25";

interface EnvParseResult {
  values: Partial<Record<EnvKey, string>>;
  errors: string[];
  parsedKeys: EnvKey[];
}

function parseEnvBlock(text: string): EnvParseResult {
  const values: Partial<Record<EnvKey, string>> = {};
  const errors: string[] = [];
  const parsedKeys: EnvKey[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(ENV_LINE_RE);
    if (!match) {
      errors.push(`Could not parse: ${line.slice(0, 60)}`);
      continue;
    }
    const key = match[1];
    if (!ALLOWED_ENV_KEYS.has(key as EnvKey)) {
      errors.push(`Unknown key: ${key}`);
      continue;
    }
    let value = match[2].trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (!value) {
      errors.push(`${key} is empty`);
      continue;
    }
    values[key as EnvKey] = value;
    parsedKeys.push(key as EnvKey);
  }
  if (text.trim().length > 0) {
    for (const required of REQUIRED_ENV_KEYS) {
      if (!values[required]) errors.push(`Missing required key: ${required}`);
    }
  }
  return { values, errors, parsedKeys };
}

function NewMigrationPage() {
  const router = useRouter();
  const { workspace, bucket } = Route.useLoaderData();
  const { bucketId } = Route.useParams();
  const startMigration = useServerFn(startStorageMigrationServerFn);

  const [providerId, setProviderId] = useState<MigrationProviderId>("aws-s3");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");
  const [sourceBucket, setSourceBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [pasteMode, setPasteMode] = useState(false);
  const [envText, setEnvText] = useState("");
  const [envErrors, setEnvErrors] = useState<string[]>([]);

  const [sourcePrefix, setSourcePrefix] = useState("");
  const [destPrefix, setDestPrefix] = useState("");

  const [starting, setStarting] = useState(false);
  const [sourceValidation, setSourceValidation] = useState<{
    status: "idle" | "checking" | "valid" | "invalid";
    message: string;
  }>({
    status: "idle",
    message: "Enter source details to validate the bucket.",
  });

  const provider = MIGRATION_PROVIDERS.find((p) => p.id === providerId)!;
  const bucketName = bucket?.name || "this bucket";
  const requiredFilled = Boolean(sourceBucket.trim() && region.trim() && accessKeyId.trim() && secretAccessKey.trim());
  const sourceValidationBlocked = pasteMode && envErrors.length > 0;
  const sourceValidationKey = useMemo(() => {
    return [sourceBucket.trim(), region.trim(), endpoint.trim(), accessKeyId.trim(), secretAccessKey.trim()].join("\n");
  }, [accessKeyId, endpoint, region, secretAccessKey, sourceBucket]);
  const sourceValidated = sourceValidation.status === "valid";
  const sourceChecking = sourceValidation.status === "checking";
  const sourceBucketInputClassName = sourceValidated ? SOURCE_BUCKET_VALID_CLASS_NAME : undefined;

  function handleProviderChange(id: string) {
    const next = MIGRATION_PROVIDERS.find((p) => p.id === id);
    if (!next) return;
    setProviderId(next.id);
  }

  function handleEnvTextChange(text: string) {
    setEnvText(text);
    const result = parseEnvBlock(text);
    setEnvErrors(result.errors);
    if (result.values.AWS_ACCESS_KEY_ID !== undefined) setAccessKeyId(result.values.AWS_ACCESS_KEY_ID);
    if (result.values.AWS_SECRET_ACCESS_KEY !== undefined) setSecretAccessKey(result.values.AWS_SECRET_ACCESS_KEY);
    if (result.values.AWS_ENDPOINT_URL_S3 !== undefined) setEndpoint(result.values.AWS_ENDPOINT_URL_S3);
    if (result.values.AWS_REGION !== undefined) setRegion(result.values.AWS_REGION);
  }

  function handlePasteModeChange(next: boolean) {
    setPasteMode(next);
    if (!next) {
      setEnvErrors([]);
    }
  }

  useEffect(() => {
    if (sourceValidationBlocked) {
      setSourceValidation({ status: "invalid", message: "Fix the pasted environment values before validating." });
      return;
    }

    if (!requiredFilled) {
      setSourceValidation({ status: "idle", message: "Enter source details to validate the bucket." });
      return;
    }

    let active = true;
    setSourceValidation({ status: "checking", message: "Validating source bucket..." });

    const timeout = window.setTimeout(() => {
      void validateS3SourceBucket({
        bucket: sourceBucket,
        region,
        endpoint,
        accessKeyId,
        secretAccessKey,
      }).then((result) => {
        if (!active) return;
        setSourceValidation({
          status: result.valid ? "valid" : "invalid",
          message: result.message,
        });
      });
    }, SOURCE_VALIDATION_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [accessKeyId, endpoint, region, requiredFilled, secretAccessKey, sourceBucket, sourceValidationBlocked, sourceValidationKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceValidated) return;
    try {
      setStarting(true);
      await startMigration({
        data: {
          workspace,
          bucketId,
          sourceBucket: sourceBucket.trim(),
          sourceRegion: region.trim(),
          sourceEndpoint: endpoint.trim() || undefined,
          accessKeyId: accessKeyId.trim(),
          secretAccessKey: secretAccessKey.trim(),
          sourcePrefix: sourcePrefix.trim() || undefined,
          destinationPrefix: destPrefix.trim() || undefined,
        },
      });
      toast.success("Migration started");
      await router.navigate({
        to: "/buckets/$bucketId/migrate",
        params: { bucketId },
        search: workspace ? { workspace } : {},
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start migration");
      setStarting(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-8">
          <Link
            to="/buckets/$bucketId/migrate"
            params={{ bucketId }}
            search={workspace ? { workspace } : {}}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            <ArrowLeft className="size-4" />
            Back to migrations
          </Link>
          <h1 className="text-xl font-medium text-dash-text-strong">New migration</h1>
          <p className="mt-1 text-sm text-dash-text-faded">
            Import data into <span className="font-medium text-dash-text-body">{bucketName}</span> from any S3-compatible source. We only
            read from the source — nothing is deleted.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Section
            title="Source"
            description="Where the data is coming from."
            headerRight={
              <label className="flex cursor-pointer items-center gap-2 text-xs text-dash-text-faded">
                Paste env
                <ToggleSwitch checked={pasteMode} onChange={handlePasteModeChange} size="sm" />
              </label>
            }
          >
            <Field label="Provider">
              <Dropdown value={providerId} options={PROVIDER_OPTIONS} onChange={handleProviderChange} />
            </Field>

            <AnimatePresence mode="wait" initial={false}>
              {pasteMode ? (
                <motion.div
                  key="paste"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-4"
                >
                  <Field label="Source bucket">
                    <DashInput
                      value={sourceBucket}
                      onChange={(e) => setSourceBucket(e.target.value)}
                      placeholder="my-source-bucket"
                      autoComplete="off"
                      spellCheck={false}
                      className={sourceBucketInputClassName}
                    />
                  </Field>

                  <Field label="Environment variables" hint="Follow the format shown in the placeholder.">
                    <textarea
                      value={envText}
                      onChange={(e) => handleEnvTextChange(e.target.value)}
                      placeholder={ENV_PLACEHOLDER}
                      rows={6}
                      spellCheck={false}
                      autoComplete="off"
                      className={`${dashInputBaseClassName} w-full resize-y font-mono text-[12px] leading-[1.5]`}
                    />
                    {envText.trim().length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {envErrors.length > 0 ? (
                          <ul className="flex flex-col gap-0.5 rounded-[4px] bg-[#ef2f1f]/10 px-3 py-2">
                            {envErrors.map((err, i) => (
                              <li key={i} className="text-xs text-[#ef2f1f]">
                                {err}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-dash-text-faded">
                            <Check className="size-3.5 text-[#13d282]" />
                            Looks good
                          </div>
                        )}
                      </div>
                    )}
                  </Field>
                </motion.div>
              ) : (
                <motion.div
                  key="fields"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-4"
                >
                  <Field label="Endpoint">
                    <DashInput
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder={provider.endpointHint}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Region">
                      <DashInput
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder={provider.regionHint}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Source bucket">
                      <DashInput
                        value={sourceBucket}
                        onChange={(e) => setSourceBucket(e.target.value)}
                        placeholder="my-source-bucket"
                        autoComplete="off"
                        spellCheck={false}
                        className={sourceBucketInputClassName}
                      />
                    </Field>
                  </div>

                  <Field label="Access key ID">
                    <DashInput
                      value={accessKeyId}
                      onChange={(e) => setAccessKeyId(e.target.value)}
                      placeholder="AKIA..."
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>

                  <Field label="Secret access key" hint="Stored encrypted. Only used to read from your source bucket.">
                    <div className="relative">
                      <input
                        type={showSecret ? "text" : "password"}
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        spellCheck={false}
                        className={`${dashInputClassName} pr-10 font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((s) => !s)}
                        aria-label={showSecret ? "Hide secret" : "Show secret"}
                        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                      >
                        {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            {sourceValidation.message && (
              <div className="flex items-center gap-1.5 text-xs text-dash-text-faded">
                {sourceValidated && <Check className="size-3.5 text-[#13d282]" />}
                {sourceChecking && <span className="size-2.5 animate-pulse rounded-full bg-[#ff7a00]" />}
                <span className={sourceValidation.status === "invalid" ? "text-[#ef2f1f]" : undefined}>{sourceValidation.message}</span>
              </div>
            )}
          </Section>

          <Divider />

          <Section title="Scope" description="What to import and where it lands.">
            <Field label="Source prefix" hint="Leave blank to import every object in the source bucket.">
              <DashInput
                value={sourcePrefix}
                onChange={(e) => setSourcePrefix(e.target.value)}
                placeholder="optional, e.g. uploads/"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <Field label="Destination prefix" hint="Imported objects will land under this path in your bucket.">
              <DashInput
                value={destPrefix}
                onChange={(e) => setDestPrefix(e.target.value)}
                placeholder="optional, e.g. imports/"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </Section>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link
              to="/buckets/$bucketId/migrate"
              params={{ bucketId }}
              search={workspace ? { workspace } : {}}
              className="text-sm text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              Cancel
            </Link>
            <GlossyButton
              type="submit"
              variant="black"
              disabled={!sourceValidated || starting}
              loading={starting}
              loadingLabel="Starting..."
            >
              Start migration
            </GlossyButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  headerRight,
  children,
}: {
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-dash-text-strong">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-dash-text-faded">{description}</p> : null}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-dash-text-body">{label}</label>
      {children}
      {hint && <p className="text-xs text-dash-text-faded">{hint}</p>}
    </div>
  );
}

function Divider() {
  return <hr className="my-6 border-dash-border-soft" />;
}
