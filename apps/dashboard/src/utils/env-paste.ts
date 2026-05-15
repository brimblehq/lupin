export function parseEnvPaste(text: string): Array<{ name: string; value: string }> | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2 && !text.includes("=")) return null;

  const parsed: Array<{ name: string; value: string }> = [];
  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const name = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (name) parsed.push({ name, value });
  }

  return parsed.length > 0 ? parsed : null;
}
