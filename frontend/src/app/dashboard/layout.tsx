"use client"
 
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Bell, MessageCircle, Users, Zap, Shield, Check, X } from "lucide-react"
import AuthGuard from "@/components/auth-guard"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { useState, useRef, useEffect } from "react"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"

interface Notification {
  id: string
  title: string
  message: string
  type: 'message' | 'subscriber' | 'rule' | 'system'
  read: boolean
  createdAt: string
}

// Removed MOCK_NOTIFICATIONS
function NotificationIcon({ type }: { type: Notification['type'] }) {
  const configs = {
    message: { icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    subscriber: { icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    rule: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    system: { icon: Shield, color: 'text-primary', bg: 'bg-primary/10' }
  }
  const cfg = configs[type]
  return (
    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
      <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
    </div>
  )
}

function formatTimeAgo(dateStr: string, t: (path: string, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('notifications.timeNow')
  if (mins < 60) return t('notifications.timeMinutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('notifications.timeHoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('notifications.timeDaysAgo', { n: days })
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch real notifications
    api.get('/notifications')
      .then((res: any) => setNotifications(res.data))
      .catch(console.error)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (err) { console.error(err) }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) { console.error(err) }
  }

  const dismissNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) { console.error(err) }
  }

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/50 px-4 lg:px-6 glass-strong sticky top-0 z-40">
            <SidebarTrigger className="-mr-1 hover:bg-accent rounded-lg transition-colors" />
            
            <div className="flex-1" />
            
            {/* Notifications */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl hover:bg-accent transition-colors group"
              >
                <Bell className={`w-5 h-5 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                    <h3 className="font-black text-sm">{t('notifications.title')}</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {t('notifications.markAllRead')}
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => markAsRead(notif.id)}
                          className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-accent/30 border-b border-border/10 last:border-0 ${
                            !notif.read ? 'bg-primary/[0.04]' : ''
                          }`}
                        >
                          <NotificationIcon type={notif.type} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTimeAgo(notif.createdAt, t)}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id) }}
                            className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <LanguageSwitcher />
            <ThemeToggle />
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8 animate-fade-in">
            <VerifyEmailBanner />
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}
