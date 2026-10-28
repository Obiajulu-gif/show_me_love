const ACCENTS: Record<string, { bg: string; fg: string }> = {
  honey: { bg: "#33E0BE", fg: "#062520" },
  cocoa: { bg: "#171E45", fg: "#EEF0FF" },
  sage: { bg: "#FF8197", fg: "#2A0811" },
};

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function creatorLink(username: string, origin = process.env.PUBLIC_APP_URL ?? ""): string {
  return `${origin.replace(/\/$/, "")}/@${encodeURIComponent(username)}`;
}

export const shareText = (message: string, link: string) => `${message}\n${link}`;
export const xIntent = (text: string) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export type EmbedCreator = { username: string; displayName: string; treatName: string; accent?: string };

/** Self-contained button for a creator's own website. Every interpolated value is HTML-escaped. */
export function embedHtml(c: EmbedCreator, origin?: string): string {
  const a = ACCENTS[c.accent ?? "honey"] ?? ACCENTS.honey;
  const href = creatorLink(c.username, origin);
  const style = `display:inline-block;padding:10px 18px;border-radius:12px;background:${a.bg};color:${a.fg};font:600 16px system-ui,sans-serif;text-decoration:none;box-shadow:0 0 0 1px rgba(255,255,255,.18) inset,0 6px 18px rgba(51,224,190,.28)`;
  return `<a href="${esc(href)}" target="_blank" rel="noopener" title="${esc(c.displayName)}" style="${style}">Send me a ${esc(c.treatName)}</a>`;
}
