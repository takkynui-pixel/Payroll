import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  PERIOD_STEPS,
  clientActions,
  isEditable,
  isPeriodStatus,
  staffActions,
  stepIndex,
  type PeriodStatus,
} from "@/lib/workflow";

describe("ALLOWED_TRANSITIONS", () => {
  it("ตรงกับ 6 การเปลี่ยนสถานะที่ฐานข้อมูล (guard_period_update) อนุญาต", () => {
    const pairs = PERIOD_STEPS.flatMap((from) => ALLOWED_TRANSITIONS[from].map((to) => `${from}>${to}`)).sort();
    expect(pairs).toEqual(
      [
        "draft>calculated",
        "calculated>draft",
        "calculated>client_reviewing",
        "client_reviewing>approved",
        "client_reviewing>draft",
        "approved>closed",
      ].sort(),
    );
  });
});

describe("ปุ่มตามสถานะ", () => {
  const all = [...PERIOD_STEPS];

  it("ทุกปุ่มของทีม payroll และ HR ลูกค้าพาไปสถานะที่ฐานข้อมูลอนุญาตเท่านั้น", () => {
    for (const from of all) {
      for (const a of [...staffActions(from), ...clientActions(from)]) {
        expect(ALLOWED_TRANSITIONS[from as PeriodStatus], `${from} -> ${a.to}`).toContain(a.to);
      }
    }
  });

  it("การส่งงวดกลับเป็นร่างจากสถานะตรวจสอบต้องกรอกเหตุผล (ฐานข้อมูลบังคับ)", () => {
    for (const a of [...staffActions("client_reviewing"), ...clientActions("client_reviewing")]) {
      if (a.to === "draft") expect(a.requireNote).toBe(true);
    }
  });

  it("การอนุมัติและปิดงวดมีข้อความยืนยันก่อนทำ", () => {
    expect(clientActions("client_reviewing").find((a) => a.to === "approved")?.confirm).toBeTruthy();
    expect(staffActions("approved").find((a) => a.to === "closed")?.confirm).toBeTruthy();
  });

  it("เฉพาะ HR ลูกค้าเท่านั้นที่เห็นปุ่มอนุมัติ", () => {
    for (const s of all) {
      expect(staffActions(s).some((a) => a.to === "approved")).toBe(false);
    }
    expect(clientActions("client_reviewing").some((a) => a.to === "approved")).toBe(true);
  });

  it("งวดที่ปิดแล้วไม่มีปุ่ม และ HR ไม่เห็นปุ่มนอกสถานะตรวจสอบ", () => {
    expect(staffActions("closed")).toEqual([]);
    for (const s of all.filter((x) => x !== "client_reviewing")) {
      expect(clientActions(s)).toEqual([]);
    }
  });
});

describe("ตัวช่วยสถานะ", () => {
  it("stepIndex เรียงตามลำดับ และสถานะแปลกเป็น 0", () => {
    expect(PERIOD_STEPS.map(stepIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(stepIndex("whatever")).toBe(0);
  });

  it("isEditable เฉพาะ draft และ calculated", () => {
    expect(all5().filter(isEditable)).toEqual(["draft", "calculated"]);
  });

  it("isPeriodStatus", () => {
    expect(isPeriodStatus("approved")).toBe(true);
    expect(isPeriodStatus("paid")).toBe(false);
  });
});

function all5(): string[] {
  return [...PERIOD_STEPS];
}
