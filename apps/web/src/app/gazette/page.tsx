import type { Metadata } from "next";
import { Gazette } from "@/components/gazette/Gazette";

export const metadata: Metadata = {
  title: "INSIDE TECH газеті, № 1 | INSIDE TECH",
  description: "Бас мақала, он зертхананың он сөзінен құралған сөзжұмбақ және үш дерек. Экранда шеш немесе басып шығар.",
};

export default function Page() {
  return <Gazette />;
}
