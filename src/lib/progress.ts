/** Per-browser learning progress (no account needed). */
export type CourseProgress = { done: string[]; last?: string; updated: number };
const KEY = 'tut:progress';

export function readAll(): Record<string, CourseProgress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function readCourse(slug: string): CourseProgress {
  return readAll()[slug] ?? { done: [], updated: 0 };
}
export function writeCourse(slug: string, p: CourseProgress) {
  try {
    const all = readAll();
    all[slug] = { ...p, updated: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
export function readNote(videoId: string) {
  try {
    return localStorage.getItem(`tut:note:${videoId}`) ?? '';
  } catch {
    return '';
  }
}
export function writeNote(videoId: string, text: string) {
  try {
    if (text) localStorage.setItem(`tut:note:${videoId}`, text);
    else localStorage.removeItem(`tut:note:${videoId}`);
  } catch {}
}
