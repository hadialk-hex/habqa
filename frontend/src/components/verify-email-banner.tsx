"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MailWarning, CheckCircle2, RefreshCw } from "lucide-react"
import api from "@/lib/api"

// Shown at the top of the dashboard until the user confirms their email
// with the 6-digit OTP code. Hidden entirely once verified.
export function VerifyEmailBanner() {
  const [status, setStatus] = useState<"loading" | "unverified" | "verified">("loading")
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.get("/auth/profile")
      .then(res => setStatus(res.data.emailVerified ? "verified" : "unverified"))
      .catch(() => setStatus("verified")) // fail closed: don't nag if profile fails
  }, [])

  if (status !== "unverified") return null

  const handleVerify = async () => {
    try {
      setIsSubmitting(true)
      setMessage(null)
      await api.post("/auth/verify-email", { code })
      setStatus("verified")
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setMessage(axiosErr.response?.data?.message || "رمز غير صحيح")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      setIsResending(true)
      setMessage(null)
      await api.post("/auth/verify-email/resend")
      setMessage("تم إرسال رمز جديد إلى بريدك.")
    } catch {
      setMessage("تعذر إرسال الرمز. حاول لاحقاً.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 animate-fade-in">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <MailWarning className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">فعّل بريدك الإلكتروني</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
            {message || "أرسلنا رمز تفعيل من 6 أرقام إلى بريدك. أدخله هنا لتأمين حسابك."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="------"
          className="rounded-lg h-9 w-28 text-center font-black tracking-[0.3em]"
          dir="ltr"
          inputMode="numeric"
        />
        <Button size="sm" className="rounded-lg h-9 gap-1.5 font-bold" disabled={code.length !== 6 || isSubmitting} onClick={handleVerify}>
          {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          تفعيل
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg h-9 text-xs" disabled={isResending} onClick={handleResend}>
          {isResending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "إعادة إرسال"}
        </Button>
      </div>
    </div>
  )
}
