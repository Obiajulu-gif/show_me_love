/** Client-safe stamp styles. Keep this module free of database imports. */
export const STAMP_STYLES = ["honey", "cocoa", "sage"] as const;
export type StampStyle = (typeof STAMP_STYLES)[number];

export function isStampStyle(v: unknown): v is StampStyle {
  return typeof v === "string" && (STAMP_STYLES as readonly string[]).includes(v);
}
