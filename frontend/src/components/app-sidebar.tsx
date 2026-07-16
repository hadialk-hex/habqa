"use client"

import { Inbox, LayoutDashboard, MessageSquareText, Settings, Share2, Users, UserCog, LogOut, ChevronUp, ShieldCheck, Megaphone, Workflow } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { BrandMark } from "@/components/brand-logo"
import { useLanguage } from "@/lib/i18n/language-context"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t } = useLanguage()

  const mainItems = [
    { title: t('nav.home'), url: "/dashboard", icon: LayoutDashboard },
    { title: t('nav.inbox'), url: "/dashboard/inbox", icon: Inbox },
    { title: t('nav.rules'), url: "/dashboard/rules", icon: MessageSquareText },
    { title: t('nav.flows'), url: "/dashboard/flows", icon: Workflow },
  ]

  const toolItems = [
    { title: t('nav.broadcasts'), url: "/dashboard/broadcasts", icon: Megaphone },
    { title: t('nav.channels'), url: "/dashboard/channels", icon: Share2 },
    { title: t('nav.subscribers'), url: "/dashboard/subscribers", icon: Users },
  ]

  const systemItems = [
    { title: t('nav.team'), url: "/dashboard/team", icon: UserCog },
    { title: t('nav.settings'), url: "/dashboard/settings", icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const userInitials = user?.name ? user.name.substring(0, 2) : t('nav.user').substring(0, 1)
  const isItemActive = (url: string) => pathname === url || (pathname.startsWith(url) && url !== '/dashboard')

  const renderMenuItems = (items: typeof mainItems) => (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const active = isItemActive(item.url)
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={<Link href={item.url} />}
              isActive={active}
              tooltip={item.title}
              className={`relative mx-2 h-9 rounded-lg transition-colors duration-200 group/item ${
                active
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              {/* Active indicator bar (RTL: on the right edge) */}
              {active && (
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-[3px] h-4.5 rounded-l-full bg-primary" />
              )}
              <item.icon className={`w-[18px] h-[18px] transition-colors duration-200 ${
                active ? 'text-primary' : 'text-muted-foreground/70 group-hover/item:text-foreground'
              }`} />
              <span className="text-[13px]">{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )

  return (
    <Sidebar side="right" variant="inset">
      {/* ─── Header: unified brand mark ────────────────────────────── */}
      <SidebarHeader className="px-4 py-4 border-b border-border/40">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
            <BrandMark size={38} className="rounded-[11px] shadow-md shadow-primary/20" />
            <div className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-sidebar" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg leading-6 tracking-tight">
              حبقة <span className="bg-gradient-to-l from-[#4d9fff] to-[#22d3ee] bg-clip-text text-transparent">Hubqa</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {t('nav.tagline')}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {/* ─── Main Navigation ─────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.14em] px-4 mb-0.5">
            {t('nav.coreTools')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(mainItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── Growth Tools ────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.14em] px-4 mb-0.5">
            {t('nav.growthTools')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(toolItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── System ──────────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.14em] px-4 mb-0.5">
            {t('nav.system')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(systemItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── Admin (Super Admin Only) ────────────────────────────── */}
        {user?.isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold text-red-400/60 uppercase tracking-[0.14em] px-4 mb-0.5">
              {t('nav.platformAdmin')}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/admin" />}
                    isActive={pathname.startsWith('/admin')}
                    tooltip={t('nav.adminPanel')}
                    className={`relative mx-2 h-9 rounded-lg transition-colors duration-200 ${
                      pathname.startsWith('/admin')
                        ? 'bg-red-500/10 text-red-400 font-bold'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    }`}
                  >
                    {pathname.startsWith('/admin') && (
                      <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-[3px] h-4.5 rounded-l-full bg-red-400" />
                    )}
                    <ShieldCheck className={`w-[18px] h-[18px] ${pathname.startsWith('/admin') ? 'text-red-400' : 'text-muted-foreground/70'}`} />
                    <span className="text-[13px]">{t('nav.adminPanel')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ─── Footer: User Profile & Logout ─────────────────────────── */}
      <SidebarFooter className="border-t border-border/40 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/60 transition-colors duration-200 cursor-pointer group w-full text-right border-none bg-transparent outline-none">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/15 shrink-0 group-hover:border-primary/30 transition-colors duration-200">
                <span className="text-primary font-bold text-sm">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user?.name || t('nav.user')}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
              </div>
              <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-[220px] rounded-xl p-1">
            <DropdownMenuItem onClick={() => router.push('/dashboard')} className="gap-2 cursor-pointer rounded-lg">
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('nav.dashboard')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="gap-2 cursor-pointer rounded-lg">
              <Settings className="w-4 h-4" />
              <span>{t('nav.settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive gap-2 cursor-pointer rounded-lg">
              <LogOut className="w-4 h-4" />
              <span>{t('nav.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
