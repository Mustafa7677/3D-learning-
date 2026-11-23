import type { Metadata } from "next";
import { Career } from "@/components/career/Career";

export const metadata: Metadata = {
  title: "Кім боламын? | INSIDE TECH",
  description: "Сегіз IT мамандық: маманның бір күні, құралдары, бірінші жоба және осы сайттағы сабақтардан құралған жол картасы. Қызығушылық тесті саған қайсысы жақын екенін көрсетеді.",
};

export default function Page() {
  return <Career />;
}
