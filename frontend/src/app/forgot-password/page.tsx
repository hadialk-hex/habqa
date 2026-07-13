"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, Loader2, Mail, CheckCircle2, ArrowRight, Sparkles } from "lucide-react"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      setLoading(true)
      await api.post("/auth/password-reset", { email })
      setSent(true)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
      if (axiosErr.response?.status === 429) {
        setError(t('auth.forgotPassword.errorRateLimit'))
      } else if (axiosErr.response?.status === 404) {
        setError(t('auth.forgotPassword.errorNotFound'))
      } else {
        setError(t('auth.forgotPassword.errorGeneric'))
      }
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

      {/* ===== Forgot Password Card ===== */}
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
            <h1 className="text-3xl font-bold gradient-text mb-1">{t('auth.forgotPassword.title')}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {t('auth.forgotPassword.tagline')}
            </p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="font-black text-lg mb-2">{t('auth.forgotPassword.sentTitle')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {(() => {
                  const marker = "@@EMAIL@@";
                  const [before, after] = t('auth.forgotPassword.sentMessage', { email: marker }).split(marker);
                  return <>{before}<span className="font-bold" dir="ltr">{email}</span>{after}</>;
                })()}
              </p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors duration-200">
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">{t('auth.forgotPassword.emailLabel')}</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com"
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
                disabled={loading || !email}
                className="w-full h-12 rounded-xl bg-gradient-to-l from-primary to-primary/85 hover:from-primary/90 hover:to-primary/75 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('auth.forgotPassword.submitting')}
                  </span>
                ) : (
                  t('auth.forgotPassword.submit')
                )}
              </Button>

              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group">
                  {t('auth.forgotPassword.backToLogin')}
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
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
