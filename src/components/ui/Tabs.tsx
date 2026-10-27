"use client";

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-line bg-white p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === t.id ? "bg-honey text-honey-ink" : "text-cocoa-2 hover:bg-cream-2"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
