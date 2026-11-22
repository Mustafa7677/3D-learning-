import type { Metadata } from "next";
import { ToolsHub } from "@/components/tools/ToolsHub";

export const metadata: Metadata = {
  title: "Оқу құралдары | INSIDE TECH",
  description: "Барлық оқу құралы бір жерде: жоспар, фокус, бос парақ, карточкалар, қателер дәптері, есептер залы, тактика, комикстер және «Қалай оқу керек?» курсы.",
};

export default function Page() {
  return <ToolsHub />;
}
