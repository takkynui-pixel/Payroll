import type { Metadata } from "next";
import { PndDocument } from "@/components/tax/pnd-document";

export const metadata: Metadata = { title: "ภ.ง.ด.1" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PndDocument kind="pnd1" params={await searchParams} />;
}
