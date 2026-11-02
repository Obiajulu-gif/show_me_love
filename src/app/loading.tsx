export default function Loading() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-fg" aria-busy="true">
      <p className="sr-only">Loading</p>
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-8 w-44 rounded-lg bg-surface-2" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="h-36 rounded-2xl bg-surface" />
          <div className="h-36 rounded-2xl bg-surface" />
          <div className="h-36 rounded-2xl bg-surface" />
        </div>
        <div className="mt-6 h-64 rounded-2xl bg-surface" />
      </div>
    </main>
  );
}
