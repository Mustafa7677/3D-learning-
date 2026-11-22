import type { Metadata } from "next";
import { Today } from "@/components/today/Today";

export const metadata: Metadata = {
  title: "Бүгін | INSIDE TECH",
  description: "Бүгінгі оқу жоспары: еске түсір, жаңасын үйрен, қиын есеппен сына. Апта мақсаты, белсенділік картасы және шеберлік.",
};

export default function Page() {
  return <Today />;
}
