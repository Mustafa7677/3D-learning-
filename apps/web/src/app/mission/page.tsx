import type { Metadata } from "next";
import { Mission } from "@/components/mission/Mission";

export const metadata: Metadata = {
  title: "Миссия: Бір қаланың интернеті | INSIDE TECH",
  description: "Мектеп сайты таңертең жылдам, сабақ басталғанда баяу. Себебін өлшеп тап, бір түзету таңда, қарсы сынақпен тексер және инженерлік есеп жаз.",
};

export default function Page() {
  return <Mission />;
}
