import type { Metadata } from "next";
import { Notebook } from "@/components/notebook/Notebook";

export const metadata: Metadata = {
  title: "Қателер дәптері | INSIDE TECH",
  description: "Сабақтарда қате берген сұрақтарың мен расталмаған болжамдарың: бір дәптерде, қайталау кестесімен.",
};

export default function Page() {
  return <Notebook />;
}
