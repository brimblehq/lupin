import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { siteConfig } from "@/config/site";
import { Button, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@brimble/ui";

import arrowRight from "@/assets/icons/arrow-right.svg";

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-[72px]">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col items-center gap-10">
        {/* Title */}
        <motion.h2
          className="text-balance text-center font-heading text-[48px] font-medium leading-[54px] tracking-[-0.576px] text-brimble-black"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {siteConfig.features.heading}
        </motion.h2>

        {/* Accordion */}
        <motion.div
          className="w-full overflow-hidden rounded-[4px] border border-[rgba(152,157,164,0.3)] dark:border-white/10 bg-brimble-surface dark:bg-[#1a1c1e] shadow-[var(--shadow-big)]"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <Accordion type="single" defaultValue="item-0" collapsible>
            {siteConfig.features.items.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                {item.label && (
                  <div className="px-4 pt-6">
                    <span className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50">{item.label}</span>
                  </div>
                )}
                <AccordionTrigger className={item.label ? "px-4 pt-2" : "px-4"}>{item.title}</AccordionTrigger>
                {item.description && <AccordionContent className="px-4">{item.description}</AccordionContent>}
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Footer text + CTA */}
        <motion.div
          className="flex w-full flex-col gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-pretty font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60">
            {siteConfig.features.footer}
          </p>
          <Button
            asChild
            variant="pill"
            size="sm"
            className="w-full gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
          >
            <a href="https://app.brimble.io" target="_blank" rel="noopener noreferrer">
              {siteConfig.hero.primaryCta}
              <img src={arrowRight} alt="" className="size-3 brightness-0 invert dark:invert-0" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
