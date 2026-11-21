import type { Metadata } from "next";
import { JourneyFilm } from "@/components/film/JourneyFilm";

export const metadata: Metadata = {
  title: "Бір басудың саяхаты | INSIDE TECH",
  description: "Enter басқаннан бет ашылғанға дейінгі 185 миллисекунд: пернетақта, DNS, TCP, TLS, бұлт, дерекқор, AI және экранға салу.",
};

export default function Page() {
  return <JourneyFilm />;
}
