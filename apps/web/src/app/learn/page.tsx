import type { Metadata } from "next";
import { LearnHow } from "@/components/learn/LearnHow";

export const metadata: Metadata = {
  title: "Қалай оқу керек? | INSIDE TECH",
  description: "Комикс-курс: оқу туралы жеті танымал сенімді Нұрай, Мустафа және Ұстаз тексереді. Миф пе, шындық па? Әр эпизод сайттағы нақты құралға апарады.",
};

export default function Page() {
  return <LearnHow />;
}
