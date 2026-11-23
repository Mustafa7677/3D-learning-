import type { Metadata } from "next";
import { Teach } from "@/components/teach/Teach";

export const metadata: Metadata = {
  title: "Мустафаға түсіндір | INSIDE TECH",
  description: "Фейнман әдісі: тақырыпты ештеңе білмейтін досыңа қарапайым түсіндір. Мустафа «Неге?», «Мысал келтірші?» деп саңылауларды табады.",
};

export default function Page() {
  return <Teach />;
}
