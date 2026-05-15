import { Fragment, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Menu, X, ArrowLeft, ArrowUpRight } from "lucide-react";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { MarkdownContent } from "@/components/markdown-content";
import { listCareersServerFn, type CareerRole } from "@/server/careers/actions";

export const Route = createFileRoute("/careers/$slug")({
  staleTime: 60_000,
  loader: async (): Promise<CareerRole[]> => {
    return (listCareersServerFn as unknown as () => Promise<CareerRole[]>)();
  },
  head: ({ params, loaderData }) => {
    const roles = (loaderData ?? []) as CareerRole[];
    const role = roles.find((r) => r.slug === params.slug);
    return buildSeoHead({
      title: role ? role.title : "Careers",
      description: role ? role.summary : "Open roles at Brimble.",
      path: `/careers/${params.slug}`,
    });
  },
  component: CareerDetailPage,
});

function CareerDetailPage() {
  const { slug } = Route.useParams();
  const roles = Route.useLoaderData();
  const role = roles.find((r) => r.slug === slug);

  if (!role) {
    throw notFound();
  }

  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main className="px-6 pt-16 pb-20">
        <div className="mx-auto flex max-w-[960px] gap-10">
          {/* Left sidebar — desktop */}
          <aside className="hidden w-[200px] shrink-0 lg:block">
            <SidebarNav roles={roles} activeSlug={slug} />
          </aside>

          {/* Content column */}
          <div className="min-w-0 flex-1">
            {/* Mobile nav toggle */}
            <MobileNav roles={roles} activeSlug={slug} />

            <motion.article
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Document header */}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-[32px] font-medium italic leading-[38px] tracking-[-0.576px] text-brimble-black">
                  {role.title}
                </h1>
                {role.closed && (
                  <span className="inline-flex items-center rounded-full border border-[rgba(152,157,164,0.3)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/50 dark:border-white/10">
                    Closed
                  </span>
                )}
              </div>
              <RoleMeta role={role} />
              <p className="mt-4 font-body text-sm leading-[1.6] text-brimble-black/60">{role.summary}</p>

              {/* Rendered content */}
              <div className="mt-8">
                <MarkdownContent content={role.content} />
              </div>

              {/* Apply CTA / Closed notice */}
              {role.closed ? (
                <div className="mt-10 rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-6 dark:border-white/10">
                  <p className="font-body text-base font-medium text-brimble-black">This role is closed</p>
                  <p className="mt-1 font-body text-sm leading-[1.6] text-brimble-black/60">
                    We're no longer accepting applications for this position. Browse our other open roles, or send a note to{" "}
                    <a href="mailto:hello@brimble.app" className="text-[#006fff] hover:underline">
                      hello@brimble.app
                    </a>
                    .
                  </p>
                  {role.notionUrl && (
                    <div className="mt-4">
                      <a
                        href={role.notionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-brimble-black/70 transition-colors duration-150 hover:text-brimble-black"
                      >
                        View full JD on Notion
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-10 rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-6 dark:border-white/10">
                  <p className="font-body text-base font-medium text-brimble-black">Interested?</p>
                  <p className="mt-1 font-body text-sm leading-[1.6] text-brimble-black/60">
                    Submit through the application form below. We review every application.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={role.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-brimble-black px-4 py-2 font-body text-sm font-medium text-brimble-surface shadow-[var(--shadow-button)] transition-opacity duration-150 hover:opacity-90"
                    >
                      Apply for this role
                      <ArrowUpRight className="size-3.5" />
                    </a>
                    {role.notionUrl && (
                      <a
                        href={role.notionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-brimble-black/70 transition-colors duration-150 hover:text-brimble-black"
                      >
                        View full JD on Notion
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Back link */}
              <div className="mt-8">
                <Link
                  to="/careers"
                  className="inline-flex items-center gap-1.5 font-body text-sm text-brimble-black/50 transition-colors duration-150 hover:text-brimble-black"
                >
                  <ArrowLeft className="size-3.5" />
                  All open roles
                </Link>
              </div>
            </motion.article>
          </div>

          {/* Right sidebar — role details */}
          <aside className="hidden w-[200px] shrink-0 lg:block">
            <div className="sticky top-24">
              <div className="rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-5 dark:border-white/10">
                <p className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50">Role details</p>
                <dl className="mt-3 flex flex-col gap-3 font-body text-xs">
                  {role.level && (
                    <div>
                      <dt className="text-brimble-black/50">Level</dt>
                      <dd className="mt-0.5 text-brimble-black">{role.level}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-brimble-black/50">Location</dt>
                    <dd className="mt-0.5 text-brimble-black">{role.location}</dd>
                  </div>
                  <div>
                    <dt className="text-brimble-black/50">Employment</dt>
                    <dd className="mt-0.5 text-brimble-black">{role.employmentType}</dd>
                  </div>
                  {role.compensation && (
                    <div>
                      <dt className="text-brimble-black/50">Compensation</dt>
                      <dd className="mt-0.5 text-brimble-black">{role.compensation}</dd>
                    </div>
                  )}
                  {role.applicationsClose && (
                    <div>
                      <dt className="text-brimble-black/50">Applications close</dt>
                      <dd className="mt-0.5 text-brimble-black">{role.applicationsClose}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ─── Role Meta ─── */

function RoleMeta({ role }: { role: CareerRole }) {
  const items = [
    role.level,
    role.location,
    role.employmentType,
    role.compensation,
    role.applicationsClose ? `Closes ${role.applicationsClose}` : undefined,
  ].filter(Boolean) as string[];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs text-brimble-black/50">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden className="size-1 rounded-full bg-brimble-black/20" />}
          <span>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}

/* ─── Sidebar Navigation ─── */

function SidebarNav({ roles, activeSlug }: { roles: CareerRole[]; activeSlug: string }) {
  return (
    <div className="sticky top-24">
      <p className="font-heading text-sm font-medium italic text-brimble-black">Open Roles</p>
      <nav className="mt-4 flex flex-col gap-2">
        {roles.map((role) => (
          <Link
            key={role.slug}
            to="/careers/$slug"
            params={{ slug: role.slug }}
            className={`font-body text-sm transition-colors duration-150 ${
              role.slug === activeSlug ? "font-medium text-brimble-black" : "text-brimble-black/40 hover:text-brimble-black/60"
            }`}
          >
            {role.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ─── Mobile Navigation ─── */

function MobileNav({ roles, activeSlug }: { roles: CareerRole[]; activeSlug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 lg:hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 font-body text-sm font-medium text-brimble-black">
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        Open Roles
      </button>
      {open && (
        <nav className="mt-3 flex flex-col gap-2 rounded-[4px] border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-4 dark:border-white/10">
          {roles.map((role) => (
            <Link
              key={role.slug}
              to="/careers/$slug"
              params={{ slug: role.slug }}
              onClick={() => setOpen(false)}
              className={`font-body text-sm transition-colors duration-150 ${
                role.slug === activeSlug ? "font-medium text-brimble-black" : "text-brimble-black/40 hover:text-brimble-black/60"
              }`}
            >
              {role.title}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
