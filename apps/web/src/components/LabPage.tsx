import { CipherDemo } from "./film/CipherDemo";
import { LabFilm } from "./film/LabFilm";
import { PidDemo } from "./film/PidDemo";
import landing from "./film/landing.module.css";
import { findLab } from "@/lib/catalog";

/** A hands-on warm-up before the lessons, for the labs that have one. */
const WARMUP: Record<string, () => React.ReactNode> = {
  iot: () => <PidDemo micro="ЖЫЛЫНУ / ROBOTICS / CONTROL" />,
  sec: () => <CipherDemo micro="ЖЫЛЫНУ / SECURITY / CHALLENGE" />,
};

export function LabPage({ labId }: { labId: string }) {
  const lab = findLab(labId);
  if (!lab || lab.status !== "open") return null;
  const warm = WARMUP[lab.id];
  return <LabFilm lab={lab} warmup={warm && <div className={landing.landing}>{warm()}</div>} />;
}
