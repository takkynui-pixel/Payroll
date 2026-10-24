import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // รับไฟล์ Excel นำเข้า (จำกัดที่ 4MB ฝั่งแอปอีกชั้น)
  // ไฟล์แบบฟอร์มสรรพากรและฟอนต์ที่อ่านตอนสร้าง PDF ต้องถูกแพ็กไปกับ route บน Vercel
  outputFileTracingIncludes: { "/admin/tax/pdf/[kind]": ["./lib/tax/pdf/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
