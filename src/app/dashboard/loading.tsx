export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px]" aria-label="Loading dashboard" aria-live="polite">
      <div className="h-44 animate-pulse rounded-[2rem] border bg-gradient-to-br from-line/40 to-violet-100/40" />
      <div className="mt-6 h-44 animate-pulse rounded-3xl border bg-emerald-50/60" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({length:6},(_,index)=><div className="h-28 animate-pulse rounded-2xl bg-line/40" key={index}/>)}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="card h-36 animate-pulse bg-line/40" key={index} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><div className="card h-96 animate-pulse bg-line/40"/><div className="card h-96 animate-pulse bg-line/40"/></div>
      <span className="sr-only">Loading dashboard data…</span>
    </div>
  );
}
