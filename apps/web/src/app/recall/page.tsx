import type { Metadata } from "next";
import { Recall } from "@/components/recall/Recall";

export const metadata: Metadata = {
  title: "Бос парақ | INSIDE TECH",
  description: "Еркін еске түсіру: оқыған тақырыбыңды қарамай жаз, қай негізгі ойлар келмегенін көр, келесі қайталау аралықпен жоспарланады.",
};

export default function Page() {
  return <Recall />;
}
