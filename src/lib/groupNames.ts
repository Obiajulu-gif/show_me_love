/** Commas or newlines, trimmed, leading @ stripped, lowercased, deduped (first wins). Pure, so the browser can use it too. */
export function parseUsernames(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const u = part.trim().replace(/^@/, "").toLowerCase();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}
