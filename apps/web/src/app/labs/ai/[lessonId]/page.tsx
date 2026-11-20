import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { aiLessons } from "@inside-tech/lab-ai";
import { LessonView } from "@/components/lab/LessonView";

export function generateStaticParams() {
  return aiLessons.map((l) => ({ lessonId: l.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = aiLessons.find((l) => l.id === lessonId);
  return { title: lesson ? `${lesson.title} — AI LAB — INSIDE TECH` : "INSIDE TECH" };
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!aiLessons.some((l) => l.id === lessonId)) notFound();
  return <LessonView lessonId={lessonId} />;
}
