import { AnimalFichaClient } from "@/components/animales/AnimalFichaClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AnimalFichaPage({ params }: Props) {
  const { id } = await params;
  return <AnimalFichaClient animalId={id} />;
}
