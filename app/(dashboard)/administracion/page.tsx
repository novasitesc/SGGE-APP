import { Suspense } from "react";
import { AdministracionShell } from "@/components/administracion/AdministracionShell";
import { Loader2 } from "lucide-react";

function AdminFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando administración…
    </div>
  );
}

export default function AdministracionPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdministracionShell />
    </Suspense>
  );
}
