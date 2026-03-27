import { useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, useInView } from "motion/react";
import { Search } from "lucide-react";
import { siteConfig } from "@/config/site";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { searchDomainSaleServerFn } from "@/server/domains/actions";
import {
  Button,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  DomainSearchResultCard,
  type DomainSearchResult,
} from "@brimble/ui";
import { Cta } from "@/components/sections/cta";
import balloons from "@/assets/images/balloons.png";
import trainStation from "@/assets/images/train-station.svg";
import arrowRight from "@/assets/icons/arrow-right.svg";

export const Route = createFileRoute("/domains")({
  head: () =>
    buildSeoHead({
      title: "Buy and Manage Domains",
      description:
        "Secure your domain in seconds. Buy, connect, and manage custom domains with ease on Brimble.",
      path: "/domains",
    }),
  component: DomainsPage,
});

function DomainsPage() {
  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <DomainsHero />
        <DomainsFaqs />
        <Cta />
      </main>
    </div>
  );
}

/* ─── Hero Section ─── */

function normalizeQuery(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.includes(".") ? trimmed : `${trimmed}.com`;
}

function DomainsHero() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const searchDomains = useServerFn(searchDomainSaleServerFn as any) as (args: {
    data: { name: string; limit?: number };
  }) => Promise<Array<{ domainName: string; purchasable: boolean; purchasePrice?: number }>>;

  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const name = normalizeQuery(query);
    if (!name || searching) return;

    setSearching(true);
    setHasSearched(true);
    setError(null);
    setSearchedDomain(name);
    setSearchedQuery(name.replace(/\.[a-z0-9-]+$/i, ""));

    try {
      const data = await searchDomains({ data: { name, limit: 20 } });
      setResults(
        data.slice(0, 20).map((item) => ({
          domainName: item.domainName,
          available: item.purchasable,
          price: item.purchasePrice ?? null,
        })),
      );
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error ? searchError.message : "Domain search failed",
      );
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSearch();
  }

  return (
    <section className="relative bg-brimble-surface transition-colors duration-300 px-6 pb-12 pt-10">
      <div
        ref={ref}
        className="mx-auto flex max-w-[720px] flex-col items-center"
      >
        {/* Balloon illustration + overlapping search bar */}
        <div className="relative w-full">
          <div className="brightness-[1.02] mix-blend-multiply dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85">
            <motion.img
              src={balloons}
              alt=""
              className="w-full"
              loading="eager"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Domain search bar — overlapping the image */}
          <motion.form
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: "-50%" } : {}}
            transition={{
              duration: 0.6,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            onSubmit={handleSubmit}
          >
            <div className="flex w-[532px] max-w-[90vw] items-center gap-2 rounded-lg border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-4 shadow-[var(--shadow-big)] dark:border-white/10 dark:bg-[#1e2023]">
              <Search className="size-4 shrink-0 text-[rgba(152,157,164,0.6)]" />
              <div className="flex flex-1 items-baseline font-body font-medium">
                <input
                  type="text"
                  placeholder={siteConfig.domains.searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-base leading-normal text-black placeholder:text-[rgba(152,157,164,0.6)] outline-none md:text-sm md:leading-[15.5px] dark:text-white"
                />
              </div>
              <Button
                type="submit"
                variant="pill-light"
                size="xs"
                disabled={!query.trim() || searching}
                className="shrink-0"
              >
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
          </motion.form>
        </div>

        {/* Heading + Description */}
        <motion.div
          className="mt-14 flex w-full flex-col gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.6,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <h1 className="font-heading text-[48px] font-medium leading-[54px] tracking-[-0.576px] text-brimble-black">
            {siteConfig.domains.heading}
          </h1>
          <p className="max-w-[519px] font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60">
            {siteConfig.domains.description}
          </p>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: 0.25,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Button
            asChild
            variant="pill"
            size="sm"
            className="w-full gap-2 transition-transform duration-150 hover:scale-[1.005] active:scale-[0.99]"
          >
            <a href="https://app.brimble.io/domains/buy">
              {siteConfig.domains.cta}
              <img
                src={arrowRight}
                alt=""
                className="size-3 brightness-0 invert dark:invert-0"
              />
            </a>
          </Button>
        </motion.div>

        <motion.div
          className="mt-6 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: 0.35,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {!hasSearched && (
            <p className="text-sm text-brimble-black/60 dark:text-white/65">
              Search any domain to check live availability and pricing.
            </p>
          )}

          {searching && (
            <p className="text-sm text-brimble-black/60 dark:text-white/65">
              Checking domain availability...
            </p>
          )}

          {!searching && error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {hasSearched && !searching && !error && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-brimble-black/60 dark:text-white/65">
                Showing results for{" "}
                <span className="font-medium text-brimble-black dark:text-white">
                  {searchedQuery}
                </span>
              </p>

              {results.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {results.map((result) => (
                    <DomainSearchResultCard
                      key={result.domainName}
                      result={result}
                      variant="web"
                      isExactMatch={result.domainName === searchedDomain}
                      onSelect={() =>
                        window.open(
                          `https://app.brimble.io/domains/buy?q=${encodeURIComponent(result.domainName)}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brimble-black/60 dark:text-white/65">
                  No domains found for{" "}
                  <span className="font-medium text-brimble-black dark:text-white">
                    {searchedQuery}
                  </span>
                  .
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>

    </section>
  );
}

/* ─── FAQs Section ─── */

function DomainsFaqs() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-[72px]">
      <div
        ref={ref}
        className="mx-auto flex max-w-[720px] flex-col gap-10"
      >
        {/* FAQs heading + illustration */}
        <div className="relative">
          <motion.h2
            className="font-heading text-[40px] font-medium leading-none tracking-[-1.6px] text-brimble-black"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            FAQs
          </motion.h2>
          <div className="absolute -top-4 right-0 h-[200px] w-auto brightness-[1.02] mix-blend-multiply dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85">
            <motion.img
              src={trainStation}
              alt=""
              className="h-full w-auto"
              loading="lazy"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{
                duration: 0.8,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          </div>
        </div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.6,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Accordion
            type="single"
            defaultValue="faq-0"
            collapsible
            className="overflow-hidden rounded-lg border border-[rgba(152,157,164,0.3)] bg-brimble-surface shadow-[var(--shadow-big)] dark:border-white/10 dark:bg-[#1e2023]"
          >
            {siteConfig.domains.faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="px-4">
                {i === 0 && faq.label && (
                  <p className="pt-6 pb-2 font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50">
                    {faq.label}
                  </p>
                )}
                <AccordionTrigger>{faq.title}</AccordionTrigger>
                <AccordionContent>{faq.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
