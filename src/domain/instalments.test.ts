import { describe, expect, it } from "vitest";
import { balanceOf, instalmentStatus } from "./instalments";
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
