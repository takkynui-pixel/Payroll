import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { companyAddressLines, type CompanyRow } from "@/lib/tax/load";
import { splitSatang, type PayeeLine, type PndReport } from "@/lib/tax/pnd";

/** กล่องตัวเลขรายหลัก เช่น เลขผู้เสียภาษี 13 หลัก แบ่งกลุ่ม 1-4-5-2-1 */
export function Boxes({ value, groups }: { value?: string | null; groups: number[] }) {
  const digits = (value ?? "").replace(/\D/g, "");
  let i = 0;
  return (
    <span className="inline-flex items-center gap-[1.2mm]">
      {groups.map((n, g) => (
        <span key={g} className="inline-flex items-center gap-[1.2mm]">
          {g > 0 ? <span>-</span> : null}
          <span className="inline-flex">
            {Array.from({ length: n }, () => {
              const d = digits[i++] ?? "";
              return (
                <span key={i} className="rd-box">
                  {d}
                </span>
              );
            })}
          </span>
        </span>
      ))}
    </span>
  );
}
export const TAX_ID_GROUPS = [1, 4, 5, 2, 1];

export function Cb({ checked }: { checked?: boolean }) {
  return <span className="rd-cb">{checked ? "✓" : ""}</span>;
}

const BE = (y: number) => y + 543;
const MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const monthName = (m: number) => MONTH_FULL[m - 1] ?? "";

function Payer({ company }: { company: CompanyRow }) {
  const a = companyAddressLines(company);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
        <Boxes value={company.tax_id} groups={TAX_ID_GROUPS} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>ชื่อผู้หักภาษี ณ ที่จ่าย (หน่วยงาน) :</span>
        <span className="rd-line min-w-[60mm]">{company.name}</span>
        <span>สาขาที่</span>
        <Boxes value={company.branch_no} groups={[5]} />
      </div>
      <div>
        ที่อยู่ : อาคาร <span className="rd-line min-w-[28mm]">{a.building}</span> ตรอก/ซอย <span className="rd-line min-w-[22mm]">{a.soi}</span>
      </div>
      <div>
        หมู่ที่ <span className="rd-line min-w-[10mm]">{a.moo}</span> ถนน <span className="rd-line min-w-[26mm]">{a.road}</span> ตำบล/แขวง{" "}
        <span className="rd-line min-w-[26mm]">{a.subdistrict}</span>
      </div>
      <div>
        อำเภอ/เขต <span className="rd-line min-w-[28mm]">{a.district}</span> จังหวัด <span className="rd-line min-w-[28mm]">{a.province}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        รหัสไปรษณีย์ <Boxes value={a.postcode} groups={[5]} /> โทรศัพท์ <span className="rd-line min-w-[30mm]">{a.phone}</span>
      </div>
    </div>
  );
}

const SUMMARY_ROWS: { n: string; text: ReactNode }[] = [
  { n: "1.", text: "เงินได้ตามมาตรา 40(1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป" },
  { n: "2.", text: "เงินได้ตามมาตรา 40(1) เงินเดือน ค่าจ้าง ฯลฯ กรณีได้รับอนุมัติจากกรมสรรพากร ให้หักอัตราร้อยละ 3 (ตามหนังสือที่.................ลงวันที่..............)" },
  { n: "3.", text: "เงินได้ตามมาตรา 40(1)(2) กรณีนายจ้างจ่ายให้ครั้งเดียวเพราะเหตุออกจากงาน" },
  { n: "4.", text: "เงินได้ตามมาตรา 40(2) กรณีผู้รับเงินได้เป็นผู้อยู่ในประเทศไทย" },
  { n: "5.", text: "เงินได้ตามมาตรา 40(2) กรณีผู้รับเงินได้มิได้เป็นผู้อยู่ในประเทศไทย" },
];

/** ตารางสรุปรายการที่นำส่ง (ข้อ 1–8) ใช้ร่วมกันทั้ง ภ.ง.ด.1 และ ภ.ง.ด.1ก */
function Summary({ report }: { report: PndReport }) {
  const inc = splitSatang(report.incomeSatang);
  const tax = splitSatang(report.taxSatang);
  const empty = report.payeeCount === 0;
  return (
    <table className="rd-table">
      <thead>
        <tr>
          <th className="w-[44%] !bg-white !border-0" />
          <th>จำนวนราย</th>
          <th>เงินได้ทั้งสิ้น (บาท / สต.)</th>
          <th>ภาษีที่นำส่งทั้งสิ้น (บาท / สต.)</th>
        </tr>
      </thead>
      <tbody>
        {SUMMARY_ROWS.map((r, i) => (
          <tr key={r.n}>
            <td className="!border-0 !border-b !border-l-0 !border-r-0 text-[10.5px]">
              {r.n} {r.text}
            </td>
            <td className="rd-num">{i === 0 && !empty ? report.payeeCount : ""}</td>
            <td className="rd-num">{i === 0 && !empty ? `${inc.baht}.${inc.satang}` : ""}</td>
            <td className="rd-num">{i === 0 && !empty ? `${tax.baht}.${tax.satang}` : ""}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="!border-0">6. รวม</td>
          <td className="rd-num">{report.payeeCount}</td>
          <td className="rd-num">{`${inc.baht}.${inc.satang}`}</td>
          <td className="rd-num">{`${tax.baht}.${tax.satang}`}</td>
        </tr>
        <tr>
          <td className="!border-0">7. เงินเพิ่ม (ถ้ามี)</td>
          <td className="!border-0" />
          <td className="!border-0" />
          <td className="rd-num" />
        </tr>
        <tr className="font-semibold">
          <td className="!border-0">8. รวมยอดภาษีที่นำส่งทั้งสิ้น และเงินเพิ่ม (6. + 7.)</td>
          <td className="!border-0" />
          <td className="!border-0" />
          <td className="rd-num">{`${tax.baht}.${tax.satang}`}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SignBlock({ company }: { company: CompanyRow }) {
  return (
    <div className="mt-3 border-t border-black pt-2 text-center">
      <p>ข้าพเจ้าขอรับรองว่า รายการที่แจ้งไว้ข้างต้นนี้ เป็นรายการที่ถูกต้องและครบถ้วนทุกประการ</p>
      <div className="mx-auto mt-3 w-[110mm] space-y-1.5 text-left">
        <p>
          ลงชื่อ <span className="rd-line min-w-[60mm]" /> ผู้จ่ายเงิน
        </p>
        <p className="pl-8">
          ( <span className="rd-line min-w-[56mm] text-center">{company.signer_name ?? ""}</span> )
        </p>
        <p>
          ตำแหน่ง <span className="rd-line min-w-[60mm]">{company.signer_position ?? ""}</span>
        </p>
        <p>
          ยื่นวันที่ <span className="rd-line min-w-[10mm]" /> เดือน <span className="rd-line min-w-[26mm]" /> พ.ศ. <span className="rd-line min-w-[16mm]" />
        </p>
      </div>
    </div>
  );
}

export function CoverPnd1({
  company,
  year,
  month,
  report,
  attachPages,
  additionalNo,
}: {
  company: CompanyRow;
  year: number;
  month: number;
  report: PndReport;
  attachPages: number;
  additionalNo?: number;
}) {
  return (
    <section className="rd-sheet rd-cover space-y-3">
      <div className="flex gap-3">
        <div className="rd-title flex-1">
          <p className="text-[14px]">แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย</p>
          <p className="text-[14px]">ตามมาตรา 59 แห่งประมวลรัษฎากร</p>
          <p className="text-[10.5px] font-normal">สำหรับการหักภาษี ณ ที่จ่ายตามมาตรา 50 (1) กรณีจ่ายเงินได้พึงประเมินตามมาตรา 40 (1) (2) แห่งประมวลรัษฎากร</p>
        </div>
        <div className="rd-form-no">ภ.ง.ด.1</div>
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-3 border-y border-black py-2">
        <Payer company={company} />
        <div className="space-y-2 border-l border-black pl-3">
          <p>
            เดือนที่จ่ายเงินได้พึงประเมิน (ให้ทำเครื่องหมาย &quot;✓&quot; ลงใน &quot;☐&quot; หน้าชื่อเดือน) พ.ศ. <span className="rd-line min-w-[14mm]">{BE(year)}</span>
          </p>
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {[1, 4, 7, 10, 2, 5, 8, 11, 3, 6, 9, 12].map((m) => (
              <span key={m} className="whitespace-nowrap text-[10px]">
                <Cb checked={m === month} /> ({m}) {monthName(m)}
              </span>
            ))}
          </div>
          <p className="pt-1">
            <Cb checked={!additionalNo} /> (1) ยื่นปกติ &nbsp; <Cb checked={!!additionalNo} /> (2) ยื่นเพิ่มเติมครั้งที่ <span className="rd-line">{additionalNo ?? ""}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <p>
          มีรายละเอียดการหักเป็นรายผู้มีเงินได้ ปรากฏตาม
          <br />
          <span className="text-[10px]">(ให้แสดงรายละเอียดใน ใบแนบ ภ.ง.ด.1 หรือในสื่อบันทึกในระบบคอมพิวเตอร์อย่างใดอย่างหนึ่งเท่านั้น)</span>
        </p>
        <div>
          <p>
            <Cb checked /> <b>ใบแนบ ภ.ง.ด.1</b> ที่แนบมาพร้อมนี้ จำนวน <span className="rd-line">{attachPages}</span> แผ่น
          </p>
          <p>
            <Cb /> <b>สื่อบันทึกในระบบคอมพิวเตอร์</b> ที่แนบมาพร้อมนี้ จำนวน <span className="rd-line" /> แผ่น
          </p>
        </div>
      </div>

      <p className="rd-title !inline-block !px-6 !text-left">สรุปรายการภาษีที่นำส่ง</p>
      <Summary report={report} />
      <SignBlock company={company} />
      <p className="text-right text-[10px]">(ก่อนกรอกรายการ ดูคำชี้แจงด้านหลัง)</p>
    </section>
  );
}

export function CoverPnd1k({
  company,
  year,
  report,
  attachPages,
  additionalNo,
}: {
  company: CompanyRow;
  year: number;
  report: PndReport;
  attachPages: number;
  additionalNo?: number;
}) {
  return (
    <section className="rd-sheet rd-cover space-y-3">
      <div className="flex gap-3">
        <div className="rd-title flex-1">
          <p className="text-[14px]">แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย</p>
          <p className="text-[14px]">ตามมาตรา 58(2)</p>
          <p className="text-[10.5px] font-normal">สำหรับแสดงรายการเกี่ยวกับเงินได้พึงประเมินตามมาตรา 40(1) (2) แห่งประมวลรัษฎากร</p>
        </div>
        <div className="rd-form-no">ภ.ง.ด.1ก</div>
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-3 border-y border-black py-2">
        <Payer company={company} />
        <div className="space-y-2 border-l border-black pl-3">
          <p>
            รายการภาษีเงินได้หัก ณ ที่จ่าย ประจำปีภาษี <span className="rd-line min-w-[14mm]">{BE(year)}</span>
          </p>
          <p className="pt-3">
            <Cb checked={!additionalNo} /> (1) ยื่นปกติ &nbsp; <Cb checked={!!additionalNo} /> (2) ยื่นเพิ่มเติมครั้งที่ <span className="rd-line">{additionalNo ?? ""}</span>
          </p>
        </div>
      </div>

      <p className="rd-title !text-[14px]">โปรดยื่นแบบ ภ.ง.ด.1ก ภายในเดือนกุมภาพันธ์ {BE(year + 1)}</p>
      <p>ขอยื่นรายการแสดงการจ่ายเงินได้พึงประเมินตามมาตรา 40 (1) (2) ในปีที่ล่วงมาแล้ว</p>

      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <p>
          มีรายละเอียดการหักเป็นรายผู้มีเงินได้ ปรากฏตาม
          <br />
          <span className="text-[10px]">(ให้แสดงรายละเอียดใน ใบแนบ ภ.ง.ด.1ก หรือในสื่อบันทึกในระบบคอมพิวเตอร์อย่างใดอย่างหนึ่งเท่านั้น)</span>
        </p>
        <div>
          <p>
            <Cb checked /> <b>ใบแนบ ภ.ง.ด.1ก</b> ที่แนบมาพร้อมนี้ จำนวน <span className="rd-line">{attachPages}</span> แผ่น
          </p>
          <p>
            <Cb /> <b>สื่อบันทึกในระบบคอมพิวเตอร์</b> ที่แนบมาพร้อมนี้ จำนวน <span className="rd-line" /> แผ่น
          </p>
        </div>
      </div>

      <p className="rd-title !inline-block !px-6 !text-left">สรุปรายการที่ส่ง</p>
      <Summary report={report} />
      <SignBlock company={company} />
      <p className="text-right text-[10px]">(ก่อนกรอกรายการ ดูคำชี้แจงด้านหลัง)</p>
    </section>
  );
}

export interface AttachLine extends PayeeLine {
  idCard: string | null;
  address: string | null;
}

const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** วัน/เดือน(ย่อ)/พ.ศ. เช่น 19/ต.ค./2569 ตามแบบที่ยื่นจริง */
const BE_DATE = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}/${MONTH_ABBR[Number(m[2]) - 1]}/${Number(m[1]) + 543}` : iso;
};

/** ใบแนบ ภ.ง.ด.1 / ภ.ง.ด.1ก (1 แผ่น) รายการแต่ละคนอยู่ใน 1 แถว */
export function AttachSheet({
  kind,
  company,
  lines,
  pageNo,
  pageCount,
  rowsPerPage,
  startIndex,
  pageTotal,
  grandTotal,
}: {
  kind: "pnd1" | "pnd1k";
  company: CompanyRow;
  lines: AttachLine[];
  pageNo: number;
  pageCount: number;
  rowsPerPage: number;
  startIndex: number;
  pageTotal: { income: number; tax: number };
  /** แสดงเฉพาะแผ่นสุดท้าย */
  grandTotal?: { income: number; tax: number };
}) {
  const filler = Math.max(0, rowsPerPage - lines.length);
  const income = (n: number) => {
    const s = splitSatang(n);
    return `${s.baht}.${s.satang}`;
  };
  return (
    <div className="rd-attach-wrap">
    <section className="rd-sheet rd-attach space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-bold">ใบแนบ {kind === "pnd1" ? "ภ.ง.ด.1" : "ภ.ง.ด.1ก"}</p>
        <div className="flex items-center gap-2">
          <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของผู้มีหน้าที่หักภาษี ณ ที่จ่าย</span>
          <Boxes value={company.tax_id} groups={TAX_ID_GROUPS} />
        </div>
        <div className="flex items-center gap-2">
          <span>สาขาที่</span>
          <Boxes value={company.branch_no} groups={[5]} />
        </div>
        <p>
          แผ่นที่ <span className="rd-line">{pageNo}</span> ในจำนวน <span className="rd-line">{pageCount}</span> แผ่น
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[10.5px]">
        <b>ประเภทเงินได้</b>
        <span><Cb checked /> (1) เงินได้ตามมาตรา 40(1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป</span>
        <span><Cb /> (2) เงินได้ตามมาตรา 40(1) กรณีได้รับอนุมัติจากกรมสรรพากรให้หักอัตราร้อยละ 3</span>
        <span><Cb /> (3) ตามมาตรา 40(1)(2) กรณีนายจ้างจ่ายให้ครั้งเดียวเพราะเหตุออกจากงาน</span>
        <span><Cb /> (4) มาตรา 40(2) ผู้อยู่ในประเทศไทย</span>
        <span><Cb /> (5) มาตรา 40(2) ผู้มิได้อยู่ในประเทศไทย</span>
      </div>

      <table className="rd-table">
        <thead>
          <tr>
            <th rowSpan={2} className="w-[7mm]">ลำดับที่</th>
            <th rowSpan={2} className="w-[78mm]">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของผู้มีเงินได้</th>
            <th rowSpan={2}>ชื่อผู้มีเงินได้ (ให้ระบุเป็น นาย นาง นางสาว หรือยศ){kind === "pnd1k" ? " และที่อยู่ของผู้มีเงินได้" : ""}</th>
            {kind === "pnd1" ? (
              <th rowSpan={2} className="w-[24mm]">วัน เดือน ปี ที่จ่าย</th>
            ) : null}
            <th colSpan={2}>{kind === "pnd1" ? "จำนวนเงินที่จ่ายในครั้งนี้ (บาท / สต.)" : "จำนวนเงินได้ทั้งปี (บาท / สต.)"}</th>
            <th colSpan={2}>{kind === "pnd1" ? "ภาษีที่หักและนำส่งในครั้งนี้ (บาท / สต.)" : "ภาษีที่หักและนำส่งทั้งปี (บาท / สต.)"}</th>
            <th rowSpan={2} className="w-[16mm]">เงื่อนไข</th>
          </tr>
          <tr>
            <th className="w-[26mm]">บาท</th>
            <th className="w-[10mm]">สต.</th>
            <th className="w-[22mm]">บาท</th>
            <th className="w-[10mm]">สต.</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const inc = splitSatang(l.incomeSatang);
            const tax = splitSatang(l.taxSatang);
            return (
              <tr key={`${l.employeeId}-${l.payDate}-${i}`} className="h-[17mm]">
                <td className="text-center">{startIndex + i + 1}</td>
                <td>
                  <Boxes value={l.idCard} groups={TAX_ID_GROUPS} />
                </td>
                <td>
                  <p className="font-semibold">{l.employeeName}</p>
                  {kind === "pnd1k" ? <p className="text-[10px]">ที่อยู่ {l.address ?? ""}</p> : null}
                </td>
                {kind === "pnd1" ? <td className="text-center">{l.payDate ? BE_DATE(l.payDate) : ""}</td> : null}
                <td className="rd-num">{inc.baht}</td>
                <td className="rd-num">{inc.satang}</td>
                <td className="rd-num">{tax.baht}</td>
                <td className="rd-num">{tax.satang}</td>
                <td className="text-center">[ 1 ]</td>
              </tr>
            );
          })}
          {Array.from({ length: filler }, (_, i) => (
            <tr key={`f${i}`} className="h-[17mm]">
              <td className="text-center">{startIndex + lines.length + i + 1}</td>
              <td />
              <td />
              {kind === "pnd1" ? <td /> : null}
              <td /><td /><td /><td /><td />
            </tr>
          ))}
          <tr className="font-semibold">
            <td colSpan={kind === "pnd1" ? 4 : 3} className="text-right">รวมยอดเงินได้และภาษีที่นำส่งในหน้านี้ (นำไปรวมกับใบต่อ ถ้ามี)</td>
            <td colSpan={2} className="rd-num">{income(pageTotal.income)}</td>
            <td colSpan={2} className="rd-num">{income(pageTotal.tax)}</td>
            <td />
          </tr>
          <tr className="font-semibold">
            <td colSpan={kind === "pnd1" ? 4 : 3} className="text-right">รวมยอดเงินได้และภาษีที่นำส่ง (นำไปกรอกในแบบแสดงรายการภาษี)</td>
            <td colSpan={2} className="rd-num">{grandTotal ? income(grandTotal.income) : ""}</td>
            <td colSpan={2} className="rd-num">{grandTotal ? income(grandTotal.tax) : ""}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-[1fr_1fr] gap-4 text-[10px]">
        <div>
          <p className="font-semibold">หมายเหตุ &nbsp;เงื่อนไขการหักภาษี ให้ใส่รหัสดังนี้</p>
          <p>หัก ณ ที่จ่าย ใส่ 1 &nbsp;/&nbsp; ออกให้ตลอดไป ใส่ 2 &nbsp;/&nbsp; ออกให้ครั้งเดียว ใส่ 3</p>
        </div>
        <div className="space-y-1 text-[11px]">
          <p>
            ลงชื่อ <span className="rd-line min-w-[50mm]" /> ผู้จ่ายเงิน &nbsp; ( <span className="rd-line min-w-[40mm]">{company.signer_name ?? ""}</span> )
          </p>
          <p>
            ตำแหน่ง <span className="rd-line min-w-[40mm]">{company.signer_position ?? ""}</span> ยื่นวันที่ <span className="rd-line min-w-[8mm]" /> เดือน{" "}
            <span className="rd-line min-w-[20mm]" /> พ.ศ. <span className="rd-line min-w-[14mm]" />
          </p>
        </div>
      </div>
    </section>
    </div>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div role="status" className={cn("no-print mb-4 rounded-2xl border border-[#e0a21b] bg-[#fff8e6] p-4 text-sm text-warn")}>
      <p className="font-semibold">ข้อมูลที่ควรตรวจก่อนพิมพ์</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
