import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { siteConfig } from "@/config/site";
import { Button } from "@brimble/ui";
import brimbleLogoWhite from "@/assets/icons/brimble-logo-white.svg";
import trainStation from "@/assets/images/train-station.svg";
import arrowRight from "@/assets/icons/arrow-right.svg";

export function Cta() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-8">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col items-center gap-4">
        {/* Buttons row */}
        <motion.div
          className="flex w-full items-center gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            variant="pill"
            size="sm"
            className="flex-1 gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
          >
            {siteConfig.cta.buttons.primary}
            <img src={arrowRight} alt="" className="size-3 brightness-0 invert dark:invert-0" />
          </Button>
          <Button
            variant="pill-light"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            {siteConfig.cta.buttons.secondary}
          </Button>
          <Button
            variant="pill-light"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            {siteConfig.cta.buttons.tertiary}
          </Button>
        </motion.div>

        {/* Blue CTA Card */}
        <motion.div
          className="relative flex h-[603px] w-full flex-col items-center overflow-hidden rounded-3xl bg-brimble-accent-blue"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Top content: Logo + Heading */}
          <div className="relative z-10 flex flex-col items-center gap-6 px-8 pt-10">
            <img
              src={brimbleLogoWhite}
              alt="Brimble"
              className="h-[26px] w-auto"
            />
            <h2 className="max-w-[450px] text-balance text-center font-heading text-[40px] font-medium leading-none tracking-[-0.576px] text-white">
              {siteConfig.cta.heading}
            </h2>
          </div>

          {/* Train station illustration */}
          <img
            src={trainStation}
            alt=""
            className="absolute bottom-[66px] left-1/2 h-[335px] w-auto -translate-x-1/2 mix-blend-multiply dark:invert dark:mix-blend-screen opacity-50"
            loading="lazy"
          />

          {/* Footer text */}
          <p className="absolute bottom-10 left-1/2 z-10 w-[414px] max-w-[90%] -translate-x-1/2 text-center font-body text-base leading-[21px] tracking-[-0.32px] text-[#fafafa]">
            {siteConfig.cta.footer}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
