/** How far back the parent's attendance summary looks. */
const RECENT_ATTENDANCE_WEEKS = 4;

type Week = { weekStart: string; present: number; total: number };

export const percentOf = (part: number, whole: number) => Math.round((part / whole) * 100);

/** Classes attended in the latest weeks. Null until a week with classes is on record. */
export function recentAttendance(weeks: Week[]) {
  const recent = weeks
    .filter((week) => week.total > 0)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, RECENT_ATTENDANCE_WEEKS);
  if (recent.length === 0) return null;

  const present = recent.reduce((sum, week) => sum + week.present, 0);
  const total = recent.reduce((sum, week) => sum + week.total, 0);
  return { weeks: recent.length, present, total, percent: percentOf(present, total) };
}
