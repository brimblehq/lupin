import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { siteConfig } from "@/config/site";
import { Button } from "@brimble/ui";
import beeHero from "@/assets/images/bee.svg";
import arrowRight from "@/assets/icons/arrow-right.svg";

const YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";

function VideoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-3xl aspect-video rounded-xl overflow-hidden bg-black shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm font-body cursor-pointer"
        >
          Close
        </button>
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
          title="Brimble demo video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const [showVideo, setShowVideo] = useState(false);
  const closeVideo = useCallback(() => setShowVideo(false), []);

  return (
    <>
      <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-16 pt-10">
        <div className="mx-auto flex max-w-[720px] flex-col items-start gap-4">
          <motion.div
            className="h-[300px] w-[300px] md:h-[400px] md:w-[400px] bg-brimble-surface bg-contain bg-bottom bg-no-repeat [background-blend-mode:multiply] dark:bg-[#dddad7] dark:invert dark:opacity-85"
            style={{ backgroundImage: `url(${beeHero})` }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -8, 0],
            }}
            transition={{
              opacity: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
              y: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.8,
              },
            }}
            role="img"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <motion.h1
                className="font-heading text-[44px] font-medium leading-[50px] tracking-[-0.576px] text-brimble-black"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                {siteConfig.hero.heading}
              </motion.h1>
              <motion.p
                className="text-pretty font-body text-base leading-[21px] tracking-[-0.32px] text-black/60 dark:text-white/60"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {siteConfig.hero.subtitle}
              </motion.p>
            </div>
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Button
                asChild
                variant="pill"
                size="sm"
                className="flex-1 gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
              >
                <a href="https://app.brimble.io" target="_blank" rel="noopener noreferrer">
                  {siteConfig.hero.primaryCta}
                  <img src={arrowRight} alt="" className="size-3 dark:brightness-0" />
                </a>
              </Button>
              <Button
                variant="ghost-nav"
                size="sm"
                className="gap-1.5 transition-opacity duration-150 hover:opacity-70 cursor-pointer"
                onClick={() => setShowVideo(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="size-3.5"
                >
                  <path d="M3 3.732a1.5 1.5 0 0 1 2.305-1.265l6.706 4.267a1.5 1.5 0 0 1 0 2.531l-6.706 4.268A1.5 1.5 0 0 1 3 12.267V3.732Z" />
                </svg>
                {siteConfig.hero.secondaryCta}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showVideo && <VideoModal onClose={closeVideo} />}
      </AnimatePresence>
    </>
  );
}
