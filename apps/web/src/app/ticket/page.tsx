import type { Metadata } from "next";
import { Ticket } from "@/components/ticket/Ticket";

export const metadata: Metadata = {
  title: "Емтихан билеті | INSIDE TECH",
  description: "Әр зертханадан аралас бес сұрақ және сенімділікті бағалау: сенімің біліміңе сай ма?",
};

export default function Page() {
  return <Ticket />;
}
