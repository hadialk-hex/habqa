"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Zap,
  Smartphone,
  Inbox,
  BarChart3,
  Target,
  Shield,
  ArrowLeft,
  Link2,
  Settings2,
  Rocket,
  Check,
  Star,
  MessageCircle,
  Users,
  Clock,
  Globe,
  Send,
  ChevronUp,
  AtSign,
  Hash,
  ExternalLink,
  Menu,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";

/* ──────────────────────────────────────────────
   ANIMATION VARIANTS
   ────────────────────────────────────────────── */
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

/* ──────────────────────────────────────────────
   ANIMATED COUNTER HOOK
   ────────────────────────────────────────────── */
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return { count, ref };
}

/* ──────────────────────────────────────────────
   DATA (built from the active locale's dictionary)
   ────────────────────────────────────────────── */
type TFn = (path: string, vars?: Record<string, string | number>) => string;
type TListFn = (path: string) => string[];

function getFeatures(t: TFn) {
  return [
    { icon: Zap, title: t("landing.features.items.instant.title"), description: t("landing.features.items.instant.description"), gradient: "from-yellow-400 to-orange-500" },
    { icon: Smartphone, title: t("landing.features.items.multiPlatform.title"), description: t("landing.features.items.multiPlatform.description"), gradient: "from-blue-400 to-cyan-500" },
    { icon: Inbox, title: t("landing.features.items.unifiedInbox.title"), description: t("landing.features.items.unifiedInbox.description"), gradient: "from-sky-400 to-blue-500" },
    { icon: BarChart3, title: t("landing.features.items.analytics.title"), description: t("landing.features.items.analytics.description"), gradient: "from-green-400 to-emerald-500" },
    { icon: Target, title: t("landing.features.items.flexibleRules.title"), description: t("landing.features.items.flexibleRules.description"), gradient: "from-red-400 to-orange-500" },
    { icon: Shield, title: t("landing.features.items.security.title"), description: t("landing.features.items.security.description"), gradient: "from-slate-500 to-blue-600" },
  ];
}

function getSteps(t: TFn) {
  return [
    { icon: Link2, title: t("landing.howItWorks.steps.connect.title"), description: t("landing.howItWorks.steps.connect.description"), step: "01" },
    { icon: Settings2, title: t("landing.howItWorks.steps.createRules.title"), description: t("landing.howItWorks.steps.createRules.description"), step: "02" },
    { icon: Rocket, title: t("landing.howItWorks.steps.seeResults.title"), description: t("landing.howItWorks.steps.seeResults.description"), step: "03" },
  ];
}

function getPricingPlans(t: TFn, tList: TListFn) {
  return [
    { name: t("landing.pricing.plans.free.name"), price: "0", period: t("landing.pricing.perMonth"), description: t("landing.pricing.plans.free.description"), popular: false, features: tList("landing.pricing.plans.free.features") },
    { name: t("landing.pricing.plans.pro.name"), price: "29", period: t("landing.pricing.perMonth"), description: t("landing.pricing.plans.pro.description"), popular: true, features: tList("landing.pricing.plans.pro.features") },
    { name: t("landing.pricing.plans.enterprise.name"), price: "99", period: t("landing.pricing.perMonth"), description: t("landing.pricing.plans.enterprise.description"), popular: false, features: tList("landing.pricing.plans.enterprise.features") },
  ];
}

/* ──────────────────────────────────────────────
   SECTION HEADING COMPONENT
   ────────────────────────────────────────────── */
function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeInUp}
      className="text-center mb-16 md:mb-20"
    >
      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary mb-6">
        {badge}
      </span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
        {title}
      </h2>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════ */
export default function Home() {
  const { t, tList } = useLanguage();
  const features = getFeatures(t);
  const steps = getSteps(t);
  const pricingPlans = getPricingPlans(t, tList);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  // Stats counters
  const stat1 = useCounter(12000);
  const stat2 = useCounter(50000);
  const stat3 = useCounter(99);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      {/* ════════════════════════════════════════
          NAVBAR
          ════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "glass shadow-lg shadow-primary/5"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative bg-gradient-to-br from-primary to-blue-500 text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow duration-300">
              <Bot className="w-5 h-5" />
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              حبقة <span className="gradient-text">Hubqa</span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex gap-8 items-center text-sm font-medium text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors duration-200 relative after:absolute after:bottom-0 after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
            >
              {t("landing.nav.features")}
            </a>
            <a
              href="#pricing"
              className="hover:text-foreground transition-colors duration-200 relative after:absolute after:bottom-0 after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
            >
              {t("landing.nav.pricing")}
            </a>
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors duration-200 relative after:absolute after:bottom-0 after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
            >
              {t("landing.nav.howItWorks")}
            </a>
            <a
              href="#about"
              className="hover:text-foreground transition-colors duration-200 relative after:absolute after:bottom-0 after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
            >
              {t("landing.nav.about")}
            </a>
            <a
              href="#contact"
              className="hover:text-foreground transition-colors duration-200 relative after:absolute after:bottom-0 after:right-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all hover:after:w-full"
            >
              {t("landing.nav.contact")}
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:inline-block">
              <Button variant="ghost" className="rounded-full px-5 font-bold hover:bg-primary/10 hover:text-primary transition-all duration-300">
                {t("landing.nav.login")}
              </Button>
            </Link>
            <Link href="/register" className="hidden sm:inline-block">
              <Button className="gap-2 rounded-full px-5 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300">
                {t("landing.nav.startFree")}
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            {/* Mobile Hamburger Menu */}
            <Sheet>
              <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden rounded-xl" />}>
                <Menu className="w-5 h-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-6 flex flex-col gap-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-gradient-to-br from-primary to-blue-500 text-primary-foreground p-2 rounded-xl">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold">حبقة Hubqa</span>
                </div>
                <nav className="flex flex-col gap-4 text-base font-bold text-muted-foreground">
                  <a href="#features" className="hover:text-foreground py-2 border-b border-border/30">{t("landing.nav.features")}</a>
                  <a href="#pricing" className="hover:text-foreground py-2 border-b border-border/30">{t("landing.nav.pricing")}</a>
                  <a href="#how-it-works" className="hover:text-foreground py-2 border-b border-border/30">{t("landing.nav.howItWorks")}</a>
                  <a href="#about" className="hover:text-foreground py-2 border-b border-border/30">{t("landing.nav.about")}</a>
                  <a href="#contact" className="hover:text-foreground py-2 border-b border-border/30">{t("landing.nav.contact")}</a>
                </nav>
                <div className="mt-auto flex flex-col gap-3">
                  <LanguageSwitcher className="w-full justify-center" />
                  <Link href="/login">
                    <Button variant="outline" className="w-full rounded-xl font-bold">{t("landing.nav.login")}</Button>
                  </Link>
                  <Link href="/register">
                    <Button className="w-full rounded-xl font-bold">{t("landing.nav.startFree")}</Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ════════════════════════════════════════
            HERO SECTION
            ════════════════════════════════════════ */}
        <section ref={heroRef} className="relative overflow-hidden pt-16 pb-24 md:pt-28 md:pb-36">
          {/* Animated Background Blobs */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-[-10%] right-[-15%] w-[500px] h-[500px] bg-primary/15 animate-blob opacity-70 blur-3xl" />
            <div className="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-blue-500/10 animate-blob delay-200 opacity-60 blur-3xl" />
            <div className="absolute bottom-[-15%] right-[20%] w-[600px] h-[600px] bg-emerald-500/10 animate-blob delay-500 opacity-50 blur-3xl" />
            <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/8 animate-blob delay-700 opacity-40 blur-3xl" />
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.541_0.24_275/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.541_0.24_275/0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
          </div>

          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="container mx-auto px-4 text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary shadow-sm mb-8">
                <Star className="w-4 h-4 fill-primary text-primary" />
                {t("landing.hero.badge")}
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.15]"
            >
              {t("landing.hero.titleLine1")}
              <br />
              <span className="gradient-text">{t("landing.hero.titleLine2")}</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              {t("landing.hero.subtitle")}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-col sm:flex-row justify-center gap-4 mb-8"
            >
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-13 px-8 text-base rounded-full shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 transition-all duration-300 w-full sm:w-auto gap-2 animate-pulse-glow"
                >
                  {t("landing.hero.ctaPrimary")}
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-13 px-8 text-base rounded-full gap-2 w-full sm:w-auto border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                >
                  {t("landing.hero.ctaSecondary")}
                </Button>
              </a>
            </motion.div>

            {/* Platform Icons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="flex items-center justify-center gap-3 text-muted-foreground/50 mb-4"
            >
              <Globe className="w-5 h-5" />
              <AtSign className="w-5 h-5" />
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">{t("landing.hero.platformsNote")}</span>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="container mx-auto px-4 mt-16"
          >
            <div className="glass-strong rounded-2xl p-6 md:p-8 shadow-xl shadow-primary/5 max-w-4xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                {[
                  {
                    value: stat1,
                    suffix: "+",
                    label: t("landing.stats.activeCustomers"),
                    icon: Users,
                    format: (n: number) => n.toLocaleString(),
                  },
                  {
                    value: stat2,
                    suffix: "+",
                    label: t("landing.stats.autoReplies"),
                    icon: Send,
                    format: (n: number) => n.toLocaleString(),
                  },
                  {
                    value: stat3,
                    suffix: ".9%",
                    label: t("landing.stats.uptime"),
                    icon: Clock,
                    format: (n: number) => String(n),
                  },
                  {
                    value: { count: 3, ref: null },
                    suffix: "",
                    label: t("landing.stats.connectedPlatforms"),
                    icon: Globe,
                    format: (n: number) => String(n),
                  },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    ref={stat.value.ref}
                    className="text-center group"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <stat.icon className="w-5 h-5 text-primary/60 ml-2" />
                      <span className="text-2xl md:text-3xl font-extrabold gradient-text">
                        {stat.format(stat.value.count)}
                        {stat.suffix}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════
            FEATURES SECTION
            ════════════════════════════════════════ */}
        <section id="features" className="relative py-24 md:py-32">
          {/* Subtle background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />
          </div>

          <div className="container mx-auto px-4 md:px-6">
            <SectionHeading
              badge={t("landing.features.badge")}
              title={t("landing.features.title")}
              subtitle={t("landing.features.subtitle")}
            />

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  variants={scaleIn}
                  custom={idx}
                  className="group relative rounded-2xl border border-border/50 bg-card p-7 md:p-8 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/20"
                >
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative">
                    {/* Icon */}
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg shadow-primary/10 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            HOW IT WORKS SECTION
            ════════════════════════════════════════ */}
        <section id="how-it-works" className="relative py-24 md:py-32 bg-muted/30">
          {/* Background Decor */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-[20%] left-[-5%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-[10%] right-[-5%] w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 md:px-6">
            <SectionHeading
              badge={t("landing.howItWorks.badge")}
              title={t("landing.howItWorks.title")}
              subtitle={t("landing.howItWorks.subtitle")}
            />

            <div className="max-w-4xl mx-auto">
              <div className="relative">
                {/* Connecting Line */}
                <div className="hidden md:block absolute top-24 right-[calc(16.67%+28px)] left-[calc(16.67%+28px)] h-0.5 bg-gradient-to-l from-primary/40 via-primary/20 to-primary/40" />

                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={staggerContainer}
                  className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8"
                >
                  {steps.map((step, idx) => (
                    <motion.div
                      key={idx}
                      variants={fadeInUp}
                      custom={idx}
                      className="relative text-center group"
                    >
                      {/* Step Number Circle */}
                      <div className="relative mx-auto mb-6 w-24 h-24">
                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 group-hover:from-primary/30 group-hover:to-blue-500/30 transition-all duration-500" />
                        {/* Inner circle */}
                        <div className="absolute inset-2 rounded-full bg-card shadow-lg flex items-center justify-center group-hover:shadow-xl group-hover:shadow-primary/10 transition-all duration-500">
                          <step.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        {/* Step number */}
                        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-500 text-white text-sm font-bold flex items-center justify-center shadow-md">
                          {step.step}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                        {step.description}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            PRICING SECTION
            ════════════════════════════════════════ */}
        <section id="pricing" className="relative py-24 md:py-32">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-l from-transparent via-primary/20 to-transparent" />
          </div>

          <div className="container mx-auto px-4 md:px-6">
            <SectionHeading
              badge={t("landing.pricing.badge")}
              title={t("landing.pricing.title")}
              subtitle={t("landing.pricing.subtitle")}
            />

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto items-start"
            >
              {pricingPlans.map((plan, idx) => (
                <motion.div
                  key={idx}
                  variants={scaleIn}
                  custom={idx}
                  className={`relative rounded-2xl p-7 md:p-8 transition-all duration-500 hover:-translate-y-1 ${
                    plan.popular
                      ? "bg-gradient-to-br from-primary/5 via-card to-blue-500/5 border-2 border-primary shadow-xl shadow-primary/10 scale-[1.02] md:scale-105"
                      : "bg-card border border-border/50 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-primary to-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-primary/25">
                        <Star className="w-3.5 h-3.5 fill-white" />
                        {t("landing.pricing.popularBadge")}
                      </span>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    <h3
                      className={`text-xl font-bold mb-2 ${
                        plan.popular ? "text-primary" : ""
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5">
                      {plan.description}
                    </p>
                    <div className="flex items-baseline justify-center gap-1" dir="ltr">
                      <span className="text-2xl md:text-3xl font-extrabold gradient-text self-start mt-1">
                        $
                      </span>
                      <span className="text-4xl md:text-5xl font-extrabold gradient-text">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground text-sm ml-1">
                        / {plan.period}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-l from-transparent via-border to-transparent mb-7" />

                  {/* Features List */}
                  <ul className="space-y-3.5 mb-8">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-3 text-sm">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            plan.popular
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link href="/register" className="block">
                    <Button
                      className={`w-full rounded-xl h-11 text-base transition-all duration-300 ${
                        plan.popular
                          ? "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                          : ""
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.price === "0" ? t("landing.pricing.ctaFree") : t("landing.pricing.ctaPaid")}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            CTA SECTION
            ════════════════════════════════════════ */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-blue-600 animate-gradient" />
          {/* Decorative Shapes */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-[10%] right-[10%] w-[200px] h-[200px] bg-white/5 rounded-full blur-2xl animate-blob" />
            <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-2xl animate-blob delay-300" />
            <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/3 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeInUp}
              className="text-center max-w-3xl mx-auto"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                {t("landing.ctaSection.title")}
              </h2>
              <p className="text-lg md:text-xl text-white/80 mb-10 leading-relaxed max-w-2xl mx-auto">
                {t("landing.ctaSection.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="h-13 px-10 text-base rounded-full bg-white text-primary hover:bg-white/90 shadow-xl shadow-black/10 hover:shadow-2xl transition-all duration-300 w-full sm:w-auto gap-2 font-bold"
                  >
                    {t("landing.ctaSection.ctaPrimary")}
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <a href="#pricing">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-13 px-10 text-base rounded-full border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
                  >
                    {t("landing.ctaSection.ctaSecondary")}
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            ABOUT US SECTION
            ════════════════════════════════════════ */}
        <section id="about" className="py-24 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="max-w-4xl mx-auto"
            >
              <motion.div variants={fadeInUp} className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-500 text-white mb-6 shadow-lg shadow-primary/20">
                  <Users className="w-8 h-8" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t("landing.about.title")}</h2>
                <div className="w-20 h-1 bg-gradient-to-l from-primary to-blue-500 mx-auto rounded-full" />
              </motion.div>

              <motion.div variants={fadeInUp} custom={1} className="grid md:grid-cols-2 gap-8">
                <div className="bg-card rounded-2xl p-8 border shadow-lg hover:shadow-xl transition-all duration-300">
                  <h3 className="text-xl font-bold mb-4 gradient-text">{t("landing.about.vision.title")}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {t("landing.about.vision.text")}
                  </p>
                </div>
                <div className="bg-card rounded-2xl p-8 border shadow-lg hover:shadow-xl transition-all duration-300">
                  <h3 className="text-xl font-bold mb-4 gradient-text">{t("landing.about.mission.title")}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {t("landing.about.mission.text")}
                  </p>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} custom={2} className="mt-8 grid sm:grid-cols-3 gap-6">
                {[
                  { num: "2026", label: t("landing.about.stats.founded"), icon: Rocket },
                  { num: "12K+", label: t("landing.about.stats.activeUsers"), icon: Users },
                  { num: "3", label: t("landing.about.stats.platforms"), icon: Globe },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center bg-muted/50 rounded-xl p-6 hover:bg-muted/80 transition-colors">
                    <stat.icon className="w-6 h-6 text-primary mx-auto mb-3" />
                    <div className="text-2xl font-black gradient-text">{stat.num}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            CONTACT SECTION
            ════════════════════════════════════════ */}
        <section id="contact" className="py-24 md:py-28 relative overflow-hidden bg-muted/30">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="max-w-3xl mx-auto"
            >
              <motion.div variants={fadeInUp} className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-primary text-white mb-6 shadow-lg shadow-blue-500/20">
                  <Send className="w-8 h-8" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t("landing.contact.title")}</h2>
                <p className="text-muted-foreground text-lg">{t("landing.contact.subtitle")}</p>
                <div className="w-20 h-1 bg-gradient-to-l from-blue-500 to-primary mx-auto rounded-full mt-4" />
              </motion.div>

              <motion.div variants={fadeInUp} custom={1} className="bg-card rounded-2xl p-8 md:p-10 border shadow-xl">
                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("landing.contact.emailLabel")}</p>
                      <a href="mailto:bwmcmedia@gmail.com" className="font-medium hover:text-primary transition-colors" dir="ltr">
                        bwmcmedia@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("landing.contact.supportHoursLabel")}</p>
                      <p className="font-medium">{t("landing.contact.supportHoursValue")}</p>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    {t("landing.contact.note")}
                  </p>
                  <Link href="/register">
                    <Button size="lg" className="rounded-full px-8 gap-2">
                      {t("landing.contact.cta")}
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════ */}
      <footer className="relative border-t bg-card/50 pt-16 pb-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Logo & Description */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <div className="bg-gradient-to-br from-primary to-blue-500 text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">
                  حبقة <span className="gradient-text">Hubqa</span>
                </span>
              </Link>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-sm">
                {t("landing.footer.description")}
              </p>
              {/* Social Icons */}
              <div className="flex gap-3">
                {[
                  { icon: Hash, label: "Twitter" },
                  { icon: Globe, label: "Facebook" },
                  { icon: AtSign, label: "Instagram" },
                  { icon: ExternalLink, label: "Github" },
                ].map((social, idx) => (
                  <a
                    key={idx}
                    href="#"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-xl bg-muted/80 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all duration-300 text-muted-foreground"
                  >
                    <social.icon className="w-4.5 h-4.5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Column: Product */}
            <div>
              <h4 className="font-bold mb-4 text-sm">{t("landing.footer.columns.product.title")}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.product.features")}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.product.pricing")}
                  </a>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.product.dashboard")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column: Company */}
            <div>
              <h4 className="font-bold mb-4 text-sm">{t("landing.footer.columns.company.title")}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#about" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.company.about")}
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.company.contact")}
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.company.howItWorks")}
                  </a>
                </li>
              </ul>
            </div>

            {/* Column: Legal */}
            <div>
              <h4 className="font-bold mb-4 text-sm">{t("landing.footer.columns.legal.title")}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.legal.privacy")}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.legal.terms")}
                  </Link>
                </li>
                <li>
                  <Link href="/data-deletion" className="hover:text-foreground transition-colors">
                    {t("landing.footer.columns.legal.dataDeletion")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {t("landing.footer.copyright")}</p>
            <p className="flex items-center gap-1.5">
              {t("landing.footer.madeWith")}
            </p>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════════════════
          SCROLL TO TOP BUTTON
          ════════════════════════════════════════ */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 left-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/35 hover:scale-110 ${
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        aria-label={t("landing.footer.backToTop")}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}
