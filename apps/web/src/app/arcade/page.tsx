import type { Metadata } from "next";
import { Arcade } from "@/components/arcade/Arcade";

export const metadata: Metadata = {
  title: "Ойын залы | INSIDE TECH",
  description: "Төрт аркада ойыны: Бит-метеор, Қақпа жарысы, Фишинг сүзгісі, Кэш сақшысы. Ойна, медаль жина, IT-ді жылдамдықпен жаттықтыр.",
};

export default function Page() {
  return <Arcade />;
}
