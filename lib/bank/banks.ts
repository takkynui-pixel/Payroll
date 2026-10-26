/**
 * รหัสธนาคารไทย 3 หลัก (รหัสสถาบันการเงินของ ธปท.) และการแปลงชื่อที่พิมพ์เองให้เป็นรหัส
 * ข้อมูลพนักงานเก็บ bank_code เป็นข้อความอิสระ (เช่น KBANK, SCB, กสิกร) จึงต้อง normalize ก่อนออกไฟล์
 */
export interface BankInfo {
  code: string;
  short: string;
  name: string;
}

export const BANKS: readonly BankInfo[] = [
  { code: "002", short: "BBL", name: "ธนาคารกรุงเทพ" },
  { code: "004", short: "KBANK", name: "ธนาคารกสิกรไทย" },
  { code: "006", short: "KTB", name: "ธนาคารกรุงไทย" },
  { code: "011", short: "TTB", name: "ธนาคารทหารไทยธนชาต" },
  { code: "014", short: "SCB", name: "ธนาคารไทยพาณิชย์" },
  { code: "022", short: "CIMBT", name: "ธนาคารซีไอเอ็มบี ไทย" },
  { code: "024", short: "UOB", name: "ธนาคารยูโอบี" },
  { code: "025", short: "BAY", name: "ธนาคารกรุงศรีอยุธยา" },
  { code: "030", short: "GSB", name: "ธนาคารออมสิน" },
  { code: "033", short: "GHB", name: "ธนาคารอาคารสงเคราะห์" },
  { code: "034", short: "BAAC", name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  { code: "066", short: "ISBT", name: "ธนาคารอิสลามแห่งประเทศไทย" },
  { code: "067", short: "TISCO", name: "ธนาคารทิสโก้" },
  { code: "069", short: "KKP", name: "ธนาคารเกียรตินาคินภัทร" },
  { code: "070", short: "ICBC", name: "ธนาคารไอซีบีซี (ไทย)" },
  { code: "071", short: "TCRB", name: "ธนาคารไทยเครดิต" },
  { code: "073", short: "LHB", name: "ธนาคารแลนด์ แอนด์ เฮ้าส์" },
];

const ALIASES: Record<string, string> = {
  BBL: "002", BANGKOK: "002", BANGKOKBANK: "002", กรุงเทพ: "002",
  KBANK: "004", KBNK: "004", KASIKORN: "004", KASIKORNBANK: "004", KBK: "004", กสิกร: "004", กสิกรไทย: "004",
  KTB: "006", KRUNGTHAI: "006", กรุงไทย: "006",
  TTB: "011", TMB: "011", TMBTHANACHART: "011", TMBT: "011", ทหารไทย: "011", ทหารไทยธนชาต: "011", ธนชาต: "011", ทีทีบี: "011",
  SCB: "014", ไทยพาณิชย์: "014",
  CIMB: "022", CIMBT: "022", ซีไอเอ็มบี: "022",
  UOB: "024", UOBT: "024", ยูโอบี: "024",
  BAY: "025", KRUNGSRI: "025", AYUDHYA: "025", กรุงศรี: "025", กรุงศรีอยุธยา: "025",
  GSB: "030", ออมสิน: "030",
  GHB: "033", GHBANK: "033", อาคารสงเคราะห์: "033", ธอส: "033",
  BAAC: "034", ธกส: "034", เพื่อการเกษตรและสหกรณ์การเกษตร: "034", เพื่อการเกษตร: "034",
  ISBT: "066", IBANK: "066", อิสลาม: "066", อิสลามแห่งประเทศไทย: "066",
  TISCO: "067", ทิสโก้: "067",
  KKP: "069", KKB: "069", เกียรตินาคิน: "069", เกียรตินาคินภัทร: "069",
  ICBC: "070", ไอซีบีซี: "070",
  TCRB: "071", ไทยเครดิต: "071",
  LHB: "073", LH: "073", LHBANK: "073", แลนด์แอนด์เฮ้าส์: "073",
};

/** แปลงข้อความธนาคารที่พิมพ์เอง (KBANK / กสิกร / 004 ...) เป็นรหัส 3 หลัก  ไม่รู้จัก = null */
export function normalizeBankCode(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toUpperCase().replace(/[\s.\-_/()]/g, "");
  if (!s) return null;
  if (/^\d{3}$/.test(s)) return BANKS.some((b) => b.code === s) ? s : null;
  s = s.replace(/^ธนาคาร/, "").replace(/^ธ(?=[ก-๙])/, "").replace(/^BANK(?=[A-Z])/, "").replace(/BANK$/, "");
  return ALIASES[s] ?? ALIASES[input.trim().toUpperCase().replace(/[\s.\-_/()]/g, "")] ?? null;
}

export function bankByCode(code: string | null | undefined): BankInfo | null {
  return BANKS.find((b) => b.code === code) ?? null;
}
