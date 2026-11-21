import type { Metadata } from "next";
import { Sky } from "@/components/sky/Sky";

export const metadata: Metadata = {
  title: "Білім аспаны | INSIDE TECH",
  description: "Әр сабақ бір жұлдыз, әр зертхана бір шоқжұлдыз. Аяқтағаның жанады, Темірқазық келесі қадамыңды көрсетеді.",
};

export default function Page() {
  return <Sky />;
}
