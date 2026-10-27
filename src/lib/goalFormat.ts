/** Display helpers shared by server and client goal components. */
export type GoalCurrency = "NGN" | "USD";

export function formatMoney(currency: GoalCurrency, v: number | string): string {
  const n = Number(v);
  return currency === "NGN"
    ? `₦${Math.round(n).toLocaleString("en-NG")}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function percent(raised: number | string, target: number): number {
  return target > 0 ? Math.min(100, Math.floor((Number(raised) / target) * 100)) : 0;
}
