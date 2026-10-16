"use client";

import { Button } from "@/components/ui/button";

/** พิมพ์หน้าปัจจุบัน (CSS ใน globals.css ซ่อนเมนูและปุ่มที่มี class no-print ตอนพิมพ์) */
export function PrintButton({ label = "พิมพ์สลิป" }: { label?: string }) {
  return (
    <Button variant="secondary" className="no-print" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
