import { describe, expect, it } from "vitest";
import { splitGst } from "./gst";
import { rupees } from "./money";
import { defaultExportFrom, tallyCsv, type TallyReceipt } from "./tally";

const receipt: TallyReceipt = {
  receiptNo: "RCT-000123",
  paidOn: "2026-10-05",
  centre: "Centre 1",
  batch: "JEE 2027 Evening",
  studentCode: "STU-0587",
  sequence: 2,
  method: "upi",
  reference: "UPI123",
  amount: rupees(15000),
};

const lines = (csv: string) => csv.replace("﻿", "").trimEnd().split("\r\n");

describe("tallyCsv credit notes", () => {
  it("writes a refund as a credit note with a positive amount", () => {
    const csv = tallyCsv([
      {
        receiptNo: "CN-000001",
        paidOn: "2026-09-30",
        centre: "Centre 1",
        batch: "JEE 2027 Morning",
        studentCode: "STU-1053",
        sequence: 0,
        method: "bank_transfer",
        reference: "NEFT-1",
        amount: 118000,
        voucher: "Credit Note",
      },
    ]);
    expect(csv).toContain("30-09-2026,Credit Note,CN-000001");
    expect(csv).toContain('"Refund, STU-1053"');
    expect(csv).toContain("1000.00,90.00,90.00,1180.00");
  });
});

describe("tallyCsv", () => {
  it("writes a header and one voucher per receipt, with GST split out", () => {
    const { taxable, cgst, sgst } = splitGst(rupees(15000));
    const [header, row] = lines(tallyCsv([receipt]));

    expect(header).toBe(
      "Voucher Date,Voucher Type,Voucher Number,Centre,Batch,Student ID,Narration,Debit Ledger,Reference,Course Fee,CGST,SGST,Total",
    );
    expect(row).toBe(
      `05-10-2026,Receipt,RCT-000123,Centre 1,JEE 2027 Evening,STU-0587,"Instalment 2, STU-0587",Bank,UPI123,${(taxable / 100).toFixed(2)},${(cgst / 100).toFixed(2)},${(sgst / 100).toFixed(2)},15000.00`,
    );
  });

  it("has parts that add up to the total", () => {
    const cells = lines(tallyCsv([{ ...receipt, amount: rupees(12345.67) }]))[1].split(",");
    const [fee, cgst, sgst, total] = cells.slice(-4).map(Number);
    expect(Math.round((fee + cgst + sgst) * 100)).toBe(Math.round(total * 100));
  });

  it("posts cash to Cash and everything else to Bank", () => {
    expect(lines(tallyCsv([{ ...receipt, method: "cash" }]))[1]).toContain(",Cash,");
    expect(lines(tallyCsv([{ ...receipt, method: "gateway" }]))[1]).toContain(",Bank,");
  });

  it("quotes commas, quotes and line breaks in a typed reference", () => {
    const row = lines(tallyCsv([{ ...receipt, reference: 'CHQ "12", HDFC' }]))[1];
    expect(row).toContain('"CHQ ""12"", HDFC"');
  });

  it("stops a typed reference running as a spreadsheet formula", () => {
    for (const reference of ["=1+1", "+91", "-5", "@SUM(A1)"]) {
      expect(lines(tallyCsv([{ ...receipt, reference }]))[1]).toContain(`,'${reference},`);
    }
  });

  it("starts with a byte order mark and uses Windows line ends", () => {
    const csv = tallyCsv([receipt]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("defaultExportFrom", () => {
  it("is the first of last month", () => {
    expect(defaultExportFrom("2026-11-02")).toBe("2026-10-01");
    expect(defaultExportFrom("2026-03-31")).toBe("2026-02-01");
  });

  it("crosses the new year", () => {
    expect(defaultExportFrom("2027-01-15")).toBe("2026-12-01");
  });
});
