import { percent } from "@/lib/goalFormat";

export function GoalBar({ raised, target }: { raised: number | string; target: number }) {
  const p = percent(raised, target);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label="Goal progress" className="h-3 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-honey" style={{ width: `${p}%` }} />
    </div>
  );
}
