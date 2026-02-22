import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, Eye, EyeOff } from "lucide-react";
import { TabHeader } from "../../../components/shared/tab-header";

export const Route = createFileRoute("/projects/$projectId/environment")({
  component: EnvironmentPage,
});

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M13.5 4C13.5 4.82843 11.0376 5.5 8 5.5C4.96243 5.5 2.5 4.82843 2.5 4M13.5 4C13.5 3.17157 11.0376 2.5 8 2.5C4.96243 2.5 2.5 3.17157 2.5 4M13.5 4L12 13C12 13 11.5 14 8 14C4.5 14 4 13 4 13L2.5 4M9.25 8.25L6.75 10.75M6.75 8.25L9.25 10.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface EnvVar {
  id: number;
  key: string;
  value: string;
}

type RawFormat = "env" | "json";

let nextId = 3;

function varsToEnv(vars: EnvVar[]): string {
  return vars
    .map((v) => (v.key ? `${v.key}=${v.value}` : ""))
    .filter(Boolean)
    .join("\n");
}

function envToVars(raw: string): EnvVar[] {
  const lines = raw.split("\n");
  let id = 1;
  const result: EnvVar[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      result.push({ id: id++, key: trimmed, value: "" });
    } else {
      result.push({
        id: id++,
        key: trimmed.slice(0, eqIndex),
        value: trimmed.slice(eqIndex + 1),
      });
    }
  }
  return result;
}

function varsToJson(vars: EnvVar[]): string {
  const obj: Record<string, string> = {};
  for (const v of vars) {
    if (v.key) obj[v.key] = v.value;
  }
  return JSON.stringify(obj, null, 2);
}

function jsonToVars(json: string): EnvVar[] {
  try {
    const obj = JSON.parse(json);
    let id = 1;
    return Object.entries(obj).map(([key, value]) => ({
      id: id++,
      key,
      value: String(value),
    }));
  } catch {
    return [];
  }
}

function EnvironmentPage() {
  const [search, setSearch] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [rawFormat, setRawFormat] = useState<RawFormat>("env");
  const [rawText, setRawText] = useState("");
  const [vars, setVars] = useState<EnvVar[]>([
    { id: 1, key: "", value: "" },
    { id: 2, key: "", value: "" },
  ]);
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set());

  function addVar() {
    setVars((prev) => [...prev, { id: nextId++, key: "", value: "" }]);
  }

  function updateVar(id: number, field: "key" | "value", val: string) {
    setVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    );
  }

  function removeVar(id: number) {
    setVars((prev) => prev.filter((v) => v.id !== id));
    setVisibleValues((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleVisibility(id: number) {
    setVisibleValues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterRawMode() {
    const text =
      rawFormat === "json" ? varsToJson(vars) : varsToEnv(vars);
    setRawText(text);
    setRawMode(true);
  }

  function exitRawMode() {
    const parsed =
      rawFormat === "json" ? jsonToVars(rawText) : envToVars(rawText);
    if (parsed.length > 0) {
      nextId = Math.max(...parsed.map((v) => v.id)) + 1;
      setVars(parsed);
    }
    setRawMode(false);
  }

  function switchRawFormat(format: RawFormat) {
    // Convert current raw text to vars, then re-serialize in new format
    const parsed =
      rawFormat === "json" ? jsonToVars(rawText) : envToVars(rawText);
    setRawFormat(format);
    if (parsed.length > 0) {
      setRawText(
        format === "json" ? varsToJson(parsed) : varsToEnv(parsed)
      );
    } else {
      setRawText(format === "json" ? "{\n  \n}" : "");
    }
  }

  const filtered = search
    ? vars.filter(
        (v) =>
          v.key.toLowerCase().includes(search.toLowerCase()) ||
          v.value.toLowerCase().includes(search.toLowerCase())
      )
    : vars;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 py-8">
      <TabHeader title="Environment Variables">
        Set environment-specific config and secrets (such as API keys), then
        read those values from your code.{" "}
        <a href="#" className="text-[#4879f8] underline">
          Learn more
        </a>
      </TabHeader>

      <hr className="border-dash-border" />

      {/* Main card */}
      <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
        {/* Toolbar */}
        <div className="flex items-center gap-3.5 border-b-[0.5px] border-dash-border px-3.5 py-3.5">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2">
            <Search className="size-5 shrink-0 text-dash-text-extra-faded" />
            <input
              type="text"
              placeholder="Search EVNs created"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
            />
          </div>

          {/* Divider */}
          <div className="h-full w-px self-stretch border-r-[0.5px] border-dash-border" />

          {/* Raw Editor button */}
          <button
            onClick={rawMode ? exitRawMode : enterRawMode}
            className={`flex h-[34px] items-center gap-2 rounded-[4px] border px-3.5 text-sm font-medium transition-colors ${
              rawMode
                ? "border-[#3964d5] bg-[#4879f8]/10 text-[#4879f8]"
                : "border-[#e9ebec] text-dash-text-strong hover:bg-dash-bg-elevated"
            }`}
          >
            Raw Editor
          </button>

          {/* Add Variable button */}
          {!rawMode && (
            <button
              onClick={addVar}
              className="flex h-[34px] items-center gap-1 rounded-[4px] border border-[#3964d5] bg-[#4879f8] px-3 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)]"
            >
              <Plus className="size-4" />
              <span className="px-1">Add Variable</span>
            </button>
          )}
        </div>

        {/* Content */}
        {rawMode ? (
          <div className="px-3.5 pb-6 pt-5">
            {/* Format tabs */}
            <div className="mb-3 flex items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border p-0.5 self-start w-fit">
              <button
                onClick={() => switchRawFormat("env")}
                className={`rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
                  rawFormat === "env"
                    ? "bg-dash-bg-elevated text-dash-text-strong"
                    : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                .env
              </button>
              <button
                onClick={() => switchRawFormat("json")}
                className={`rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
                  rawFormat === "json"
                    ? "bg-dash-bg-elevated text-dash-text-strong"
                    : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                JSON
              </button>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                rawFormat === "json"
                  ? '{\n  "API_KEY": "your_key_here",\n  "DATABASE_URL": "postgres://..."\n}'
                  : "API_KEY=your_key_here\nDATABASE_URL=postgres://..."
              }
              spellCheck={false}
              className="h-[240px] w-full resize-y rounded-[4px] border-[0.5px] border-[#d0d5dd] bg-dash-bg px-3.5 py-3 font-mono text-sm leading-6 text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
            />
            <p className="mt-2 text-xs text-dash-text-faded">
              {rawFormat === "json"
                ? "Paste or edit a JSON object with string key-value pairs."
                : "One variable per line in KEY=VALUE format. Lines starting with # are ignored."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-3.5 pb-6 pt-5">
            {filtered.map((envVar) => (
              <div key={envVar.id} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                {/* Key */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.02px] text-dash-text-strong">
                    Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. API_KEY"
                    value={envVar.key}
                    onChange={(e) =>
                      updateVar(envVar.id, "key", e.target.value)
                    }
                    className="h-[34px] w-full rounded-[4px] border-[0.5px] border-[#d0d5dd] bg-dash-bg px-3.5 text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
                  />
                </div>

                {/* Value (password) */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.02px] text-dash-text-strong">
                    Value
                  </label>
                  <div className="flex h-[34px] items-center rounded-[4px] border-[0.5px] border-[#d0d5dd] bg-dash-bg px-3.5">
                    <input
                      type={visibleValues.has(envVar.id) ? "text" : "password"}
                      placeholder="Enter value"
                      value={envVar.value}
                      onChange={(e) =>
                        updateVar(envVar.id, "value", e.target.value)
                      }
                      className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-extra-faded"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(envVar.id)}
                      className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
                    >
                      {visibleValues.has(envVar.id) ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeVar(envVar.id)}
                  className="flex h-[34px] items-center justify-center px-1 text-dash-text-strong transition-colors hover:text-red-500"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
