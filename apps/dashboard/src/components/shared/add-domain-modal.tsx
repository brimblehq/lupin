import { useEffect, useRef, useState, useCallback } from "react";
import { Search, SlidersHorizontal, Plus, ArrowRightLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "./modal";
import { Dropdown } from "./dropdown";
import type { SettingsPaymentCard } from "@/backend/settings/types";
import type { PaymentMethod } from "@/backend/payments";
import { usePaymentMethods } from "@/hooks/use-payments";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { getDomainDetailsServerFn, transferInServerFn } from "@/server/domains/actions";
import { getPaymentMethodsServerFn } from "@/server/payments/actions";

interface Project {
  id: string;
  name: string;
}

export interface DomainValidationError {
  type: "already-owned" | "not-found" | "invalid" | "generic";
  message: string;
}

interface AddDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onContinue: (projectId: string, domainUrl: string) => void | Promise<void>;
  defaultRegistrantEmail?: string;
  paymentCards?: SettingsPaymentCard[];
  /** Called to validate the domain before submitting. Return null if valid, or an error. */
  onValidate?: (domainUrl: string) => DomainValidationError | null | Promise<DomainValidationError | null>;
  /** Called when user clicks "Register" for a domain that doesn't exist. */
  onRegisterDomain?: (domainUrl: string) => void;
  /** Open the modal directly on a specific step. */
  initialStep?: DomainStep;
}

function formatCardType(cardType?: string): string {
  if (!cardType) return "Card";
  const lower = cardType.toLowerCase();
  if (lower === "visa") return "Visa";
  if (lower === "mastercard" || lower === "mc") return "Mastercard";
  if (lower === "amex" || lower === "american_express") return "Amex";
  if (lower === "discover") return "Discover";
  return cardType.charAt(0).toUpperCase() + cardType.slice(1);
}

function CardChip() {
  return (
    <div className="relative h-8 w-[45px] shrink-0 overflow-hidden rounded-[4px] bg-[radial-gradient(circle_at_84%_10%,#5a5454_0%,#383636_55%,#1f1f1f_100%)] shadow-[0px_1px_1px_rgba(0,0,0,0.16),0px_1px_0px_rgba(0,0,0,0.11)]">
      <div className="absolute left-[5px] top-[12px] h-[7px] w-[10px] rounded-[1.5px] bg-white/10" />
      <div className="absolute bottom-[5px] right-[5px] flex items-center gap-0.5">
        <span className="size-[3px] rounded-full bg-[#ea4335]" />
        <span className="size-[3px] rounded-full bg-[#fbbc05]" />
      </div>
    </div>
  );
}

function getPreferredCardId(cards: SettingsPaymentCard[]): string {
  const preferred = cards.find((c) => c.preferred);
  return preferred?.id ?? cards[0]?.id ?? "";
}

function RadioButton({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span className="flex size-[14px] items-center justify-center rounded-full bg-[#008cff] shadow-[0px_1px_2px_rgba(0,110,225,0.5),0px_0px_0px_1px_#006ee1]">
        <span className="size-[6px] rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span className="size-[14px] rounded-full bg-white shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#29292a] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]" />
  );
}

import { DomainStep } from "../../types/enums";

const rootRoute = getRouteApi("__root__");

function normalizeDomainInput(value: string): string {
  return value.trim().toLowerCase();
}

function isReservedBrimbleSubdomain(value: string): boolean {
  const normalized = normalizeDomainInput(value);
  if (!normalized) {
    return false;
  }

  if (normalized.endsWith(".brimble.app")) {
    return true;
  }

  if (normalized.endsWith(".brimble.io")) {
    return true;
  }

  return false;
}

export function AddDomainModal({
  open,
  onOpenChange,
  projects,
  onContinue,
  defaultRegistrantEmail,
  paymentCards = [],
  onValidate,
  onRegisterDomain,
  initialStep,
}: AddDomainModalProps) {
  const { paymentMethods: initialPaymentMethods } = (rootRoute.useLoaderData() ?? {}) as {
    paymentMethods?: PaymentMethod[] | null;
  };
  const { data: paymentMethods = [] } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const livePaymentCards: SettingsPaymentCard[] = paymentMethods.map((method: any) => ({
    id: method.id,
    cardType: method.card?.brand ?? method.brand,
    last4: method.card?.last4 ?? method.last4,
    preferred: method.is_default,
  }));
  const availablePaymentCards = livePaymentCards.length > 0 ? livePaymentCards : paymentCards;
  const [step, setStep] = useState<DomainStep>(initialStep ?? DomainStep.SelectProject);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domainUrl, setDomainUrl] = useState("");
  const [error, setError] = useState<DomainValidationError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transferDomain, setTransferDomain] = useState("");
  const [transferDomainError, setTransferDomainError] = useState<string | null>(null);
  const [transferDomainVerified, setTransferDomainVerified] = useState(false);
  const [validatingTransferDomain, setValidatingTransferDomain] = useState(false);
  const [transferAuthCode, setTransferAuthCode] = useState("");
  const [transferRegistrantEmail, setTransferRegistrantEmail] = useState(defaultRegistrantEmail?.trim() ?? "");
  const [transferCardId, setTransferCardId] = useState(() => getPreferredCardId(availablePaymentCards));
  const [transferChecklist, setTransferChecklist] = useState({
    domainUnlocked: false,
    registrantEmailAccess: false,
    acknowledgeTransferTime: false,
  });

  useEffect(() => {
    if (open && initialStep) {
      setStep(initialStep);
    }
  }, [open, initialStep]);

  useEffect(() => {
    const preferredCardId = getPreferredCardId(availablePaymentCards);
    if (!preferredCardId) {
      if (transferCardId) {
        setTransferCardId("");
      }
      return;
    }

    const cardStillExists = availablePaymentCards.some((card) => card.id === transferCardId);
    if (!transferCardId || !cardStillExists) {
      setTransferCardId(preferredCardId);
    }
  }, [availablePaymentCards, transferCardId]);

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name ?? "";

  function handleStepOneContinue() {
    if (selectedProject) {
      setStep(DomainStep.EnterDomain);
    }
  }

  function handleTransferStepOpen() {
    setStep(DomainStep.TransferIn);
  }

  async function handleStepTwoContinue() {
    if (!selectedProject || !domainUrl.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    const normalizedDomain = normalizeDomainInput(domainUrl);

    if (isReservedBrimbleSubdomain(normalizedDomain)) {
      setError({
        type: "invalid",
        message: "Brimble-managed subdomains are reserved and cannot be added manually.",
      });
      setSubmitting(false);
      return;
    }

    try {
      if (onValidate) {
        const validationError = await onValidate(normalizedDomain);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      setError(null);
      await onContinue(selectedProject, normalizedDomain);
      resetAndClose();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDomainChange(value: string) {
    setDomainUrl(value);
    if (error) setError(null);
  }

  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);

  const validateTransferDomainImmediate = useCallback(
    async (value: string) => {
      validateAbortRef.current?.abort();
      const controller = new AbortController();
      validateAbortRef.current = controller;

      const normalized = normalizeDomainInput(value);
      if (!normalized) {
        setTransferDomainError(null);
        setTransferDomainVerified(false);
        setValidatingTransferDomain(false);
        return;
      }

      if (isReservedBrimbleSubdomain(normalized)) {
        setTransferDomainError("Brimble subdomains cannot be transferred in.");
        setTransferDomainVerified(false);
        setValidatingTransferDomain(false);
        return;
      }

      setValidatingTransferDomain(true);
      setTransferDomainVerified(false);
      try {
        const workspace = new URLSearchParams(searchStr).get("workspace") || undefined;
        const domain = await getDomainDetailsServerFn({
          data: { workspace, domainName: normalized },
        });

        if (controller.signal.aborted) return;

        if (domain?.purchased) {
          setTransferDomainError("This domain was purchased on Brimble and cannot be transferred in.");
          return;
        }

        if (domain) {
          setTransferDomainError("This domain already exists on Brimble.");
          return;
        }

        setTransferDomainError(null);
        setTransferDomainVerified(true);
      } catch {
        if (controller.signal.aborted) return;
        setTransferDomainError(null);
        setTransferDomainVerified(true);
      } finally {
        if (!controller.signal.aborted) {
          setValidatingTransferDomain(false);
        }
      }
    },
    [searchStr],
  );

  function scheduleTransferDomainValidation(value: string) {
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(() => {
      void validateTransferDomainImmediate(value);
    }, 600);
  }

  async function handleTransferInContinue() {
    if (submitting) {
      return;
    }

    const normalizedTransferDomain = normalizeDomainInput(transferDomain);
    if (!normalizedTransferDomain) {
      return;
    }

    if (isReservedBrimbleSubdomain(normalizedTransferDomain)) {
      toast.error("Brimble-managed subdomains cannot be transferred in.");
      return;
    }

    const authCode = transferAuthCode.trim();
    if (!authCode) {
      toast.error("Auth code is required");
      return;
    }

    try {
      const latestMethods = await getPaymentMethodsServerFn();
      const methods = Array.isArray(latestMethods) ? latestMethods : [];
      const latestDefaultMethod = methods.find((method: any) => method.is_default) ?? methods[0];
      if (!latestDefaultMethod?.id) {
        toast.error("Add a payment method before transferring a domain.");
        return;
      }

      if (!methods.some((method: any) => method.id === transferCardId)) {
        setTransferCardId(latestDefaultMethod.id);
      }
    } catch {
      toast.error("Unable to verify your payment method right now.");
      return;
    }

    setSubmitting(true);
    try {
      const workspace = new URLSearchParams(searchStr).get("workspace") || undefined;
      const result = await transferInServerFn({
        data: {
          workspace,
          name: normalizedTransferDomain,
          authCode,
          duration: 1,
          privacyEnabled: true,
          autoRenewal: true,
          projectId: selectedProject || undefined,
        },
      });

      if (result.reversed) {
        toast.error("Domain transfer failed. A refund has been processed.");
      } else {
        toast.success("Domain transfer initiated. This may take several days to complete.");
      }
      resetAndClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate domain transfer");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndClose() {
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateAbortRef.current?.abort();
    onOpenChange(false);
    setStep(DomainStep.SelectProject);
    setSelectedProject(null);
    setSearch("");
    setDomainUrl("");
    setError(null);
    setTransferDomain("");
    setTransferDomainError(null);
    setTransferDomainVerified(false);
    setValidatingTransferDomain(false);
    setTransferAuthCode("");
    setTransferRegistrantEmail(defaultRegistrantEmail?.trim() ?? "");
    setTransferCardId(getPreferredCardId(availablePaymentCards));
    setTransferChecklist({
      domainUnlocked: false,
      registrantEmailAccess: false,
      acknowledgeTransferTime: false,
    });
    setSubmitting(false);
  }

  const canSubmitTransferIn = Boolean(
    normalizeDomainInput(transferDomain) &&
    transferDomainVerified &&
    !transferDomainError &&
    !validatingTransferDomain &&
    transferAuthCode.trim() &&
    transferRegistrantEmail.trim() &&
    transferChecklist.domainUnlocked &&
    transferChecklist.registrantEmailAccess &&
    transferChecklist.acknowledgeTransferTime,
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetAndClose();
    } else {
      onOpenChange(true);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={500}>
      <ModalHeader
        title={step === DomainStep.TransferIn ? "Transfer Domain" : "Add Domain"}
        description={
          step === DomainStep.TransferIn
            ? "Transfer an existing domain from another registrar to Brimble"
            : "Select a project to add your domain to"
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === DomainStep.SelectProject ? (
          <motion.div
            key="select-project"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search bar */}
            <div className="flex items-center gap-2 border-b-[0.5px] border-[#e5e5e5] px-4 py-2.5 dark:border-dash-border">
              <Search className="size-4 shrink-0 text-dash-text-extra-faded" />
              <input
                type="text"
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
              />
              <button className="shrink-0 text-dash-text-extra-faded transition-colors hover:text-dash-text-faded">
                <SlidersHorizontal className="size-4" />
              </button>
            </div>

            {/* Project list */}
            <div className="scrollbar-hidden max-h-[280px] overflow-y-auto">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-dash-bg-elevated"
                >
                  <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
                  <span className="flex-1 text-left text-sm text-dash-text-strong">{project.name}</span>
                  <RadioButton selected={selectedProject === project.id} />
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="flex h-20 items-center justify-center">
                  <span className="text-sm text-dash-text-faded">No projects found</span>
                </div>
              )}
            </div>

            {/* Purchase a domain row */}
            <Link
              to={
                withWorkspaceQuery({
                  pathname: "/domains/buy",
                  searchStr,
                }) as any
              }
              onClick={() => resetAndClose()}
              className="flex w-full items-center gap-3 border-t-[0.5px] border-[#e5e5e5] bg-dash-bg-elevated px-4 py-3 transition-colors hover:bg-[#f0f0f0] dark:border-dash-border dark:hover:bg-[#333]"
            >
              <div className="flex size-6 items-center justify-center rounded-full border border-dash-border-soft bg-dash-bg-elevated">
                <Plus className="size-3 text-dash-text-faded" />
              </div>
              <span className="text-sm text-dash-text-strong">Purchase a domain</span>
            </Link>

            <button
              type="button"
              onClick={handleTransferStepOpen}
              className="flex w-full items-center gap-3 border-t-[0.5px] border-[#e5e5e5] bg-dash-bg-elevated px-4 py-3 text-left transition-colors hover:bg-[#f0f0f0] dark:border-dash-border dark:hover:bg-[#333]"
            >
              <div className="flex size-6 items-center justify-center rounded-full border border-dash-border-soft bg-dash-bg-elevated">
                <ArrowRightLeft className="size-3 text-dash-text-faded" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-dash-text-strong">Transfer a domain to Brimble</span>
                <span className="text-xs text-dash-text-faded">Bring your domain from GoDaddy, Namecheap, and others</span>
              </div>
            </button>
          </motion.div>
        ) : step === DomainStep.EnterDomain ? (
          <motion.div
            key="enter-domain"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Selected project row */}
            <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e5e5] px-6 py-3.5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
                <span className="text-sm leading-5 tracking-[-0.0224px]">
                  <span className="font-light text-[#999] dark:text-dash-text-faded">Selected Project</span>{" "}
                  <span className="font-light text-dash-text-body">{selectedProjectName}</span>
                </span>
              </div>
              <RadioButton selected />
            </div>

            {/* Domain URL input */}
            <div className="px-6 pb-5 pt-3.5">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Domain URL</label>
                  <input
                    type="text"
                    placeholder="myawesomewebsite.com"
                    value={domainUrl}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (!domainUrl.trim() || !!error || submitting) return;
                      void handleStepTwoContinue();
                    }}
                    autoFocus
                    className={`w-full input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded ${
                      error
                        ? "shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)] dark:shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)]"
                        : "input-focus"
                    }`}
                  />
                </div>

                {/* Error message */}
                {error && (
                  <p className="text-sm font-light leading-5 text-[#e1291d]">
                    {error.message}
                    {error.type === "not-found" && onRegisterDomain && (
                      <>
                        {" "}
                        <button
                          onClick={() => onRegisterDomain(domainUrl.trim())}
                          className="font-normal underline transition-colors hover:text-[#c41f15]"
                        >
                          Register it now
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="transfer-in"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b-[0.5px] border-[#e5e5e5] px-6 py-3.5 dark:border-dash-border">
              <img src="/icons/folder-open.svg" alt="" className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-light leading-5 tracking-[-0.0224px] text-[#999] dark:text-dash-text-faded">
                  Destination Project
                </span>
                <p className="truncate text-sm font-light leading-5 text-dash-text-body">{selectedProjectName || "Not linked yet"}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(DomainStep.SelectProject)}
                className="shrink-0 text-xs font-medium text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
              >
                Change
              </button>
            </div>

            <div className="px-6 pb-5 pt-4">
              <div className="flex flex-col gap-4">
                <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                  <p className="text-sm font-medium text-dash-text-strong">Transfer domain to Brimble</p>
                  <p className="mt-1 text-xs leading-4 text-dash-text-faded">
                    Enter your domain details and EPP/Auth code. Linking a project is optional and can be done now or later.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Domain name</label>
                  <div
                    className={`flex items-center rounded-[6px] border-[0.5px] bg-gradient-to-b from-dash-bg to-dash-bg-elevated px-3 py-2 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.03)] ${
                      transferDomainError
                        ? "border-[#e1291d] shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)]"
                        : "border-dash-border"
                    }`}
                  >
                    <input
                      type="text"
                      placeholder="example.com"
                      value={transferDomain}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransferDomain(val);
                        if (transferDomainError) setTransferDomainError(null);
                        if (transferDomainVerified) setTransferDomainVerified(false);
                        scheduleTransferDomainValidation(val);
                      }}
                      onBlur={() => {
                        if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
                        void validateTransferDomainImmediate(transferDomain);
                      }}
                      className="w-full bg-transparent text-[13px] text-dash-text-strong outline-none placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded"
                    />
                    {validatingTransferDomain && <Loader2 className="size-4 shrink-0 animate-spin text-dash-text-faded" />}
                  </div>
                  {transferDomainError && <p className="text-sm font-light leading-5 text-[#e1291d]">{transferDomainError}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">EPP/Auth code</label>
                  <div className="rounded-[6px] border-[0.5px] border-dash-border bg-gradient-to-b from-dash-bg to-dash-bg-elevated px-3 py-2 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.03)]">
                    <input
                      type="text"
                      placeholder="Paste your authorization code"
                      value={transferAuthCode}
                      onChange={(e) => setTransferAuthCode(e.target.value)}
                      className="w-full bg-transparent font-mono text-[13px] text-dash-text-strong outline-none placeholder:font-sans placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Registrant email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={transferRegistrantEmail}
                    onChange={(e) => setTransferRegistrantEmail(e.target.value)}
                    className="input-base input-focus rounded-[4px] px-2 py-1.5 text-[13px] font-light leading-5 text-dash-text-strong placeholder:text-[#9ca3af] dark:placeholder:text-dash-text-extra-faded"
                  />
                  <p className="text-xs text-dash-text-faded">You can change it if the registrant email is different.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Payment method</label>
                  {availablePaymentCards.length > 0 ? (
                    availablePaymentCards.length === 1 ? (
                      <div className="flex items-center gap-3 rounded-[4px] border-[0.5px] border-dash-border px-3.5 py-2.5">
                        <CardChip />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-dash-text-strong">
                            {formatCardType(availablePaymentCards[0].cardType)}
                          </span>
                          <span className="text-xs text-dash-text-faded">ending in {availablePaymentCards[0].last4 ?? "****"}</span>
                        </div>
                      </div>
                    ) : (
                      <Dropdown
                        value={transferCardId}
                        options={availablePaymentCards.map((card) => ({
                          id: card.id,
                          label: `${formatCardType(card.cardType)} ending in ${card.last4 ?? "****"}`,
                        }))}
                        onChange={setTransferCardId}
                        placeholder="Select payment card..."
                      />
                    )
                  ) : (
                    <div className="rounded-[4px] border-[0.5px] border-dash-border px-4 py-3">
                      <p className="text-sm text-dash-text-faded">
                        No payment card found. Add one in <span className="font-medium text-dash-text-strong">Settings</span>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-[8px] border border-dash-border bg-dash-bg-elevated px-4 py-3">
                  <p className="text-sm font-medium text-dash-text-strong">Before you continue</p>
                  <div className="mt-3 flex flex-col gap-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={transferChecklist.domainUnlocked}
                        onChange={(e) =>
                          setTransferChecklist((prev) => ({
                            ...prev,
                            domainUnlocked: e.target.checked,
                          }))
                        }
                        className="mt-0.5 size-4 rounded border-dash-border"
                      />
                      <span className="text-sm text-dash-text-body">My domain is unlocked at the current registrar.</span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={transferChecklist.registrantEmailAccess}
                        onChange={(e) =>
                          setTransferChecklist((prev) => ({
                            ...prev,
                            registrantEmailAccess: e.target.checked,
                          }))
                        }
                        className="mt-0.5 size-4 rounded border-dash-border"
                      />
                      <span className="text-sm text-dash-text-body">I can access the registrant email for transfer confirmation.</span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={transferChecklist.acknowledgeTransferTime}
                        onChange={(e) =>
                          setTransferChecklist((prev) => ({
                            ...prev,
                            acknowledgeTransferTime: e.target.checked,
                          }))
                        }
                        className="mt-0.5 size-4 rounded border-dash-border"
                      />
                      <span className="text-sm text-dash-text-body">I understand transfers may take several days to complete.</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalFooter>
        <ModalCancelButton />
        {step === DomainStep.SelectProject ? (
          <ModalContinueButton onClick={handleStepOneContinue} disabled={!selectedProject} />
        ) : step === DomainStep.EnterDomain ? (
          <ModalContinueButton
            onClick={() => {
              void handleStepTwoContinue();
            }}
            disabled={!domainUrl.trim() || !!error || submitting}
            loading={submitting}
            loadingLabel="Adding..."
          />
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(DomainStep.SelectProject)}
              className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
            >
              Back
            </button>
            <ModalContinueButton
              onClick={() => {
                void handleTransferInContinue();
              }}
              disabled={!canSubmitTransferIn || submitting}
              loading={submitting}
              loadingLabel="Preparing transfer..."
            >
              Start transfer
            </ModalContinueButton>
          </div>
        )}
      </ModalFooter>
    </Modal>
  );
}
