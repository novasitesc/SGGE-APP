export default function HealthLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-2xl bg-muted/40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted/40" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-muted/40" />
    </div>
  );
}
