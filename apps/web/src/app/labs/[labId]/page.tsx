import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LabPage } from "@/components/LabPage";
import { findLab, openLabs } from "@/lib/catalog";

export function generateStaticParams() {
  return openLabs.map((l) => ({ labId: l.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ labId: string }> }): Promise<Metadata> {
  const { labId } = await params;
  const lab = findLab(labId);
  return { title: lab ? `${lab.title} — INSIDE TECH` : "INSIDE TECH" };
}

export default async function Page({ params }: { params: Promise<{ labId: string }> }) {
  const { labId } = await params;
  if (!openLabs.some((l) => l.id === labId)) notFound();
  return <LabPage labId={labId} />;
}
