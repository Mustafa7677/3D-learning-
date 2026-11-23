import type { Metadata } from "next";
import { ComicLibrary } from "@/components/comics/ComicLibrary";

export const metadata: Metadata = {
  title: "Комикс кітапханасы | INSIDE TECH",
  description: "Сайттағы барлық комикс бір сөреде: IT зертханалары, математика курсы және «Қалай оқу керек?». Нұрай, Мустафа және Ұстаз. Кадрма-кадр оқы.",
};

export default function Page() {
  return <ComicLibrary />;
}
