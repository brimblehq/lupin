import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { buildSeoHead } from "@/config/seo";
import { Navbar } from "@/components/layout/navbar";
import { legalDocuments } from "@/data/legal";

export const Route = createFileRoute("/legal/$slug")({
  head: ({ params }) => {
    const doc = legalDocuments.find((d) => d.slug === params.slug);
    return buildSeoHead({
      title: doc ? doc.title : "Legal",
      description: doc ? doc.description : "Brimble legal documentation.",
      path: `/legal/${params.slug}`,
    });
  },
  component: LegalDetailPage,
});

function LegalDetailPage() {
  const { slug } = Route.useParams();
  const doc = legalDocuments.find((d) => d.slug === slug);

  if (!doc) {
    throw notFound();
  }

  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main className="px-6 pt-16 pb-20">
        <div className="mx-auto flex max-w-[960px] gap-10">
          {/* Left sidebar — desktop */}
          <aside className="hidden w-[200px] shrink-0 lg:block">
            <SidebarNav activeSlug={slug} />
          </aside>

          {/* Content column */}
          <div className="min-w-0 flex-1">
            {/* Mobile nav toggle */}
            <MobileNav activeSlug={slug} />

            <motion.article
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Document header */}
              <h1 className="font-heading text-[32px] font-medium italic leading-[38px] tracking-[-0.576px] text-brimble-black">
                {doc.title}
              </h1>
              <p className="mt-2 font-body text-sm text-brimble-black/40">Last Updated: {doc.lastUpdated}</p>

              {/* Rendered content */}
              <div className="mt-8">
                <LegalContent content={doc.content} />
              </div>
            </motion.article>
          </div>

          {/* Right sidebar — company info */}
          <aside className="hidden w-[200px] shrink-0 lg:block">
            <div className="sticky top-24">
              <div className="rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-5 dark:border-white/10">
                <p className="font-body text-sm font-medium text-brimble-black">Brimble Inc</p>
                <div className="mt-3 flex flex-col gap-1.5 font-body text-xs leading-[1.6] text-brimble-black/50">
                  <p>447 Broadway, 2nd Floor #332</p>
                  <p>New York, NY 10013</p>
                  <p>United States</p>
                </div>
                <div className="my-3 h-px bg-[rgba(152,157,164,0.2)] dark:bg-white/10" />
                <div className="flex flex-col gap-1.5 font-body text-xs text-brimble-black/50">
                  <a href="mailto:support@brimble.app" className="text-[#006fff] hover:underline">
                    support@brimble.app
                  </a>
                  <a href="mailto:legal@brimble.app" className="text-[#006fff] hover:underline">
                    legal@brimble.app
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ─── Sidebar Navigation ─── */

function SidebarNav({ activeSlug }: { activeSlug: string }) {
  return (
    <div className="sticky top-24">
      <p className="font-heading text-sm font-medium italic text-brimble-black">Legal</p>
      <nav className="mt-4 flex flex-col gap-2">
        {legalDocuments.map((doc) => (
          <Link
            key={doc.slug}
            to="/legal/$slug"
            params={{ slug: doc.slug }}
            className={`font-body text-sm transition-colors duration-150 ${
              doc.slug === activeSlug ? "font-medium text-brimble-black" : "text-brimble-black/40 hover:text-brimble-black/60"
            }`}
          >
            {doc.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ─── Mobile Navigation ─── */

function MobileNav({ activeSlug }: { activeSlug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 lg:hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 font-body text-sm font-medium text-brimble-black">
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        Legal Documents
      </button>
      {open && (
        <nav className="mt-3 flex flex-col gap-2 rounded-[4px] border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-4 dark:border-white/10">
          {legalDocuments.map((doc) => (
            <Link
              key={doc.slug}
              to="/legal/$slug"
              params={{ slug: doc.slug }}
              onClick={() => setOpen(false)}
              className={`font-body text-sm transition-colors duration-150 ${
                doc.slug === activeSlug ? "font-medium text-brimble-black" : "text-brimble-black/40 hover:text-brimble-black/60"
              }`}
            >
              {doc.title}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/* ─── Content Renderer ─── */

function LegalContent({ content }: { content: string }) {
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

    // Horizontal rule
    if (line.trim() === "---") {
      flushList();
      elements.push(<hr key={key++} className="my-6 border-brimble-black/10" />);
      continue;
    }

    // H3 (### )
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="mt-6 mb-2 font-body text-base font-medium text-brimble-black">
          {line.slice(4)}
        </h3>,
      );
      continue;
    }

    // H2 (## )
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="mt-8 mb-3 font-body text-lg font-medium text-brimble-black">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }

    // List item (- )
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Paragraph
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

/* ─── Email Linkifier ─── */

function Linkify({ text }: { text: string }) {
  // Match email addresses
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = text.split(emailRegex);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        emailRegex.test(part) ? (
          <a key={i} href={`mailto:${part}`} className="text-[#006fff] hover:underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
