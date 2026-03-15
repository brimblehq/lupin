import { useState } from "react";
import {
  createFileRoute,
  getRouteApi,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Search, Globe } from "lucide-react";
import { CheckCircle } from "@phosphor-icons/react";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { AccessDenied, accessDeniedForbidden } from "../../components/shared/access-denied";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { Dropdown } from "../../components/shared/dropdown";
import { GlossyButton } from "../../components/shared/glossy-button";
import { Spinner } from "../../components/shared/spinner";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalCancelButton,
} from "../../components/shared/modal";
import { NumberPagination } from "../../components/shared/pagination";
import { ToggleSwitch } from "../../components/shared/toggle-switch";
import {
  searchDomainSaleServerFn,
  purchaseDomainServerFn,
} from "../../server/domains/actions";
import { getPaymentMethodsServerFn } from "@/server/payments/actions";
import { usePaymentMethods } from "@/hooks/use-payments";
import type { PaymentMethod } from "@/backend/payments";
import { getWorkspaceFromSearch, withWorkspaceQuery } from "@/utils/topbar-navigation";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/domains/buy")({
  component: BuyDomainPage,
});

/* ─── Constants ─── */

const ease = [0.16, 1, 0.3, 1] as const;
const PAGE_SIZE = 50;
const PRIVACY_PRICE = 8;

const inputClass =
  "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

/* ─── Types ─── */

interface DomainResult {
  domainName: string;
  available: boolean;
  price: number | null;
}

/* ─── Helpers ─── */

function splitDomain(domainName: string): { base: string; tld: string } {
  const dot = domainName.indexOf(".");
  if (dot === -1) return { base: domainName, tld: "" };
  return { base: domainName.slice(0, dot), tld: domainName.slice(dot + 1) };
}

function normalizeQuery(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.includes(".") ? trimmed : `${trimmed}.com`;
}

function getTld(domainName: string): string {
  const dot = domainName.lastIndexOf(".");
  return dot === -1 ? "" : domainName.slice(dot + 1).toLowerCase();
}

function isAiDomain(domainName: string): boolean {
  return getTld(domainName) === "ai";
}

function isAppDomain(domainName: string): boolean {
  return getTld(domainName) === "app";
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
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

/* ─── Domain Result Card ─── */

function DomainResultCard({
  result,
  index,
  isExactMatch,
  onSelect,
}: {
  result: DomainResult;
  index: number;
  isExactMatch?: boolean;
  onSelect: () => void;
}) {
  const { base, tld } = splitDomain(result.domainName);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.03 * index, ease }}
      disabled={!result.available}
      onClick={onSelect}
      className={`flex items-center justify-between rounded-[4px] border-[0.5px] border-dash-border px-3.5 py-3 text-left transition-colors ${
        result.available
          ? "hover:bg-dash-bg-elevated"
          : "cursor-default opacity-50"
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm text-dash-text-body">
        {base}.
        <span className="font-medium text-dash-text-strong">{tld}</span>
        {isExactMatch && result.available && (
          <CheckCircle size={15} weight="fill" className="text-[#4879f8]" />
        )}
      </span>
      {result.available ? (
        <span className="rounded-full bg-[#34d399]/10 px-2.5 py-0.5 text-xs font-medium text-[#34d399]">
          {formatUsd(result.price ?? 0)}
        </span>
      ) : (
        <span className="rounded-full bg-dash-bg-elevated px-2.5 py-0.5 text-xs font-medium text-dash-text-faded">
          Taken
        </span>
      )}
    </motion.button>
  );
}

/* ─── Payment Card Image ─── */

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

/* ─── Main Page ─── */

function BuyDomainPage() {
  const { canWrite } = useWorkspaceRole();
  const router = useRouter();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const searchDomains = useServerFn(searchDomainSaleServerFn as any) as (args: {
    data: { name: string };
  }) => Promise<Array<{ domainName: string; purchasable: boolean; purchasePrice?: number }>>;
  const purchaseDomain = useServerFn(purchaseDomainServerFn as any) as (args: {
    data: {
      workspace?: string;
      name: string;
      duration: number;
      projectId?: string;
      privacyEnabled: boolean;
      autoRenewal: boolean;
    };
  }) => Promise<{ success: boolean }>;
  const { paymentMethods: initialPaymentMethods } = (rootRoute.useLoaderData() ?? {}) as { paymentMethods?: PaymentMethod[] | null };
  const { data: paymentMethods = [] } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const cards = paymentMethods.map((m: any) => ({
    id: m.id,
    cardType: m.card?.brand ?? m.brand,
    last4: m.card?.last4 ?? m.last4,
    preferred: m.is_default,
  }));
  const defaultCard = cards.find((c) => c.preferred) ?? cards[0] ?? null;
  const workspace = getWorkspaceFromSearch({ searchStr });

  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [results, setResults] = useState<DomainResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<DomainResult | null>(null);
  const [years, setYears] = useState(1);
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const paginatedResults = results.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const isAi = purchaseTarget ? isAiDomain(purchaseTarget.domainName) : false;
  const isApp = purchaseTarget ? isAppDomain(purchaseTarget.domainName) : false;
  const effectivePrivacy = isApp ? true : privacyEnabled;
  const privacyCost = isApp ? 0 : effectivePrivacy ? PRIVACY_PRICE : 0;
  const domainCost = (purchaseTarget?.price ?? 0) * years;
  const total = domainCost + privacyCost;

  async function handleSearch() {
    const name = normalizeQuery(query);
    if (!name || searching) return;

    setSearching(true);
    setSearchedQuery(name.replace(/\.[a-z]+$/, ""));
    setSearchedDomain(name);
    setHasSearched(true);
    setPage(0);

    try {
      const data = await searchDomains({ data: { name } });
      setResults(
        data.map((item) => ({
          domainName: item.domainName,
          available: item.purchasable,
          price: item.purchasePrice ?? null,
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Domain search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleOpenPurchase(domain: DomainResult) {
    setPurchaseTarget(domain);
    setYears(isAiDomain(domain.domainName) ? 2 : 1);
    setPrivacyEnabled(false);
    setAutoRenewal(false);
  }

  async function handlePurchase() {
    if (!purchaseTarget || purchasing) return;

    setPurchasing(true);

    try {
      const latestMethods = await getPaymentMethodsServerFn();
      const methods = Array.isArray(latestMethods) ? latestMethods : [];
      const latestDefaultMethod = methods.find((method: any) => method.is_default) ?? methods[0];
      if (!latestDefaultMethod?.id) {
        toast.error("Add a payment method before purchasing a domain.");
        return;
      }

      await purchaseDomain({
        data: {
          ...(workspace ? { workspace } : {}),
          name: purchaseTarget.domainName,
          duration: years,
          privacyEnabled: effectivePrivacy,
          autoRenewal,
        },
      });

      toast.success(`${purchaseTarget.domainName} purchased successfully!`);
      setPurchaseTarget(null);
      const detailPath = `/domains/${encodeURIComponent(purchaseTarget.domainName)}`;
      router.navigate({
        to: withWorkspaceQuery({ pathname: detailPath, searchStr }) as any,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  }

  function getDurationOptions() {
    return Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const disabled = isAi && year !== 2;
      return {
        id: String(year),
        label: disabled
          ? `${year} ${year === 1 ? "year" : "years"} (unavailable)`
          : `${year} ${year === 1 ? "year" : "years"} — ${formatUsd((purchaseTarget?.price ?? 0) * year)}`,
      };
    }).filter((opt) => !isAi || opt.id === "2");
  }

  if (!canWrite) {
    return <AccessDenied {...accessDeniedForbidden} />;
  }

  return (
    <div className="max-w-[1000px]">
      <div className="mb-8 flex items-center gap-4">
        <div className="hidden shrink-0 brightness-[1.02] mix-blend-multiply dark:invert dark:mix-blend-screen dark:opacity-85 sm:block">
          <img
            src="/images/televison.svg"
            alt=""
            className="size-[80px]"
          />
        </div>
        <div>
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
            Buy a domain
          </h2>
          <p className="mt-2 max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            Search for the perfect domain name for your project. We'll check
            availability across 30+ TLDs and show you pricing instantly.
          </p>
        </div>
      </div>

      <hr className="-ml-4 mb-6 border-dash-border-soft md:-ml-10" />

      {/* Search bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="Search for a domain name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className={`${inputClass} pl-9`}
            autoFocus
          />
        </div>
        <GlossyButton
          variant="blue"
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          loading={searching}
          loadingLabel="Searching..."
          className="shrink-0"
        >
          Search
        </GlossyButton>
      </div>

      {/* Pre-search empty state */}
      {!hasSearched && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Globe className="mb-4 size-10 text-dash-text-extra-faded opacity-40" />
          <h3 className="mb-1 text-sm font-medium text-dash-text-strong">
            Find your perfect domain
          </h3>
          <p className="max-w-[320px] text-center text-sm text-dash-text-faded">
            Type a domain name above to check availability and pricing across
            30+ TLDs.
          </p>
        </motion.div>
      )}

      {/* Loading state */}
      {searching && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-6" />
        </div>
      )}

      {/* Results grid */}
      {hasSearched && !searching && (
        <div>
          {results.length > 0 ? (
            <>
              <p className="mb-1 text-sm text-dash-text-faded">
                Showing results for{" "}
                <span className="font-medium text-dash-text-strong">
                  {searchedQuery}
                </span>
              </p>
              <p className="mb-3 text-xs text-dash-text-extra-faded">
                Only domains available for purchase are shown. If you don't see a domain, it's likely already taken.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {paginatedResults.map((result, i) => (
                  <DomainResultCard
                    key={result.domainName}
                    result={result}
                    index={i}
                    isExactMatch={result.domainName === searchedDomain}
                    onSelect={() => handleOpenPurchase(result)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex justify-end">
                  <NumberPagination
                    currentPage={page + 1}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p - 1)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-sm text-dash-text-faded">
                No results found for{" "}
                <span className="font-medium text-dash-text-strong">{searchedQuery}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Purchase modal */}
      <Modal
        open={!!purchaseTarget}
        onOpenChange={(open) => {
          if (!open && !purchasing) {
            setPurchaseTarget(null);
          }
        }}
        width={420}
      >
        <ModalHeader
          title="Purchase domain"
          description="Complete your domain purchase"
        />

        {purchaseTarget && (
          <div className="flex flex-col gap-4 px-6 py-5">
            {/* Domain + price */}
            <div className="flex items-center justify-between rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-3">
              <span className="text-sm font-medium text-dash-text-strong">
                {purchaseTarget.domainName}
              </span>
              <span className="text-sm font-medium text-[#34d399]">
                {formatUsd(purchaseTarget.price ?? 0)}/yr
              </span>
            </div>

            {/* Payment method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-dash-text-faded">
                Payment method
              </label>
              {defaultCard ? (
                <>
                  <div className="flex items-center gap-3 rounded-[4px] border-[0.5px] border-dash-border px-3.5 py-2.5">
                    <CardChip />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-dash-text-strong">
                        {formatCardType(defaultCard.cardType)}
                      </span>
                      <span className="text-xs text-dash-text-faded">
                        ending in {defaultCard.last4 ?? "****"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-dash-text-extra-faded">
                    Domain purchases use your available saved card automatically.
                  </p>
                </>
              ) : (
                <div className="rounded-[4px] border-[0.5px] border-dash-border px-4 py-3 text-center">
                  <p className="text-sm text-dash-text-faded">
                    No payment methods found. Add a card in{" "}
                    <span className="font-medium text-dash-text-strong">Settings</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-dash-text-faded">
                Duration
                {isAi && (
                  <span className="ml-1 text-xs text-dash-text-extra-faded">
                    (.ai domains require 2-year terms)
                  </span>
                )}
              </label>
              <Dropdown
                value={String(years)}
                options={getDurationOptions()}
                onChange={(id) => setYears(Number(id))}
              />
            </div>

            {/* Privacy protection */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-dash-text-body">
                  Privacy protection
                </span>
                <span className="text-xs text-dash-text-faded">
                  {isApp ? "Included free with .app domains" : `${formatUsd(PRIVACY_PRICE)}/yr — hides your WHOIS info`}
                </span>
              </div>
              <ToggleSwitch
                checked={effectivePrivacy}
                onChange={setPrivacyEnabled}
                disabled={isApp}
              />
            </div>

            {/* Auto renewal */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-dash-text-body">
                  Auto renewal
                </span>
                <span className="text-xs text-dash-text-faded">
                  Automatically renew before expiration
                </span>
              </div>
              <ToggleSwitch
                checked={autoRenewal}
                onChange={setAutoRenewal}
              />
            </div>

            {/* Total */}
            <div className="flex flex-col gap-1.5 border-t-[0.5px] border-dash-border pt-3">
              <div className="flex items-center justify-between text-sm text-dash-text-faded">
                <span>
                  Domain ({years} {years === 1 ? "year" : "years"})
                </span>
                <span>{formatUsd(domainCost)}</span>
              </div>
              {effectivePrivacy && (
                <div className="flex items-center justify-between text-sm text-dash-text-faded">
                  <span>Privacy protection</span>
                  <span>{isApp ? "Free" : formatUsd(PRIVACY_PRICE)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5">
                <span className="text-sm font-medium text-dash-text-body">
                  Total
                </span>
                <span className="text-base font-medium text-dash-text-strong">
                  {formatUsd(total)}
                </span>
              </div>
            </div>
          </div>
        )}

        <ModalFooter>
          <ModalCancelButton />
          <GlossyButton
            variant="blue"
            onClick={handlePurchase}
            disabled={purchasing}
            loading={purchasing}
            loadingLabel="Purchasing..."
          >
            Purchase domain
          </GlossyButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
