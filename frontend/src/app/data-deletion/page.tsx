import type { Metadata } from "next"
import { DataDeletionContent } from "./data-deletion-content"

export const metadata: Metadata = {
  title: "حذف البيانات | حبقة Hubqa",
  description: "كيفية طلب حذف بياناتك نهائياً من منصة حبقة.",
}

export default function DataDeletionPage() {
  return <DataDeletionContent />
}
