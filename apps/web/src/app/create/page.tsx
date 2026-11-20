import type { Metadata } from "next";
import { CreatorPage } from "@/components/CreatorPage";

export const metadata: Metadata = { title: "Сабақ жасау — INSIDE TECH" };

export default function Page() {
  return <CreatorPage />;
}
