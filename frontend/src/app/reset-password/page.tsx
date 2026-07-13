"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, Loader2, Lock, CheckCircle2, Sparkles } from "lucide-react"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) {
      setError(t('auth.resetPassword.errorTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.errorMismatch'))
      return
    }
    try {
      setLoading(true)
      await api.post("/auth/password-reset/reset", { token, password })
      setDone(true)
      setTimeout(() => router.push("/login"), 2500)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || t('auth.resetPassword.errorInvalidLink'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* ===== Animated Gradient Background ===== */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 animate-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.541_0.24_275_/_0.15),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_oklch(0.62_0.22_250_/_0.1),_transparent_50%)]" />

      {/* ===== Floating Blob Shapes ===== */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/15 animate-blob blur-3xl opacity-60" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-primary/10 animate-blob delay-200 blur-3xl opacity-50" />
      <div className="absolute top-[40%] left-[10%] w-[300px] h-[300px] bg-primary/8 animate-blob delay-500 blur-2xl opacity-40" />
      <div className="absolute bottom-[20%] right-[15%] w-[250px] h-[250px] bg-primary/12 animate-blob delay-700 blur-2xl opacity-30" />

      {/* ===== Grid Pattern Overlay ===== */}
      <div className="absolute inset-0 bg-[linear-gradient(oklch(0.541_0.24_275_/_0.03)_1px,_transparent_1px),_linear-gradient(90deg,_oklch(0.541_0.24_275_/_0.03)_1px,_transparent_1px)] bg-[size:60px_60px]" />

      {/* ===== Reset Password Card ===== */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="absolute -top-12 left-0">
          <LanguageSwitcher />
        </div>
        <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-primary/10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/25 rounded-2xl blur-xl animate-pulse-glow" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 animate-float">
                <Bot className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold gradient-text mb-1">{t('auth.resetPassword.title')}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {t('auth.resetPassword.tagline')}
            </p>
          </div>

          {!token ? (
            <div className="text-center text-sm text-muted-foreground leading-relaxed">
              {t('auth.resetPassword.incompleteLink')}{" "}
              <Link href="/forgot-password" className="text-primary font-bold hover:underline">{t('auth.resetPassword.requestNewLink')}</Link>.
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="font-black text-lg mb-2">{t('auth.resetPassword.doneTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('auth.resetPassword.doneMessage')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">{t('auth.resetPassword.newPasswordLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm font-medium text-foreground/80">{t('auth.resetPassword.confirmPasswordLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                    dir="ltr"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl p-3 animate-fade-in text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full h-12 rounded-xl bg-gradient-to-l from-primary to-primary/85 hover:from-primary/90 hover:to-primary/75 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('auth.resetPassword.submitting')}
                  </span>
                ) : (
                  t('auth.resetPassword.submit')
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Bottom decorative text */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          © {new Date().getFullYear()} {t('auth.copyright')}
        </p>
      </div>
    </div>
  )
}
