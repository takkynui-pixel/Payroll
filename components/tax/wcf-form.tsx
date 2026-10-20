import { companyAddressLines, type CompanyRow } from "@/lib/tax/load";
import { splitSatang } from "@/lib/tax/pnd";
import type { WcfReport } from "@/lib/tax/wcf";
import { Boxes, TAX_ID_GROUPS } from "./rd-forms";

const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const money = (satang: number) => {
  const s = splitSatang(satang);
  return `${s.baht}.${s.satang}`;
};

/** แบบ กท.20 ก แบบแจ้งจำนวนลูกจ้างและค่าจ้างที่จ่ายจริงประจำปี (กองทุนเงินทดแทน) 1 แผ่น A4 แนวตั้ง */
export function WcfForm({
  company,
  year,
  report,
  taxPayeeCount,
  taxIncomeSatang,
}: {
  company: CompanyRow;
  year: number;
  report: WcfReport;
  /** จำนวนรายและเงินได้ตาม ภ.ง.ด.1ก ของปีเดียวกัน (กรอกในกรอบ "รายการภาษีเงินได้หัก ณ ที่จ่าย") */
  taxPayeeCount: number;
  taxIncomeSatang: number;
}) {
  const a = companyAddressLines(company);
  const t = report.total;
  const hasRate = Number(company.wcf_rate) > 0;
  return (
    <div className="rd-wcf-wrap">
      <section className="rd-sheet rd-cover space-y-3">
        <p className="text-[11px]">โปรดกรอกเอกสารฉบับนี้และส่งคืนสำนักงานพร้อมแบบ กท.20 ก</p>
        <p className="text-center text-[14px] font-bold">
          แบบคำนวณค่าจ้างเพื่อประกอบการรายงานค่าจ้างตามแบบ กท. 20 ก. ประจำปี <span className="rd-line min-w-[20mm] text-center">{year + 543}</span>
        </p>

        <div className="space-y-1.5">
          <p>
            สำนักงานประกันสังคมเขตพื้นที่ / จังหวัด <span className="rd-line min-w-[50mm]">{a.province}</span> โทร. <span className="rd-line min-w-[28mm]">{a.phone}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>ชื่อสถานประกอบการ</span>
            <span className="rd-line min-w-[70mm]">{company.name}</span>
            <span>เลขที่บัญชี</span>
            <span className="rd-line min-w-[34mm]">{company.wcf_account_no ?? ""}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>เลขประจำตัวผู้เสียภาษี</span>
            <Boxes value={company.tax_id} groups={TAX_ID_GROUPS} />
            <span>สาขาที่</span>
            <Boxes value={company.branch_no} groups={[5]} />
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="rd-cb" />
            <span>รหัสกิจการ</span>
            <span className="rd-line min-w-[26mm]">{company.wcf_business_code ?? ""}</span>
            <span>อัตราเงินสมทบ</span>
            <span className="rd-line min-w-[14mm] text-right">{hasRate ? Number(company.wcf_rate).toFixed(2) : ""}</span>
            <span>%</span>
          </p>
        </div>

        <table className="rd-table text-[10.5px]">
          <thead>
            <tr>
              <th rowSpan={3} className="w-[12mm]">เดือน</th>
              <th rowSpan={3} className="w-[16mm]">จำนวนลูกจ้าง</th>
              <th colSpan={4}>ประเภทของค่าจ้างตามกฎหมาย (รวมทุกสาขา)</th>
              <th rowSpan={3} className="w-[24mm]">ส่วนที่เกิน<br />20,000 บาท/เดือน<br />(รายคน)</th>
              <th rowSpan={3} className="w-[26mm]">ค่าจ้างสุทธิ<br />ที่ต้องแจ้ง<br /><span className="font-normal">3 = 1 − 2</span></th>
            </tr>
            <tr>
              <th rowSpan={2} className="w-[22mm]">เงินเดือน</th>
              <th rowSpan={2} className="w-[22mm]">ค่าจ้างรายวัน</th>
              <th rowSpan={2} className="w-[22mm]">ค่าล่วงเวลา และค่าจ้างอื่น ๆ</th>
              <th className="w-[26mm]">1 รวมค่าจ้าง</th>
            </tr>
            <tr>
              <th className="w-[26mm] font-normal">(บาท)</th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((m) => (
              <tr key={m.month}>
                <td className="text-center">{MONTH_ABBR[m.month - 1]}</td>
                <td className="text-center">{m.employeeCount}</td>
                <td className="rd-num">{money(m.salarySatang)}</td>
                <td className="rd-num">{money(m.dailySatang)}</td>
                <td className="rd-num">{money(m.otherSatang)}</td>
                <td className="rd-num">{money(m.totalSatang)}</td>
                <td className="rd-num">{money(m.excessSatang)}</td>
                <td className="rd-num">{money(m.netSatang)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="text-center">รวม</td>
              <td />
              <td className="rd-num">{money(t.salarySatang)}</td>
              <td className="rd-num">{money(t.dailySatang)}</td>
              <td className="rd-num">{money(t.otherSatang)}</td>
              <td className="rd-num">{money(t.totalSatang)}</td>
              <td className="rd-num">{money(t.excessSatang)}</td>
              <td className="rd-num">{money(t.netSatang)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-[10.5px]">
          ค่าจ้างรายเดือนของลูกจ้างที่ได้รับสูงสุดเกินเดือนละ <span className="rd-line min-w-[26mm]" /> บาท &nbsp;&nbsp; ค่าจ้างรายวันของลูกจ้างที่ได้รับสูงสุดเกินวันละ{" "}
          <span className="rd-line min-w-[26mm]" /> บาท
        </p>

        <div className="grid grid-cols-[1.1fr_1fr] gap-4">
          <div className="space-y-1 border border-black p-2 text-[10.5px]">
            <p className="font-bold">รายเงินได้ตามแบบแสดงรายการภาษีเงินได้หัก ณ ที่จ่าย ภ.ง.ด.1ก.</p>
            <p>
              จำนวน <span className="rd-line min-w-[14mm] text-center">{taxPayeeCount}</span> ราย เงินได้ทั้งสิ้น{" "}
              <span className="rd-line min-w-[30mm] text-right">{money(taxIncomeSatang)}</span> บาท
            </p>
            <p className="pl-4">
              ประกอบด้วย เงินเดือน <span className="rd-line min-w-[26mm] text-right">{money(t.salarySatang)}</span> บาท
            </p>
            <p className="pl-14">
              ค่าจ้างรายวัน <span className="rd-line min-w-[26mm] text-right">{money(t.dailySatang)}</span> บาท
            </p>
            <p className="pl-14">
              ค่าอื่น ๆ <span className="rd-line min-w-[26mm] text-right">{money(t.otherSatang)}</span> บาท
            </p>
          </div>
          <div className="space-y-5 text-[11px]">
            <p>
              ลงชื่อ <span className="rd-line min-w-[48mm]" /> นายจ้าง
            </p>
            <p className="pl-8">
              ( <span className="rd-line min-w-[48mm] text-center">{company.signer_name ?? ""}</span> )
            </p>
            <p>
              ตำแหน่ง <span className="rd-line min-w-[44mm]">{company.signer_position ?? ""}</span>
            </p>
            <div className="ml-auto grid size-[22mm] place-items-center rounded-full border border-dashed border-black text-center text-[9px] leading-tight">
              ประทับตรา
              <br />
              นิติบุคคล
              <br />
              (ถ้ามี)
            </div>
          </div>
        </div>

        <div className="border-t border-black pt-2">
          <div className="flex flex-wrap items-center gap-6 text-[11px]">
            <span>
              ประจำปี <span className="rd-line min-w-[16mm] text-center">{year + 543}</span>
            </span>
            <span>
              รหัสกิจการ <span className="rd-line min-w-[20mm]" />
            </span>
            <span>
              อัตราเงินสมทบ <span className="rd-line min-w-[20mm]" />
            </span>
            <b className="ml-auto">สำหรับเจ้าหน้าที่</b>
          </div>
          <table className="rd-table mt-1 text-[10.5px]">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>ค่าจ้าง</th>
                <th>ปรับขั้นต่ำ (เฉพาะลูกจ้าง 1 คน)</th>
                <th>ค่าจ้างสุทธิ</th>
                <th>เงินสมทบ</th>
              </tr>
            </thead>
            <tbody>
              {["การประเมินต้นปี", "การรายงานค่าจ้าง", "สปส 1-10"].map((r) => (
                <tr key={r} className="h-[7mm]">
                  <td>{r}</td>
                  <td /><td /><td /><td />
                </tr>
              ))}
              <tr className="h-[8mm]">
                <td colSpan={5}>กองทุนเงินทดแทน สรุปผลเป็นเรียกเพิ่ม (Dr.) , จ่ายคืน (Cr.)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
