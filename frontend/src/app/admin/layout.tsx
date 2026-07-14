"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ShieldCheck } from "lucide-react"
import AuthGuard from "@/components/auth-guard"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/i18n/language-context"

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !user.isSuperAdmin) {
      router.push("/dashboard")
    }
  }, [isLoading, user, router])

  if (!user?.isSuperAdmin) {
    return null
  }

  return <>{children}</>
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <AuthGuard>
      <AdminGuard>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/50 px-4 lg:px-6 glass-strong sticky top-0 z-40">
              <SidebarTrigger className="-mr-1 hover:bg-accent rounded-lg transition-colors" />
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t("nav.platformAdmin")}
              </div>
              <div className="flex-1" />
              <ThemeToggle />
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8 animate-fade-in">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AdminGuard>
    </AuthGuard>
  )
}
