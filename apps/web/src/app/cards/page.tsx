import type { Metadata } from "next";
import { Cards } from "@/components/cards/Cards";

export const metadata: Metadata = {
  title: "Есте сақтау карточкалары | INSIDE TECH",
  description: "Он зертханадан 20 карточка. Білгенің сирек қайтады, білмегенің бүгін қайта шығады.",
};

export default function Page() {
  return <Cards />;
}
