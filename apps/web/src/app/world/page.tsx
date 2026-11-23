import type { Metadata } from "next";
import { World } from "@/components/world/World";

export const metadata: Metadata = {
  title: "IT архипелагы | INSIDE TECH",
  description: "Әр зертхана бір арал: қорғаушы гаджет, сабақтар жолы, арал боссы және қазына. Боссты жеңу үшін оның сұрақтарына жауап бер.",
};

export default function Page() {
  return <World />;
}
