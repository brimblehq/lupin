import { useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { Button, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@brimble/ui";
import { Cta } from "@/components/sections/cta";
import { listPlansServerFn, type PlansResult } from "@/server/plans/actions";
import trainStation from "@/assets/images/train-station.svg";
import flower from "@/assets/images/flower.png";
import arrowRight from "@/assets/icons/arrow-right.svg";

export const Route = createFileRoute("/pricing")({
  head: () =>
    buildSeoHead({
      title: "Pricing",
      description:
        "Explore Brimble’s transparent pricing for app hosting, managed databases, domain purchases, and AI API access. Start free, scale as you grow.",
      path: "/pricing",
    }),
  staleTime: 300_000,
  loader: async (): Promise<PlansResult> => {
    return (listPlansServerFn as unknown as () => Promise<PlansResult>)();
  },
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <PricingHero />
        <PricingPlans />
        <PricingEnterprise />
        <PricingFaqs />
        <Cta />
      </main>
    </div>
  );
}

/* ─── Hero Section ─── */

function PricingHero() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pt-16 pb-10">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col items-center text-center">
        <div className="mb-8 brightness-[1.02] mix-blend-multiply dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85">
          <motion.img
            src={flower}
            alt=""
            className="h-[200px] w-[180px] object-cover"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <motion.h1
          className="font-heading text-[48px] font-medium leading-[54px] tracking-[-0.576px] text-brimble-black"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {siteConfig.pricing.heading}
        </motion.h1>
        <motion.p
          className="mt-4 max-w-[480px] font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {siteConfig.pricing.description}
        </motion.p>
      </div>
    </section>
  );
}

/* ─── Plans Section ─── */

function PricingPlans() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const { personal, team } = Route.useLoaderData();
  const teamConfig = siteConfig.pricing.teamPlan;

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-20">
      <div ref={ref} className="mx-auto flex max-w-[960px] flex-col items-center gap-10">
        {/* Personal plan cards */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {personal.map((plan, i) => (
            <motion.div
              key={plan.planType}
              className={`relative flex flex-col rounded-3xl border p-6 transition-colors duration-200 ${
                plan.popular
                  ? "border-brimble-accent-blue bg-brimble-surface shadow-[var(--shadow-big)]"
                  : "border-[rgba(152,157,164,0.3)] bg-brimble-surface dark:border-white/10"
              }`}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.1 + i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{
                y: -4,
                transition: { duration: 0.25 },
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brimble-accent-blue px-3 py-0.5 font-body text-xs font-medium text-white">
                  Popular
                </span>
              )}

              {/* Plan header */}
              <div className="flex flex-col gap-1">
                <h3 className="font-body text-xl font-medium leading-[30px] tracking-[-0.24px] text-brimble-black">{plan.name}</h3>
                <p className="font-body text-sm leading-[18px] tracking-[-0.32px] text-brimble-black/50">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-heading text-[40px] font-medium leading-none tracking-[-1.6px] text-brimble-black">
                  ${plan.price}
                </span>
                <span className="font-body text-sm text-brimble-black/50">/mo</span>
              </div>

              {/* CTA */}
              <Button
                asChild
                variant={plan.popular ? "pill" : "pill-light"}
                size="sm"
                className="mt-6 w-full gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
              >
                <a href="https://app.brimble.io" target="_blank" rel="noopener noreferrer">
                  {siteConfig.pricing.personalCta}
                  {plan.popular && <img src={arrowRight} alt="" className="size-3 brightness-0 invert dark:invert-0" />}
                </a>
              </Button>

              {/* Divider */}
              <div className="my-6 h-px bg-[rgba(152,157,164,0.2)] dark:bg-white/10" />

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 font-body text-sm leading-[18px] text-brimble-black/70">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brimble-accent-blue" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Team plan — separate section */}
        {team && (
          <motion.div
            className="w-full rounded-3xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-8 dark:border-white/10"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-body text-xl font-medium leading-[30px] tracking-[-0.24px] text-brimble-black">{team.name}</h3>
                  <span className="rounded-full bg-brimble-accent-blue/10 px-2.5 py-0.5 font-body text-xs font-medium text-brimble-accent-blue">
                    Add-on
                  </span>
                </div>
                <p className="max-w-[480px] font-body text-sm leading-[18px] tracking-[-0.32px] text-brimble-black/50">
                  {team.description}
                </p>
                <p className="mt-1 font-body text-sm text-brimble-black/70">
                  <span className="font-medium text-brimble-black">${teamConfig.pricePerMember}</span>/member/mo
                  {" + "}
                  <span className="font-medium text-brimble-black">${teamConfig.pricePerBuild}</span>/build container/mo
                </p>
              </div>
              <Button
                asChild
                variant="pill-light"
                size="sm"
                className="shrink-0 gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
              >
                <a href="https://app.brimble.io" target="_blank" rel="noopener noreferrer">
                  {teamConfig.cta}
                  <ArrowRight className="size-3" />
                </a>
              </Button>
            </div>

            <div className="my-6 h-px bg-[rgba(152,157,164,0.2)] dark:bg-white/10" />

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {team.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 font-body text-sm leading-[18px] text-brimble-black/70">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brimble-accent-blue" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ─── Enterprise Section ─── */

function PricingEnterprise() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-20">
      <motion.div
        ref={ref}
        className="mx-auto flex max-w-[720px] items-center gap-8 rounded-3xl bg-brimble-black p-10 dark:bg-[#1a1c1e] dark:border dark:border-white/10"
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <h3 className="font-heading text-[32px] font-medium leading-none tracking-[-0.576px] text-white">
            {siteConfig.pricing.enterprise.title}
          </h3>
          <p className="max-w-[380px] font-body text-base leading-[21px] tracking-[-0.32px] text-white/50">
            {siteConfig.pricing.enterprise.description}
          </p>
        </div>
        <Button
          asChild
          variant="pill-light"
          size="sm"
          className="shrink-0 gap-2 bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black"
        >
          <a href="mailto:hello@brimble.app">
            {siteConfig.pricing.enterprise.cta}
            <ArrowRight className="size-3" />
          </a>
        </Button>
      </motion.div>
    </section>
  );
}

/* ─── FAQs Section ─── */

function PricingFaqs() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-air-gray transition-colors duration-300 px-6 py-[72px]">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-10">
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
            className="overflow-hidden rounded-[4px] border border-[rgba(152,157,164,0.3)] bg-brimble-surface shadow-[var(--shadow-big)] dark:border-white/10 dark:bg-[#1e2023]"
          >
            {siteConfig.pricing.faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="px-4">
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
