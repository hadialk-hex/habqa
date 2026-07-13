import type { Metadata } from "next"
import { TermsContent } from "./terms-content"

export const metadata: Metadata = {
  title: "الشروط والأحكام | حبقة Hubqa",
  description: "شروط وأحكام استخدام منصة حبقة لأتمتة الردود على وسائل التواصل الاجتماعي.",
}

export default function TermsPage() {
  return <TermsContent />
}
