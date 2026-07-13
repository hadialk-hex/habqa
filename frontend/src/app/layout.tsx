import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Tajawal } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { LanguageProvider, type Locale } from "@/lib/i18n/language-context";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Hubqa حبقة | منصة الأتمتة الذكية",
  description: "منصة متكاملة للرد التلقائي الذكي على تعليقات ورسائل فيسبوك، انستغرام، وواتساب. لا تفوت أي عميل بعد اليوم.",
  keywords: ["رد آلي", "فيسبوك", "انستغرام", "واتساب", "أتمتة", "بوت", "حبقة", "hubqa", "chatbot", "automation"],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Hubqa حبقة | منصة الأتمتة الذكية",
    description: "منصة متكاملة للرد التلقائي الذكي — فيسبوك، انستغرام، وواتساب",
    type: "website",
    locale: "ar_SA",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get("locale")?.value === "en" ? "en" : "ar";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${tajawal.variable} font-sans min-h-screen flex flex-col bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider initialLocale={locale}>
            <AuthProvider>
              <ToastProvider>
                <ConfirmProvider>
                  {children}
                </ConfirmProvider>
              </ToastProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
