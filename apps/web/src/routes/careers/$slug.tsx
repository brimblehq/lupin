import { Fragment, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Menu, X, ArrowLeft, ArrowUpRight } from "lucide-react";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
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
                <RoleContent content={role.content} />
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
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brimble-black px-4 py-2 font-body text-sm font-medium text-brimble-surface shadow-[var(--shadow-button)] transition-opacity duration-150 hover:opacity-90"
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
        <nav className="mt-3 flex flex-col gap-2 rounded-lg border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-4 dark:border-white/10">
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

/* ─── Content Renderer ─── */

function RoleContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="mb-4 list-disc pl-5">
          {listItems.map((item, i) => (
            <li key={i} className="mb-1 font-body text-sm leading-[1.7] text-brimble-black/70">
              <Linkify text={item} />
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "---") {
      flushList();
      elements.push(<hr key={key++} className="my-6 border-brimble-black/10" />);
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="mt-6 mb-2 font-body text-base font-medium text-brimble-black">
          {line.slice(4)}
        </h3>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="mt-8 mb-3 font-body text-lg font-medium text-brimble-black">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    if (line.trim() === "") {
      flushList();
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className="mb-4 font-body text-sm leading-[1.7] text-brimble-black/70">
        <Linkify text={line} />
      </p>,
    );
  }

  flushList();

  return <>{elements}</>;
}

/* ─── Inline formatter: [text](url), emails, `code` ─── */

function Linkify({ text }: { text: string }) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|`([^`]+)`/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      parts.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#006fff] hover:underline"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      parts.push(
        <a key={key++} href={`mailto:${match[3]}`} className="text-[#006fff] hover:underline">
          {match[3]}
        </a>,
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-brimble-black/5 px-1 py-0.5 font-mono text-[0.85em] text-brimble-black dark:bg-white/10"
        >
          {match[4]}
        </code>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return <>{text}</>;
  return <>{parts}</>;
}
