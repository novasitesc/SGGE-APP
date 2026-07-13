import { ModuloDetalleClient } from "@/components/modulos/ModuloDetalleClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ModuleDetailPage({ params }: Props) {
  const { id } = await params;
  return <ModuloDetalleClient moduleCode={decodeURIComponent(id)} />;
}
