"use client";

export default function HealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border px-6 py-12 text-center space-y-3">
      <h2 className="text-lg font-semibold">Error en el módulo Salud</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {error.message || "No se pudo cargar la información sanitaria."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
      >
        Reintentar
      </button>
    </div>
  );
}
