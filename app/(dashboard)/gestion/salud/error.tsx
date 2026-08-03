"use client";

export default function GestionSaludError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border px-6 py-12 text-center space-y-3">
      <h2 className="text-lg font-semibold">Error en Gestión de Salud</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
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
