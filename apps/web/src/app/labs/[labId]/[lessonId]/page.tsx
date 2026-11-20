import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findLab } from "@/lib/catalog";
import { lessonEntries } from "@/lib/lessons";
import { LessonView } from "@/components/lab/LessonView";

export function generateStaticParams() {
  return lessonEntries.map((e) => ({ labId: e.labId, lessonId: e.lesson.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ labId: string; lessonId: string }> }): Promise<Metadata> {
  const { labId, lessonId } = await params;
  const lesson = lessonEntries.find((e) => e.lesson.id === lessonId)?.lesson;
  return { title: lesson ? `${lesson.title}: ${findLab(labId)?.title ?? ""} | INSIDE TECH` : "INSIDE TECH" };
}

export default async function LessonPage({ params }: { params: Promise<{ labId: string; lessonId: string }> }) {
  const { labId, lessonId } = await params;
  if (!lessonEntries.some((e) => e.lesson.id === lessonId && e.labId === labId)) notFound();
  return <LessonView lessonId={lessonId} />;
}
