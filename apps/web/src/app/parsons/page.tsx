import type { Metadata } from "next";
import { Parsons } from "@/components/parsons/Parsons";

export const metadata: Metadata = {
  title: "Ретке келтір | INSIDE TECH",
  description: "Парсонс есептері: араласқан код жолдары мен процесс қадамдарын дұрыс ретке қой, жалған жолды тап.",
};

export default function Page() {
  return <Parsons />;
}
