export const en = {
  appName: "Fee Tracker",
  tagline: "Know what is due and when, without calling.",
  status: {
    paid: "Paid",
    dueToday: "Due today",
    dueIn: (days: number) => `Due in ${days} ${days === 1 ? "day" : "days"}`,
    overdue: (days: number) => `${days} ${days === 1 ? "day" : "days"} overdue`,
    partPaid: "Part paid",
  },
};

export type Messages = typeof en;
