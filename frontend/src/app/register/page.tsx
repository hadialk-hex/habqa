'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Loader2, Mail, Lock, User, Store, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function RegisterPage() {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(name, email, password, tenantName);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || t('auth.register.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* ===== Animated Gradient Background ===== */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10 animate-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_oklch(0.62_0.22_250_/_0.15),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_oklch(0.541_0.24_275_/_0.1),_transparent_50%)]" />

      {/* ===== Floating Blob Shapes ===== */}
      <div className="absolute top-[-8%] left-[-5%] w-[450px] h-[450px] bg-primary/15 animate-blob blur-3xl opacity-60" />
      <div className="absolute bottom-[-12%] right-[-8%] w-[550px] h-[550px] bg-primary/10 animate-blob delay-300 blur-3xl opacity-50" />
      <div className="absolute top-[50%] right-[5%] w-[280px] h-[280px] bg-primary/8 animate-blob delay-600 blur-2xl opacity-40" />
      <div className="absolute top-[15%] left-[20%] w-[200px] h-[200px] bg-primary/12 animate-blob delay-800 blur-2xl opacity-30" />

      {/* ===== Grid Pattern Overlay ===== */}
      <div className="absolute inset-0 bg-[linear-gradient(oklch(0.541_0.24_275_/_0.03)_1px,_transparent_1px),_linear-gradient(90deg,_oklch(0.541_0.24_275_/_0.03)_1px,_transparent_1px)] bg-[size:60px_60px]" />

      {/* ===== Register Card ===== */}
      <div className="relative z-10 w-full max-w-md mx-4 my-8 animate-fade-in-up">
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
            <h1 className="text-3xl font-bold gradient-text mb-1">حبقة Hubqa</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {t('auth.register.tagline')}
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground/80">
                {t('auth.register.nameLabel')}
              </Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder={t('auth.register.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                {t('auth.register.emailLabel')}
              </Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                {t('auth.register.passwordLabel')}
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Tenant Name Field */}
            <div className="space-y-2">
              <Label htmlFor="tenantName" className="text-sm font-medium text-foreground/80">
                {t('auth.register.tenantNameLabel')}
              </Label>
              <div className="relative">
                <Store className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="tenantName"
                  type="text"
                  placeholder={t('auth.register.tenantNamePlaceholder')}
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10 h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl p-3 animate-fade-in text-center">
                {error}
              </div>
            )}

            {/* Register Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-l from-primary to-primary/85 hover:from-primary/90 hover:to-primary/75 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('auth.register.submitting')}
                </span>
              ) : (
                t('auth.register.submit')
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              {t('auth.register.termsNotice')}{' '}
              <Link href="/terms" className="text-primary hover:underline font-bold">{t('auth.register.terms')}</Link>
              {' '}{t('auth.register.and')}{' '}
              <Link href="/privacy" className="text-primary hover:underline font-bold">{t('auth.register.privacy')}</Link>
            </p>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">{t('auth.register.haveAccount')}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors duration-200 group"
            >
              {t('auth.register.login')}
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Bottom decorative text */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          © {new Date().getFullYear()} {t('auth.copyright')}
        </p>
      </div>
    </div>
  );
}
