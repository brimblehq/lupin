import { DashButton } from "@/components/shared/dash-button";
import { LoadingButtonContent } from "@/components/shared/loading-button-content";
import { resolvePlanKey } from "@/hooks/use-plan-gate";
import { hasOutstandingInvoices, useDeveloperTrial } from "@/hooks/use-developer-trial";

const TRIAL_PLAN_KEYS = new Set<string>(["free", "hacker"]);

export function DeveloperTrialBanner({
  planType,
  isTeamWorkspace,
  developerTrialStartedAt,
}: {
  planType?: string;
  isTeamWorkspace?: boolean;
  developerTrialStartedAt?: string | null;
}) {
  const { start: handleStartTrial, loading, outstandingInvoices } = useDeveloperTrial();
  const eligible = !isTeamWorkspace && TRIAL_PLAN_KEYS.has(resolvePlanKey(planType)) && !developerTrialStartedAt;
  if (!eligible) return null;

  return (
    <div className="mb-8 rounded-[4px] border-[0.5px] border-dash-border px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px]">
            <img src="/images/promo.svg" alt="" className="size-10 invert dark:invert-0" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-dash-text-strong">Try the Developer plan free for 14 days</p>
            <p className="mt-0.5 text-sm font-light leading-[1.3] text-dash-text-faded">
              Unlock unlimited projects, autoscaling, object storage, and more — free for 14 days, no charge.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <DashButton onClick={() => void handleStartTrial()} disabled={loading || hasOutstandingInvoices(outstandingInvoices)}>
            <LoadingButtonContent loading={loading} loadingLabel="Starting..." spinnerClassName="text-current">
              Start free trial
            </LoadingButtonContent>
          </DashButton>
        </div>
      </div>
      {hasOutstandingInvoices(outstandingInvoices) && (
        <div className="mt-4 border-t-[0.5px] border-dash-border pt-3">
          <p className="text-xs font-medium text-dash-text-strong">Pay outstanding invoices before starting the trial.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outstandingInvoices.invoices.map((invoice) => {
              const invoiceUrl = invoice.hosted_invoice_url ?? invoice.invoice_pdf;
              const label = `${invoice.currency.toUpperCase()} ${invoice.amount_due.toFixed(2)}`;

              if (!invoiceUrl) {
                return (
                  <span
                    key={invoice.id}
                    className="rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-1 text-xs text-dash-text-faded"
                  >
                    {label}
                  </span>
                );
              }

              return (
                <a
                  key={invoice.id}
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-1 text-xs text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
