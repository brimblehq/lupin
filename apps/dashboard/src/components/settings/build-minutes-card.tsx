import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useStripe } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "../shared/modal";
import { Dropdown, type DropdownOption } from "../shared/dropdown";
import { DashInput } from "../shared/dash-input";
import { usePaymentMethods, usePurchase } from "@/hooks/use-payments";
import { verifyTransactionServerFn } from "@/server/payments/actions";
import { resolveCardSummary } from "@/utils/billing";
import config from "@/config";
import type { PaymentMethod, VerifyTransactionResult } from "@/backend/payments";

const TOP_UP_PRESETS = [5, 10, 25, 50] as const;
const MIN_TOP_UP = 5;
const TOP_UP_DESCRIPTION = "Extra build minutes";

interface BuildMinutesCardProps {
  usedMinutes: number;
  includedMinutes: number;
  creditMinutes?: number;
  resetDate?: string | null;
  teamId?: string;
  initialPaymentMethods?: PaymentMethod[] | null;
}

export function BuildMinutesCard({
  usedMinutes,
  includedMinutes,
  creditMinutes = 0,
  resetDate,
  teamId,
  initialPaymentMethods,
}: BuildMinutesCardProps) {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const totalAvailable = includedMinutes + creditMinutes;
  const remaining = Math.max(0, totalAvailable - usedMinutes);
  const pct = includedMinutes > 0 ? Math.min(100, (usedMinutes / includedMinutes) * 100) : 0;
  const isOver = usedMinutes > includedMinutes;

  const formattedReset = resetDate
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(resetDate))
    : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-[2px]">
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Build minutes</p>
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
              {remaining.toLocaleString()} minutes left{formattedReset ? ` · resets ${formattedReset}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTopUpOpen(true)}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] border border-dash-border bg-dash-bg px-3 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
          >
            <Clock className="h-3.5 w-3.5" />
            Top up
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-text-body">Used this period</span>
            <span className="text-sm tabular-nums text-dash-text-faded">
              {usedMinutes.toLocaleString()} / {includedMinutes.toLocaleString()} min
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-dash-bg-elevated">
            <div
              className={`h-full rounded-full transition-all ${isOver ? "bg-[#f5a623]" : "bg-[#4879f8]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {creditMinutes > 0 && (
            <p className="text-xs text-dash-text-faded">+ {creditMinutes.toLocaleString()} minutes in top-up credits</p>
          )}
        </div>
      </div>

      <TopUpBuildMinutesModal open={topUpOpen} onOpenChange={setTopUpOpen} teamId={teamId} initialPaymentMethods={initialPaymentMethods} />
    </>
  );
}

function TopUpBuildMinutesModal({
  open,
  onOpenChange,
  teamId,
  initialPaymentMethods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  initialPaymentMethods?: PaymentMethod[] | null;
}) {
  const stripe = useStripe();
  const verifyTransaction = useServerFn(verifyTransactionServerFn as any) as (args: {
    data: { reference: string };
  }) => Promise<VerifyTransactionResult>;
  const { data: paymentMethods = [] } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const purchase = usePurchase();
  const defaultMethod: PaymentMethod | undefined = paymentMethods.find((m) => m.is_default) ?? paymentMethods[0];
  const hasPaymentMethod = paymentMethods.length > 0;
  const { brand: cardBrand, last4: cardLast4 } = resolveCardSummary(defaultMethod);
  const minutesPerDollar = config.buildMinutesTopUpPerDollar;
  const [verifying, setVerifying] = useState(false);

  const defaultAmount = TOP_UP_PRESETS[0];
  const defaultDisplay = defaultAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [custom, setCustom] = useState<string>(defaultDisplay);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setCustom(defaultDisplay);
    }
  }, [open, defaultAmount, defaultDisplay]);

  const minutesFor = (dollars: number) => Math.floor(dollars * minutesPerDollar);
  const isBelowMin = custom !== "" && amount > 0 && amount < MIN_TOP_UP;
  const isValid = hasPaymentMethod && amount >= MIN_TOP_UP && Number.isFinite(amount);

  const presetOptions: DropdownOption[] = TOP_UP_PRESETS.map((preset) => ({
    id: String(preset),
    label: `$${preset}.00`,
    asideText: `${minutesFor(preset).toLocaleString()} min`,
  }));
  const selectedPresetId = (TOP_UP_PRESETS as readonly number[]).includes(amount) ? String(amount) : "";

  function handlePresetSelect(id: string) {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setAmount(n);
    setCustom(formatCurrencyDisplay(n));
  }

  function normalizeCurrencyInput(raw: string): string {
    let cleaned = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      const head = cleaned.slice(0, firstDot + 1);
      const tail = cleaned
        .slice(firstDot + 1)
        .replace(/\./g, "")
        .slice(0, 2);
      cleaned = head + tail;
    }
    return cleaned;
  }

  function formatCurrencyDisplay(value: number): string {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function handleCustomChange(raw: string) {
    const cleaned = normalizeCurrencyInput(raw);
    setCustom(cleaned);
    const n = Number(cleaned);
    setAmount(Number.isFinite(n) ? n : 0);
  }

  function handleCustomFocus() {
    if (!custom) return;
    setCustom((prev) => prev.replace(/,/g, ""));
  }

  function handleCustomBlur() {
    if (!custom) return;
    const n = Number(custom.replace(/,/g, ""));
    if (!Number.isFinite(n)) return;
    setCustom(formatCurrencyDisplay(n));
  }

  async function handleConfirm() {
    if (!isValid) return;
    const minutes = minutesFor(amount);

    try {
      const result = await purchase.mutateAsync({
        type: "BUILD_MINUTES",
        amount,
        metadata: { description: TOP_UP_DESCRIPTION },
        ...(teamId ? { team_id: teamId } : {}),
      });

      if (result.status === "success") {
        toast.success(`Added ${minutes.toLocaleString()} build minutes`);
        onOpenChange(false);
        return;
      }

      if (!result.client_secret) {
        toast.error(result.message || "Payment requires confirmation but no client secret was returned");
        return;
      }

      if (!stripe) {
        toast.error("Stripe is not ready. Please try again.");
        return;
      }

      setVerifying(true);
      const { error } = await stripe.confirmCardPayment(result.client_secret);
      if (error) {
        toast.error(error.message || "Card authentication failed");
        return;
      }

      const verified: VerifyTransactionResult = await verifyTransaction({ data: { reference: result.reference } });
      if (verified.status !== "SUCCESSFUL") {
        toast.error(`Transaction ${verified.status.toLowerCase()}. Please try again.`);
        return;
      }

      toast.success(`Added ${minutes.toLocaleString()} build minutes`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Top up failed");
    } finally {
      setVerifying(false);
    }
  }

  const minutesPreview = amount > 0 ? minutesFor(amount).toLocaleString() : "0";

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={440}>
      <ModalHeader
        title="Top up build minutes"
        description={`${minutesPerDollar.toLocaleString()} minutes per $1 · credits never expire`}
      />

      <div className="flex flex-col gap-5 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-dash-text-body">Quick select</label>
          <Dropdown value={selectedPresetId} options={presetOptions} onChange={handlePresetSelect} placeholder="Choose a preset amount" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-dash-text-body" htmlFor="build-minutes-custom">
            Or enter amount
          </label>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isBelowMin ? "text-[#ef4444]" : "text-dash-text-faded"}`}>
              $
            </span>
            <DashInput
              id="build-minutes-custom"
              type="text"
              inputMode="decimal"
              value={custom}
              onChange={(e) => handleCustomChange(e.target.value)}
              onFocus={handleCustomFocus}
              onBlur={handleCustomBlur}
              placeholder={`${MIN_TOP_UP}.00`}
              className={`pl-6 tabular-nums ${
                isBelowMin
                  ? "!shadow-[0px_1px_2px_rgba(239,68,68,0.2),0px_0px_0px_1px_#ef4444] focus:!shadow-[0px_1px_2px_rgba(239,68,68,0.2),0px_0px_0px_2px_#ef4444]"
                  : ""
              }`}
            />
          </div>
          {isBelowMin ? (
            <p className="text-xs text-[#ef4444]">Minimum top up is ${MIN_TOP_UP}</p>
          ) : (
            amount >= MIN_TOP_UP && (
              <p className="text-xs tabular-nums text-dash-text-faded">
                {minutesPreview} build minutes for ${amount.toFixed(2)}
              </p>
            )
          )}
        </div>

        {hasPaymentMethod ? (
          <div className="flex items-center justify-between rounded-[4px] bg-dash-bg-elevated px-3 py-2.5">
            <span className="text-sm text-dash-text-faded">Pay with</span>
            <span className="text-sm text-dash-text-strong">
              {cardBrand}
              {cardLast4 ? ` •••• ${cardLast4}` : ""}
            </span>
          </div>
        ) : (
          <div className="rounded-[4px] bg-[#f5a623]/[0.06] px-3 py-2.5 dark:bg-[#f5a623]/[0.08]">
            <p className="text-sm leading-[1.4] text-[#b37a10] dark:text-[#f5a623]">Add a payment method before topping up.</p>
          </div>
        )}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton
          disabled={!isValid || !stripe}
          loading={purchase.isPending || verifying}
          loadingLabel={verifying ? "Confirming..." : "Processing..."}
          onClick={handleConfirm}
        >
          Top up ${amount > 0 ? amount.toFixed(2) : "0.00"}
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
