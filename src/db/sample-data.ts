import { addDays, daysBetween, type IsoDate } from "@/domain/dates";

/** All people, phone numbers and references here are fictional. Amounts are in rupees. */

export const SAMPLE_TODAY: IsoDate = "2026-11-02";
export const CENTRES = ["Centre 1", "Centre 2", "Centre 3", "Centre 4"];
export const PLAN_TOTAL = 120000;

export type SampleInstalment = {
  dueDate: IsoDate;
  amount: number;
  paid: number;
  paidOn?: IsoDate;
};

export type SampleAttendance = { weekStart: IsoDate; present: number; total: number };

export type SampleScore = {
  testName: string;
  takenOn: IsoDate;
  score: number;
  maxScore: number;
};

export type SampleStudent = {
  code: string;
  name: string;
  centre: string;
  batch: string;
  parentPhone: string;
  parentName: string;
  language: "en" | "hi";
  discount: number;
  instalments: SampleInstalment[];
  attendance: SampleAttendance[];
  scores: SampleScore[];
};

export type UnmatchedPayment = { gatewayRef: string; amount: number; paidOn: IsoDate };

type PaymentProfile = "paid-up" | "all-paid" | "part-latest" | "missed-latest" | "missed-two";
type Trend = "steady" | "falling";

const SCHEDULES: Record<string, IsoDate[]> = {
  "JEE 2027": ["2026-07-10", "2026-10-10", "2027-01-10", "2027-04-10"],
  "NEET 2027": ["2026-07-15", "2026-11-15", "2027-03-15"],
  "JEE 2028": ["2026-07-05", "2026-09-15", "2026-12-15", "2027-03-15"],
  "NEET 2028": ["2026-07-20", "2026-12-20", "2027-04-20"],
};

const BATCHES = [
  { centre: "Centre 1", batch: "JEE 2027 Morning" },
  { centre: "Centre 1", batch: "NEET 2027 Morning" },
  { centre: "Centre 2", batch: "JEE 2027 Morning" },
  { centre: "Centre 2", batch: "NEET 2027 Evening" },
  { centre: "Centre 3", batch: "JEE 2028 Morning" },
  { centre: "Centre 3", batch: "NEET 2027 Morning" },
  { centre: "Centre 4", batch: "JEE 2028 Evening" },
  { centre: "Centre 4", batch: "NEET 2028 Morning" },
];

/** Eleven entries against eight batches, so every pattern reaches every batch. */
const PROFILES: PaymentProfile[] = [
  "paid-up",
  "part-latest",
  "paid-up",
  "paid-up",
  "missed-latest",
  "paid-up",
  "all-paid",
  "paid-up",
  "part-latest",
  "paid-up",
  "missed-two",
];

const FIRST_NAMES = [
  "Aditi", "Arjun", "Bhavya", "Chirag", "Deepika", "Dev", "Gauri", "Harsh", "Isha", "Jatin",
  "Kavya", "Karan", "Lavanya", "Manav", "Neha", "Nikhil", "Ojas", "Pooja", "Pranav", "Riya",
  "Rohan", "Saanvi", "Tanmay", "Tanvi", "Uday", "Vidhi", "Yash", "Zoya",
];

const LAST_NAMES = [
  "Agarwal", "Bairwa", "Choudhary", "Jain", "Joshi", "Kumawat", "Mathur", "Meena", "Rathore",
  "Saini", "Shekhawat", "Soni", "Vyas", "Yadav",
];

/** Small seeded generator, so every run produces identical data. */
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]) => items[Math.floor(next() * items.length)],
  };
}

type Random = ReturnType<typeof createRandom>;

function scheduleFor(batch: string): IsoDate[] {
  const schedule = SCHEDULES[batch.split(" ").slice(0, 2).join(" ")];
  if (!schedule) throw new Error(`No schedule for batch: ${batch}`);
  return schedule;
}

function buildInstalments(
  dueDates: IsoDate[],
  discount: number,
  profile: PaymentProfile,
  random: Random,
): SampleInstalment[] {
  const amount = (PLAN_TOTAL - discount) / dueDates.length;
  const pastDue = dueDates.filter((date) => daysBetween(date, SAMPLE_TODAY) > 0).length;

  return dueDates.map((dueDate, index) => {
    const isLatest = index === pastDue - 1;
    const isPastDue = index < pastDue;
    const paidOn = addDays(dueDate, random.int(-6, 9));

    if (profile === "all-paid") return { dueDate, amount, paid: amount, paidOn: earliest(paidOn) };
    if (!isPastDue) return { dueDate, amount, paid: 0 };
    if (profile === "missed-latest" && isLatest) return { dueDate, amount, paid: 0 };
    if (profile === "missed-two" && index >= pastDue - 2) return { dueDate, amount, paid: 0 };
    if (profile === "part-latest" && isLatest) {
      return { dueDate, amount, paid: amount / 2, paidOn };
    }
    return { dueDate, amount, paid: amount, paidOn };
  });
}

/** Paying ahead can't produce a date later than today. */
function earliest(date: IsoDate): IsoDate {
  return daysBetween(date, SAMPLE_TODAY) < 0 ? SAMPLE_TODAY : date;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function buildAttendance(trend: Trend, random: Random): SampleAttendance[] {
  return Array.from({ length: 12 }, (_, index) => {
    const weekStart = addDays("2026-10-26", (index - 11) * 7);
    const base = trend === "falling" ? 6 - Math.floor(index / 2.4) : random.int(5, 6);
    return { weekStart, present: clamp(base, 0, 6), total: 6 };
  });
}

function buildScores(trend: Trend, random: Random): SampleScore[] {
  const start = random.int(170, 240);
  return Array.from({ length: 6 }, (_, index) => ({
    testName: `Unit Test ${index + 1}`,
    takenOn: addDays("2026-07-25", index * 18),
    score: clamp(start + (trend === "falling" ? -22 * index : random.int(-12, 12)), 0, 300),
    maxScore: 300,
  }));
}

/** The three rows from the brief. Their fee records must stay exactly as given. */
function briefStudents(random: Random): SampleStudent[] {
  const steady = () => ({
    attendance: buildAttendance("steady", random),
    scores: buildScores("steady", random),
  });
  const paidInFull = (dueDate: IsoDate, amount: number) => ({
    dueDate,
    amount,
    paid: amount,
    paidOn: dueDate,
  });
  const unpaid = (dueDate: IsoDate, amount: number) => ({ dueDate, amount, paid: 0 });

  return [
    {
      code: "STU-0412",
      name: "Aarav Meena",
      centre: "Centre 1",
      batch: "JEE 2027 Morning",
      parentPhone: "+919000000001",
      parentName: "Parent of Aarav Meena",
      language: "en",
      discount: 0,
      instalments: [
        paidInFull("2026-07-10", 30000),
        paidInFull("2026-10-10", 30000),
        unpaid("2027-01-10", 30000),
        unpaid("2027-04-10", 30000),
      ],
      ...steady(),
    },
    {
      code: "STU-0587",
      name: "Ishita Sharma",
      centre: "Centre 1",
      batch: "JEE 2027 Evening",
      parentPhone: "+919000000002",
      parentName: "Parent of Ishita Sharma",
      language: "hi",
      discount: 0,
      instalments: [
        paidInFull("2026-07-10", 30000),
        { dueDate: "2026-10-10", amount: 30000, paid: 15000, paidOn: "2026-10-10" },
        unpaid("2027-01-10", 30000),
        unpaid("2027-04-10", 30000),
      ],
      ...steady(),
    },
    {
      code: "STU-0219",
      name: "Mohit Gurjar",
      centre: "Centre 1",
      batch: "NEET 2027 Morning",
      parentPhone: "+919000000003",
      parentName: "Parent of Mohit Gurjar",
      language: "hi",
      discount: 0,
      instalments: [
        paidInFull("2026-07-15", 40000),
        unpaid("2026-11-15", 40000),
        unpaid("2027-03-15", 40000),
      ],
      ...steady(),
    },
  ];
}

export function buildSampleData(): {
  students: SampleStudent[];
  unmatchedPayments: UnmatchedPayment[];
} {
  const random = createRandom(20261102);
  const students = briefStudents(random);
  const usedNames = new Set(students.map((student) => student.name));

  const uniqueName = () => {
    for (;;) {
      const name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  };

  const addStudent = (
    index: number,
    profile: PaymentProfile,
    trend: Trend,
    overrides: Partial<SampleStudent> = {},
  ) => {
    const { centre, batch } = BATCHES[index % BATCHES.length];
    const name = overrides.name ?? uniqueName();
    const discount = index % 7 === 3 ? random.pick([6000, 12000]) : 0;

    students.push({
      code: `STU-${1001 + index}`,
      name,
      centre,
      batch,
      parentPhone: `+91900000${String(1001 + index).padStart(4, "0")}`,
      parentName: `Parent of ${name}`,
      language: random.next() < 0.6 ? "hi" : "en",
      discount,
      instalments: buildInstalments(scheduleFor(batch), discount, profile, random),
      attendance: buildAttendance(trend, random),
      scores: buildScores(trend, random),
      ...overrides,
    });
  };

  for (let index = 0; index < 35; index += 1) {
    addStudent(index, PROFILES[index % PROFILES.length], "steady");
  }

  // Two children of one parent, so the portal has to handle more than one child.
  const elder = students[students.length - 1];
  addStudent(35, "paid-up", "steady", {
    name: `${random.pick(FIRST_NAMES)} ${elder.name.split(" ")[1]}`,
    parentPhone: elder.parentPhone,
    parentName: elder.parentName,
    language: elder.language,
  });

  // Should trigger the dropout-risk flag: missed fees, falling attendance and scores.
  addStudent(36, "missed-two", "falling");
  addStudent(37, "missed-two", "falling");
  addStudent(38, "missed-latest", "falling");

  // Too little data: a missed fee, but only one week of attendance and no tests.
  addStudent(39, "missed-latest", "steady", {
    attendance: [{ weekStart: "2026-10-26", present: 4, total: 6 }],
    scores: [],
  });

  return {
    students,
    unmatchedPayments: [
      { gatewayRef: "GW-TEST-UNMATCHED-0001", amount: 12500, paidOn: "2026-10-28" },
    ],
  };
}
