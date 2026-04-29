import type React from "react";

export function MarkdownContent({ content }: { content: string }) {
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

    const listItem = parseListItem(line);
    if (listItem) {
      listItems.push(listItem);
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

function parseListItem(line: string): string | null {
  const match = line.match(/^\s*([-*•])\s+(.*)$/);
  if (!match) return null;
  const item = match[2]?.trim();
  if (!item) return null;
  return item;
}

function Linkify({ text }: { text: string }) {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-brimble-black/5 px-1 py-0.5 font-mono text-[0.85em] text-brimble-black dark:bg-white/10"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-brimble-black">
          {match[2]}
        </strong>,
      );
    } else if (match[3] && match[4]) {
      parts.push(
        <a
          key={key++}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#006fff] hover:underline"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5]) {
      parts.push(
        <a key={key++} href={`mailto:${match[5]}`} className="text-[#006fff] hover:underline">
          {match[5]}
        </a>,
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
