import { notFound } from "next/navigation";
import LabPrototype from "../../LabPrototype";

const directions = ["monolith", "instrument", "editorial"] as const;
const views = ["landing", "dashboard", "analysis"] as const;

export default async function LabScreen({
  params,
}: {
  params: Promise<{ direction: string; view: string }>;
}) {
  const { direction, view } = await params;
  if (
    !directions.includes(direction as (typeof directions)[number]) ||
    !views.includes(view as (typeof views)[number])
  )
    notFound();
  return (
    <LabPrototype
      direction={direction as (typeof directions)[number]}
      view={view as (typeof views)[number]}
    />
  );
}
