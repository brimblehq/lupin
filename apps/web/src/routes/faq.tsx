import { useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { siteConfig } from "@/config/site";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@brimble/ui";
import { Cta } from "@/components/sections/cta";
import trainStation from "@/assets/images/train-station.svg";

export const Route = createFileRoute("/faq")({
  head: () =>
    buildSeoHead({
      title: "FAQs",
      description:
        "Got questions? Learn how Brimble works, how billing is structured, what you can deploy, and how to access AI models with a single API.",
      path: "/faq",
    }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <FaqHero />
        <FaqCategories />
        <Cta />
      </main>
    </div>
  );
}

/* ─── Hero Section ─── */

function FaqHero() {
  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-4 pt-16">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <motion.h1
          className="font-heading text-[48px] font-medium leading-[54px] tracking-[-0.576px] text-brimble-black"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {siteConfig.faq.heading}
        </motion.h1>
        <motion.p
          className="max-w-[519px] font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {siteConfig.faq.description}
        </motion.p>
      </div>
    </section>
  );
}

/* ─── FAQ Categories ─── */

function FaqCategories() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-10">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-12">
        {siteConfig.faq.categories.map((category, ci) => (
          <motion.div
            key={category.label}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: ci * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Accordion
              type="single"
              defaultValue={ci === 0 ? `${category.label}-0` : undefined}
              collapsible
              className="overflow-hidden rounded-[4px] border border-[rgba(152,157,164,0.3)] bg-brimble-surface shadow-[var(--shadow-big)] dark:border-white/10 dark:bg-[#1e2023]"
            >
              {category.items.map((item, i) => (
                <AccordionItem key={i} value={`${category.label}-${i}`} className="px-4">
                  {i === 0 && (
                    <p className="pt-6 pb-2 font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50">{category.label}</p>
                  )}
                  <AccordionTrigger>{item.title}</AccordionTrigger>
                  <AccordionContent>{item.description}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        ))}

        {/* Illustration */}
        <div className="brightness-[1.02] mix-blend-multiply dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85">
          <motion.img
            src={trainStation}
            alt=""
            className="mx-auto w-full"
            loading="lazy"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </div>
      </div>
    </section>
  );
}
