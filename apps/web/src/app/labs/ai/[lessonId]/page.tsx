import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lessonEntries } from "@/lib/lessons";
import { LessonView } from "@/components/lab/LessonView";

export function generateStaticParams() {
  return lessonEntries.map((e) => ({ lessonId: e.lesson.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = lessonEntries.find((e) => e.lesson.id === lessonId)?.lesson;
  return { title: lesson ? `${lesson.title} — AI LAB — INSIDE TECH` : "INSIDE TECH" };
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!lessonEntries.some((e) => e.lesson.id === lessonId)) notFound();
  return <LessonView lessonId={lessonId} />;
}
