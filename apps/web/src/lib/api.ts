/**
 * Client for apps/api. Enabled only when NEXT_PUBLIC_API_URL is set at build
 * time; without it the app runs fully in the browser (progress in localStorage).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const apiEnabled = API_URL.length > 0;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    credentials: "include",
    ...init,
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let code = "error";
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface Me {
  id: string;
  name: string | null;
  email: string | null;
  role: "student" | "teacher" | "admin";
  plan: "free" | "premium" | "classroom";
  signedIn: boolean;
}
export interface ClassInfo {
  id: string;
  name: string;
  code?: string;
  teacherId: string;
}
export interface AssignmentInfo {
  id: string;
  classId: string;
  lessonId: string;
  dueAt: number | null;
}
export interface Report {
  class: ClassInfo;
  assignments: AssignmentInfo[];
  students: { id: string; name: string; lessons: Record<string, { started: boolean; completed: boolean; objectivesDone: number }> }[];
}

export const getMe = () => api<Me>("/auth/me");
export const signInUrl = (returnTo: string) => `${API_URL}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
export const logout = () => api<void>("/auth/logout", { method: "POST" });
export const listClasses = () => api<{ teaching: ClassInfo[]; joined: ClassInfo[] }>("/v1/classes");
export const createClass = (name: string) => api<ClassInfo>("/v1/classes", { method: "POST", body: JSON.stringify({ name }) });
export const joinClass = (code: string) => api<{ id: string; name: string }>("/v1/classes/join", { method: "POST", body: JSON.stringify({ code }) });
export const classAssignments = (id: string) => api<AssignmentInfo[]>(`/v1/classes/${id}/assignments`);
export const classReport = (id: string) => api<Report>(`/v1/classes/${id}/report`);
export const assignLesson = (id: string, lessonId: string) => api<AssignmentInfo>(`/v1/classes/${id}/assignments`, { method: "POST", body: JSON.stringify({ lessonId }) });
export const checkout = (plan: "premium" | "classroom") => api<{ url: string }>("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) });

export const ERROR_TEXT: Record<string, string> = {
  sign_in_required: "Алдымен аккаунтқа кір.",
  forbidden: "Бұл әрекетке рұқсатың жоқ.",
  class_not_found: "Мұндай сынып табылмады. Кодты тексер.",
  billing_not_configured: "Төлем жүйесі серверде әлі бапталмаған.",
  sign_in_not_configured: "Кіру жүйесі серверде әлі бапталмаған.",
  rate_limited: "Тым көп сұрау. Бір минуттан кейін қайталап көр.",
  plan_required: "Бұл сабақ Premium жоспарында ашық.",
};
export const errorText = (e: unknown) => (e instanceof ApiError ? (ERROR_TEXT[e.code] ?? `Сервер қатесі (${e.status}).`) : "Серверге қосылу мүмкін болмады.");
