import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MensajeriaGerente } from "@/components/mensajeria/MensajeriaGerente";

export default function GestionMensajeriaPage() {
  return (
    <MensajeriaGerente
      showBackLink={
        <Link
          href="/gestion"
          className="flex items-center justify-center w-9 h-9 rounded-xl border hover:bg-muted transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      }
    />
  );
}
