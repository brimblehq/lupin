import { Fragment, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { Cta } from "@/components/sections/cta";
import { listCareersServerFn, type CareerRole } from "@/server/careers/actions";

export const Route = createFileRoute("/careers/")({
  head: () =>
    buildSeoHead({
      title: "Careers",
      description:
        "Help us build the cloud platform developers actually enjoy using. Open roles in product and engineering at Brimble.",
      path: "/careers",
    }),
  staleTime: 60_000,
  loader: async (): Promise<CareerRole[]> => {
    return (listCareersServerFn as unknown as () => Promise<CareerRole[]>)();
  },
  component: CareersPage,
});

function CareersPage() {
  const roles = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <CareersHero />
        <OpenRoles roles={roles} />
        <Cta />
      </main>
    </div>
  );
}

/* ─── Hero Section ─── */

function CareersHero() {
  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-4 pt-16">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <motion.h1
          className="font-heading text-[48px] font-medium italic leading-[54px] tracking-[-0.576px] text-brimble-black"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Careers
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
          We're building the cloud platform developers actually enjoy using. Small team, big surface area, real ownership. Here's what we're hiring for right now.
        </motion.p>
      </div>
    </section>
  );
}

/* ─── Open Roles ─── */

function OpenRoles({ roles }: { roles: CareerRole[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  if (roles.length === 0) {
    return (
      <section className="bg-brimble-surface transition-colors duration-300 px-6 py-10">
        <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-4">
          <motion.p
            className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50"
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            Open roles · 0
          </motion.p>
          <motion.div
            className="rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-8 text-center dark:border-white/10"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-body text-base font-medium text-brimble-black">No open roles right now</p>
            <p className="mt-1 font-body text-sm leading-[1.6] text-brimble-black/60">
              Check back soon, or send a note to{" "}
              <a href="mailto:hello@brimble.app" className="text-[#006fff] hover:underline">
                hello@brimble.app
              </a>{" "}
              if you're excited about what we're building.
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-10">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-6">
        <motion.p
          className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Open roles · {roles.length}
        </motion.p>

        <div className="flex flex-col gap-4">
          {roles.map((role, i) => (
            <motion.div
              key={role.slug}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.15 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                to="/careers/$slug"
                params={{ slug: role.slug }}
                className={`group flex flex-col gap-3 rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-6 transition-colors duration-200 hover:border-[rgba(152,157,164,0.5)] dark:border-white/10 dark:hover:border-white/20 ${
                  role.closed ? "opacity-60 hover:opacity-80" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-body text-base font-medium text-brimble-black">{role.title}</h2>
                      {role.closed && (
                        <span className="inline-flex items-center rounded-full border border-[rgba(152,157,164,0.3)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/50 dark:border-white/10">
                          Closed
                        </span>
                      )}
                    </div>
                    <RoleMeta role={role} />
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-brimble-black/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brimble-black" />
                </div>
                <p className="font-body text-sm leading-[1.6] text-brimble-black/60">{role.summary}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mt-4 font-body text-sm leading-[1.6] text-brimble-black/50"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.15 * roles.length, ease: [0.16, 1, 0.3, 1] }}
        >
          Don't see the right fit? If you're excited about what we're building, send a note to{" "}
          <a href="mailto:hello@brimble.app" className="text-[#006fff] hover:underline">
            hello@brimble.app
          </a>
          .
        </motion.p>
      </div>
    </section>
  );
}

function RoleMeta({ role }: { role: CareerRole }) {
  const items = [
    role.level,
    role.location,
    role.employmentType,
    role.compensation,
    role.applicationsClose ? `Closes ${role.applicationsClose}` : undefined,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs text-brimble-black/50">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden className="size-1 rounded-full bg-brimble-black/20" />}
          <span>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}
