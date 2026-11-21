import type { Metadata } from "next";
import { BlackBox } from "@/components/blackbox/BlackBox";

export const metadata: Metadata = {
  title: "Қара жәшік | INSIDE TECH",
  description: "Ішіндегі сұлбасы жасырын құрылғы: қосқыштармен тәжірибе жаса, AND, OR, NOT элементтерінен сұлба құрастыр да, жәшікті аш.",
};

export default function Page() {
  return <BlackBox />;
}
