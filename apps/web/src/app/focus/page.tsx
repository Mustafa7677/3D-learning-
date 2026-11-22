import type { Metadata } from "next";
import { Focus } from "@/components/focus/Focus";

export const metadata: Metadata = {
  title: "Фокус бөлмесі | INSIDE TECH",
  description: "Терең оқу сессиясы: мақсат, таймер, ойлар тұрағы, бір сөйлем қорытынды және үзіліс. Фокус минуттары мен үйренгендер журналы.",
};

export default function Page() {
  return <Focus />;
}
