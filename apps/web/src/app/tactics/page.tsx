import type { Metadata } from "next";
import { Tactics } from "@/components/tactics/Tactics";

export const metadata: Metadata = {
  title: "Тактика алаңы | INSIDE TECH",
  description: "Тактикалық ойындар: векторлармен навигация және функция графигін түрлендіру карталары. Алдымен жоспар, сосын әрекет.",
};

export default function Page() {
  return <Tactics />;
}
