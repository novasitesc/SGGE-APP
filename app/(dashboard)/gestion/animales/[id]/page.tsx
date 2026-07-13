import { AnimalFichaClient } from "@/components/animales/AnimalFichaClient";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; module?: string }>;
};

export default async function AnimalFichaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const q = await searchParams;
  const backHref =
    q.from === "modules" && q.module
      ? `/modules/${encodeURIComponent(q.module)}`
      : "/gestion/animales";

  return <AnimalFichaClient animalId={id} backHref={backHref} />;
}
