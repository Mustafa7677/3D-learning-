import type { Metadata } from "next";
import { Passport } from "@/components/passport/Passport";

export const metadata: Metadata = {
  title: "Оқу паспорты | INSIDE TECH",
  description: "Тоқтаған сабағыңды жалғастыр, он зертханадағы прогресіңді және аяқталған сабақтарыңды бір беттен көр.",
};

export default function Page() {
  return <Passport />;
}
