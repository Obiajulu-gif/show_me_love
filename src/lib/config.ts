import { emailConfigured } from "./email";
import { ConfigError, platformFeeBps } from "./money";
import { rasMode } from "./ras";

/** Production boot check: fails loudly (one error listing every problem) instead of breaking on the first user request. */
export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (!process.env.PUBLIC_APP_URL) problems.push("PUBLIC_APP_URL is not set");
  if ((process.env.SESSION_SECRET ?? "").length < 32) problems.push("SESSION_SECRET must be 32+ characters");
  if (!emailConfigured()) problems.push("no email provider configured (BREVO_API_KEY or ZEPTOMAIL_API_KEY)");
  try { rasMode(); } catch (e) { problems.push((e as Error).message); }
  try { platformFeeBps(); } catch (e) { problems.push((e as Error).message); }
  if (problems.length) throw new ConfigError(`Invalid production configuration:\n- ${problems.join("\n- ")}`);
}
