const PAGE = 1000;

/**
 * PostgREST จำกัดแถวต่อคำขอ (ค่าเริ่มต้น 1,000) จึงต้องดึงทีละหน้าเมื่อข้อมูลอาจเกินนั้น
 * ต้องใส่ order ที่คงที่ในคำสั่งที่ส่งเข้ามา ไม่งั้นหน้าที่ดึงอาจซ้ำหรือตกหล่น
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}
