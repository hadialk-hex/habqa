import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${tajawal.variable} font-sans min-h-screen flex flex-col bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
