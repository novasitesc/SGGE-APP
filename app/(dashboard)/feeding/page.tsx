import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import FeedingPageClient from "./feeding-page-client";

function FeedingFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando alimentación…
    </div>
  );
}

export default function FeedingPage() {
  return (
    <Suspense fallback={<FeedingFallback />}>
      <FeedingPageClient />
    </Suspense>
  );
}
