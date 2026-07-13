"use client"

import Link from "next/link"
import { Bot, ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

interface LegalSection {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

interface LegalPageProps {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}

export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 sticky top-0 z-40 backdrop-blur-lg">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-primary to-blue-500 text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              حبقة <span className="gradient-text">Hubqa</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              {t('legal.backToHome')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-12 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight mb-3">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{t('legal.lastUpdated')}: {lastUpdated}</p>

        <p className="text-base leading-loose text-muted-foreground mb-10">{intro}</p>

        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-xl font-black mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {section.title}
              </h2>
              <div className="space-y-4 pr-11">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="leading-loose text-muted-foreground">{p}</p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 pr-4">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="leading-relaxed text-muted-foreground flex gap-2.5">
                        <span className="text-primary font-black shrink-0">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t text-sm text-muted-foreground leading-relaxed">
          {t('legal.contactNote')}{" "}
          <a href="mailto:bwmcmedia@gmail.com" className="text-primary font-bold hover:underline" dir="ltr">bwmcmedia@gmail.com</a>
        </div>
      </main>

      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {t('legal.footerCopyright')}</p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-foreground transition-colors">{t('legal.footerTerms')}</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">{t('legal.footerPrivacy')}</Link>
            <Link href="/data-deletion" className="hover:text-foreground transition-colors">{t('legal.footerDataDeletion')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
