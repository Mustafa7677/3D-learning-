import type { Metadata } from "next";
import { AccountPage } from "@/components/AccountPage";

export const metadata: Metadata = { title: "Аккаунт — INSIDE TECH" };

export default function Page() {
  return <AccountPage />;
}
