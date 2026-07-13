import type { Metadata } from "next"
import { PrivacyContent } from "./privacy-content"

export const metadata: Metadata = {
  title: "سياسة الخصوصية | حبقة Hubqa",
  description: "كيف تجمع منصة حبقة بياناتك وتستخدمها وتحميها.",
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
