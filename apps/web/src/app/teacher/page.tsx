import type { Metadata } from "next";
import { TeacherPage } from "@/components/TeacherPage";

export const metadata: Metadata = { title: "Мұғалім панелі — INSIDE TECH" };

export default function Page() {
  return <TeacherPage />;
}
