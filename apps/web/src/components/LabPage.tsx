import { LabFilm } from "./film/LabFilm";
import { findLab } from "@/lib/catalog";

export function LabPage({ labId }: { labId: string }) {
  const lab = findLab(labId);
  if (!lab || lab.status !== "open") return null;
  return <LabFilm lab={lab} />;
}
