const HIGHLIGHT_RE = new RegExp(
  [
    "(?<comment>//[^\\n]*|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->)",
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<tag></?[A-Za-z][\\w-]*|/?>)",
    "(?<attr>[A-Za-z][\\w-]*(?==))",
    "(?<keyword>\\b(?:import|from|export|default|function|const|let|var|return|if|else|for|while|new|null|true|false|undefined|typeof|async|await|class|extends|this|super|try|catch|finally|throw|setup|onMounted)\\b)",
    "(?<number>\\b\\d+\\b)",
    "(?<ident>[A-Za-z_$][\\w$]*)",
  ].join("|"),
  "g",
);

export const TOKEN_CLASS: Record<string, string> = {
  comment: "italic text-dash-text-extra-faded",
  string: "text-[#0e7c66] dark:text-[#5eead4]",
  tag: "text-[#b4366b] dark:text-[#f9a8d4]",
  attr: "text-[#9a5b00] dark:text-[#fcd34d]",
  keyword: "text-[#7c3aed] dark:text-[#c4b5fd]",
  number: "text-[#9a5b00] dark:text-[#fcd34d]",
  ident: "",
};

export interface SyntaxToken {
  text: string;
  cls: string;
}

export function tokenizeCode(code: string): SyntaxToken[] {
  const out: SyntaxToken[] = [];
  let last = 0;
  for (const m of code.matchAll(HIGHLIGHT_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: code.slice(last, start), cls: "" });
    const type = Object.keys(m.groups ?? {}).find((k) => m.groups?.[k] != null) ?? "";
    out.push({ text: m[0], cls: TOKEN_CLASS[type] ?? "" });
    last = start + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: "" });
  return out;
}
