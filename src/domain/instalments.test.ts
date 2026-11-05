import { describe, expect, it } from "vitest";
import { balanceOf, instalmentStatus, nextToPay, summariseLedger } from "./instalments";
import { rupees } from "./money";

const today = "2026-11-02";

describe("instalmentStatus, using the sample rows from the brief", () => {
  it("STU-0412 Aarav Meena is paid", () => {
    const row = { dueDate: "2026-10-10", amount: rupees(30000), paid: rupees(30000) };
    expect(instalmentStatus(row, today)).toEqual({ kind: "paid" });
  });

  it("STU-0587 Ishita Sharma is part paid, 23 days overdue", () => {
    const row = { dueDate: "2026-10-10", amount: rupees(30000), paid: rupees(15000) };
    expect(instalmentStatus(row, today)).toEqual({ kind: "overdue", days: 23, partPaid: true });
    expect(balanceOf(row)).toBe(rupees(15000));
  });

  it("STU-0219 Mohit Gurjar is due in 13 days", () => {
    const row = { dueDate: "2026-11-15", amount: rupees(40000), paid: 0 };
    expect(instalmentStatus(row, today)).toEqual({ kind: "due", days: 13, partPaid: false });
  });
});

describe("instalmentStatus edge cases", () => {
  it("is not overdue on the due date itself", () => {
    const row = { dueDate: today, amount: rupees(100), paid: 0 };
    expect(instalmentStatus(row, today)).toEqual({ kind: "due", days: 0, partPaid: false });
  });

  it("treats an overpayment as paid with no negative balance", () => {
    const row = { dueDate: today, amount: rupees(100), paid: rupees(150) };
    expect(instalmentStatus(row, today)).toEqual({ kind: "paid" });
    expect(balanceOf(row)).toBe(0);
  });
});

describe("nextToPay", () => {
  const paid = { dueDate: "2026-07-10", amount: rupees(30000), paid: rupees(30000) };
  const late = { dueDate: "2026-10-10", amount: rupees(30000), paid: rupees(15000) };
  const later = { dueDate: "2027-01-10", amount: rupees(30000), paid: 0 };

  it("picks the oldest unpaid instalment, whatever the order", () => {
    expect(nextToPay([later, paid, late], today)?.next).toBe(late);
  });

  it("does not count future instalments as overdue", () => {
    expect(nextToPay([paid, late, later], today)?.otherOverdue).toBe(0);
  });

  it("adds up other overdue balances", () => {
    const older = { dueDate: "2026-07-10", amount: rupees(30000), paid: 0 };
    const result = nextToPay([older, late, later], today);
    expect(result?.next).toBe(older);
    expect(result?.otherOverdue).toBe(rupees(15000));
  });

  it("returns null when everything is paid", () => {
    expect(nextToPay([paid], today)).toBeNull();
    expect(nextToPay([], today)).toBeNull();
  });
});

describe("summariseLedger", () => {
  const row = (dueDate: string, amount: number, paid: number) => ({
    dueDate,
    amount: rupees(amount),
    paid: rupees(paid),
  });

  it("adds up Ishita's ledger", () => {
    const ishita = [
      row("2026-07-10", 30000, 30000),
      row("2026-10-10", 30000, 15000),
      row("2027-01-10", 30000, 0),
      row("2027-04-10", 30000, 0),
    ];
    expect(summariseLedger(ishita, today)).toEqual({
      paid: rupees(45000),
      balance: rupees(75000),
      overdue: rupees(15000),
      daysOverdue: 23,
    });
  });

  it("reports the oldest overdue days", () => {
    const rows = [row("2026-07-10", 30000, 0), row("2026-10-10", 30000, 0)];
    expect(summariseLedger(rows, today).daysOverdue).toBe(115);
  });

  it("has nothing overdue when only future instalments are unpaid", () => {
    expect(summariseLedger([row("2027-01-10", 30000, 0)], today)).toMatchObject({
      overdue: 0,
      daysOverdue: 0,
    });
  });

  it("handles a student with no instalments", () => {
    expect(summariseLedger([], today)).toEqual({ paid: 0, balance: 0, overdue: 0, daysOverdue: 0 });
  });
});
