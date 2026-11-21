import type { Metadata } from "next";
import { Comic } from "@/components/comic/Comic";

export const metadata: Metadata = {
  title: "Комикс: Үш қол алысу | INSIDE TECH",
  description: "TCP, TLS және HTTP комикс түрінде: браузердің орнына сен сөйлейсің, қате таңдасаң, салдарын көресің.",
};

export default function Page() {
  return <Comic />;
}
