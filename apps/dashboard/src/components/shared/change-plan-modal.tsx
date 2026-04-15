import { useState, useMemo, useEffect } from "react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "./modal";
import { Dropdown } from "./dropdown";
import { usePricing } from "@/contexts/pricing-context";
import { usePaymentMethods, useSubscription, useCreateSubscription, useSwapPlan } from "@/hooks/use-payments";
import type { PaymentMethod } from "@/backend/payments";

const PLAN_ID_TO_API_TYPE: Record<string, string> = {
  hacker: "HACKER_PLAN",
  developer: "DEVELOPER_PLAN",
};

export function ChangePlanModal({
  open,
  onOpenChange,
  currentPlan,
  defaultSelectedPlan,
  initialPaymentMethods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  defaultSelectedPlan?: string;
  initialPaymentMethods?: PaymentMethod[] | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const pricing = usePricing();

  const { data: paymentMethods = [] } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const { data: subscription } = useSubscription();
  const createSubscription = useCreateSubscription();
  const swapPlan = useSwapPlan();

  const defaultMethod = paymentMethods.find((m: any) => m.is_default) ?? paymentMethods[0];
  const hasPaymentMethod = paymentMethods.length > 0;
  const hasSubscription = subscription !== null && subscription !== undefined;
  const isPending = createSubscription.isPending || swapPlan.isPending;

  const billingPlans = useMemo(
    () =>
      pricing.plans.map((p) => ({
        name: p.name,
        price: p.amount,
        planId: p.id,
      })),
    [pricing.plans],
  );

  const currentPlanLower = currentPlan.trim().toLowerCase();
  const defaultPlanLower = defaultSelectedPlan?.trim().toLowerCase() ?? "";
  const currentIdx = billingPlans.findIndex((p) => p.name.trim().toLowerCase() === currentPlanLower);
  const suggestedPlan = useMemo(() => {
    if (defaultPlanLower) {
      const explicit = billingPlans.find((p) => p.name.trim().toLowerCase() === defaultPlanLower);
      if (explicit && explicit.name.trim().toLowerCase() !== currentPlanLower) {
        return explicit.name;
      }
    }

    if (currentIdx >= 0 && currentIdx + 1 < billingPlans.length) {
      return billingPlans[currentIdx + 1]?.name ?? "";
    }

    return billingPlans.find((p) => p.name.trim().toLowerCase() !== currentPlanLower)?.name ?? "";
  }, [billingPlans, currentIdx, currentPlanLower, defaultPlanLower]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPlan(suggestedPlan);
    setAcceptedTerms(false);
  }, [open, suggestedPlan]);

  const selectedIdx = billingPlans.findIndex((p) => p.name === selectedPlan);
  const selectedObj = billingPlans[selectedIdx];
  const currentObj = billingPlans[currentIdx];

  const isUpgrade = selectedIdx > currentIdx;
  const isDowngrade = selectedIdx !== -1 && selectedIdx < currentIdx;

  const needsPaymentMethod = isUpgrade && selectedObj?.price > 0 && !hasPaymentMethod;

  const dropdownOptions = billingPlans
    .filter((p) => p.name !== currentPlan)
    .map((p) => ({
      id: p.name,
      label: p.price === 0 ? `${p.name} — Free` : `${p.name} — $${p.price}/mo`,
    }));

  const buttonLabel = isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Confirm change";

  function hardRefreshPage() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.reload();
  }

  function handleConfirm() {
    if (!selectedObj) return;

    const apiType = PLAN_ID_TO_API_TYPE[selectedObj.planId];
    if (!apiType) {
      toast.error("Cannot change to this plan.");
      return;
    }

    if (needsPaymentMethod) {
      toast.error("Please add a payment method first before upgrading.");
      return;
    }

    if (!hasSubscription && !defaultMethod?.id && selectedObj.price > 0) {
      toast.error("Please add a payment method first.");
      return;
    }

    if (!hasSubscription) {
      createSubscription.mutate(
        {
          type: apiType,
          accept_terms: true,
          ...(defaultMethod?.id ? { payment_method: defaultMethod.id } : {}),
        },
        {
          onSuccess: () => {
            toast.success("Subscription created");
            setSelectedPlan("");
            setAcceptedTerms(false);
            onOpenChange(false);
            hardRefreshPage();
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to create subscription");
          },
        },
      );
    } else {
      swapPlan.mutate(apiType, {
        onSuccess: () => {
          toast.success("Plan changed");
          setSelectedPlan("");
          setAcceptedTerms(false);
          onOpenChange(false);
          hardRefreshPage();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to change plan");
        },
      });
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSelectedPlan(suggestedPlan);
          setAcceptedTerms(false);
        }
        onOpenChange(v);
      }}
      width={420}
    >
      <ModalHeader title="Change plan" description="Select a new plan. See full plan details on the pricing page." />

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">New plan</label>
          <Dropdown value={selectedPlan} options={dropdownOptions} onChange={setSelectedPlan} placeholder="Select a plan..." />
        </div>

        {selectedObj && currentObj && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-5 text-dash-text-faded">
              {isUpgrade
                ? currentObj.price === 0
                  ? `You'll be charged $${selectedObj.price}/mo. Changes take effect immediately.`
                  : `You'll be charged $${selectedObj.price}/mo, up from $${currentObj.price}/mo. Changes take effect immediately.`
                : `Your plan will change to ${selectedObj.name} (${selectedObj.price === 0 ? "Free" : `$${selectedObj.price}/mo`}) at the end of your billing period.`}
            </p>
            {needsPaymentMethod && (
              <div className="rounded-[4px] bg-[#4879f8]/[0.06] px-3 py-2.5 dark:bg-[#4879f8]/[0.08]">
                <p className="text-sm leading-[1.4] text-[#4879f8]">You need to add a payment method before upgrading to a paid plan.</p>
              </div>
            )}
            {isDowngrade && (
              <div className="rounded-[4px] bg-[#f5a623]/[0.06] px-3 py-2.5 dark:bg-[#f5a623]/[0.08]">
                <p className="text-sm leading-[1.4] text-[#b37a10] dark:text-[#f5a623]">
                  If you have more projects than the new plan allows, your existing projects won't be deleted, but you won't be able to
                  create new ones until you're within the limit.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedObj && !needsPaymentMethod && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-dash-border accent-[#4879f8]"
            />
            <span className="text-sm leading-5 text-dash-text-faded">
              I agree to the{" "}
              <a href="https://brimble.io/terms" target="_blank" rel="noopener noreferrer" className="text-[#4879f8] hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="https://brimble.io/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4879f8] hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>
        )}

        <a href="/pricing" target="_blank" rel="noopener noreferrer" className="text-sm text-[#4879f8] hover:underline">
          Compare all plans &rarr;
        </a>
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton
          disabled={!selectedPlan || isPending || needsPaymentMethod || !acceptedTerms}
          loading={isPending}
          loadingLabel="Processing..."
          onClick={handleConfirm}
        >
          {buttonLabel}
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
