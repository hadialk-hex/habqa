"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import {
  ShieldCheck, Users, Building2, Share2, MessageSquareText, Inbox,
  RefreshCw, Trash2, Search, ScrollText, Zap, UserCheck, Ban, ChevronRight, ChevronLeft,
  Megaphone, Send, CheckCircle2, AlertTriangle, Crown, TrendingUp, Activity, BarChart3, Clock, Mail,
  Download, Wifi, Timer, Filter, Bell, Pencil, CalendarDays, Eye
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts"
import api from "@/lib/api"
import { AdminSettings } from "@/components/admin-settings"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

interface AdminStats {
  tenants: { total: number; suspended: number; byPlan: { plan: string; count: number }[] }
  users: { total: number; newLast30Days: number }
  connections: { total: number; active: number }
  rules: { total: number; active: number; triggeredLast7Days: number }
  inbox: { conversations: number; messages: number; messagesLast7Days: number }
  subscribers: { total: number }
  usage: {
    repliesThisMonth: number
    quotaSkippedThisMonth: number
    topTenants: { id: string; name: string; plan: string | null; repliesThisMonth: number }[]
  }
  recentUsers: { id: string; email: string; name: string | null; createdAt: string; tenantName: string | null; plan: string | null }[]
}

interface AdminTenant {
  id: string
  name: string
  plan: string
  isSuspended: boolean
  createdAt: string
  counts: { members: number; connections: number; rules: number; conversations: number; subscribers: number }
  owner: { email: string; name: string | null } | null
  usage: { repliesThisMonth: number; maxRepliesPerMonth: number; maxConnections: number }
}

interface AdminUser {
  id: string
  email: string
  name: string | null
  isSuperAdmin: boolean
  emailVerified: boolean
  createdAt: string
  tenants: { id: string; name: string; plan: string; role: string }[]
}

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  createdAt: string
  tenant: { name: string } | null
  user: { email: string; name: string | null } | null
}

const planColors: Record<string, { badge: string; dot: string; bg: string }> = {
  STARTER: {
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    bg: "from-slate-400 to-slate-500",
  },
  PRO: {
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    bg: "from-blue-500 to-cyan-500",
  },
  ENTERPRISE: {
    badge: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    dot: "bg-cyan-500",
    bg: "from-cyan-500 to-blue-500",
  },
}

const CHART_TEAL = "#4d9fff"
const CHART_TEAL_DIM = "#2f7fe0"
const CHART_COLORS = ["#4d9fff", "#22d3ee", "#10b981", "#fbbf24", "#a78bfa"]
const PIE_COLORS: Record<string, string> = { STARTER: "#64748b", PRO: "#4d9fff", ENTERPRISE: "#22d3ee" }

const formatDateRaw = (iso: string, localeCode: string) =>
  new Date(iso).toLocaleDateString(localeCode, { year: "numeric", month: "short", day: "numeric" })

// generateDailyRepliesData removed, using API

/* ─── CSV download helper ─── */
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  // Add BOM for Excel UTF-8 support
  const bom = "\uFEFF"
  const csv = bom + [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/* ─── Custom recharts tooltip ─── */
function ChartTooltip({ active, payload, label, localeCode, dir }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; localeCode?: string; dir?: "rtl" | "ltr" }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1117] border border-[#4d9fff]/30 rounded-xl px-4 py-2.5 shadow-xl shadow-[#4d9fff]/10" dir={dir || "rtl"}>
      <p className="text-xs text-[#9ca3af] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold text-[#4d9fff]">{p.value.toLocaleString(localeCode || "ar-EG")} {p.name}</p>
      ))}
    </div>
  )
}

/* ─── Animated counter hook ─── */
function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = prevTarget.current
    prevTarget.current = target
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + (target - start) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

/* ─── Single animated stat value ─── */
function AnimatedNumber({ value, localeCode }: { value: number; localeCode?: string }) {
  const display = useAnimatedCounter(value)
  return <>{display.toLocaleString(localeCode || "ar-EG")}</>
}

/* ─── Live monitoring indicator with tooltip ─── */
function LiveIndicator({ lastUpdate, localeCode, t }: { lastUpdate: Date; localeCode?: string; t: (path: string, vars?: Record<string, string | number>) => string }) {
  const timeStr = lastUpdate.toLocaleTimeString(localeCode || "ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex items-center gap-1 cursor-help" />}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4d9fff] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4d9fff]" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs font-bold">
          {t("adminPage.liveIndicatorLastUpdate", { time: timeStr })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/* ─── Date range type ─── */
type DateRange = "today" | "7days" | "30days" | "month"

export default function AdminPage() {
  const { t, tList, locale, dir } = useLanguage()
  const localeCode = locale === "ar" ? "ar-EG" : "en-US"
  const planLabels: Record<string, string> = {
    STARTER: t("adminPage.planFree"),
    PRO: t("adminPage.planPro"),
    ENTERPRISE: t("adminPage.planEnterprise"),
  }
  const formatDate = (iso: string) => formatDateRaw(iso, localeCode)
  const [mounted, setMounted] = useState(false)
  const confirm = useConfirm()
  const [stats, setStats] = useState<AdminStats | null>(null)

  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [tenantsTotal, setTenantsTotal] = useState(0)
  const [tenantsPage, setTenantsPage] = useState(1)
  const [tenantSearch, setTenantSearch] = useState("")
  const [tenantsLoading, setTenantsLoading] = useState(false)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [userSearch, setUserSearch] = useState("")
  const [usersLoading, setUsersLoading] = useState(false)

  const [annSubject, setAnnSubject] = useState("")
  const [annBody, setAnnBody] = useState("")
  const [annSending, setAnnSending] = useState(false)
  const [annResult, setAnnResult] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  /* ─── New state: date range filter ─── */
  const [dateRange, setDateRange] = useState<DateRange>("30days")

  /* ─── New state: auto-refresh ─── */
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ─── New state: audit log filters ─── */
  const [logActionFilter, setLogActionFilter] = useState<string>("ALL")
  const [logEntityFilter, setLogEntityFilter] = useState<string>("ALL")
  const [logEmailSearch, setLogEmailSearch] = useState("")

  /* ─── New state: system health ─── */
  const [apiHealthy, setApiHealthy] = useState(true)
  const [lastHealthCheck, setLastHealthCheck] = useState<Date>(new Date())
  const [uptimePercent] = useState(99.97)

  /* ─── State: last stats refresh time ─── */
  const [lastStatsRefresh, setLastStatsRefresh] = useState<Date>(new Date())

  /* ─── State: Tenant Detail Drawer ─── */
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  /* ─── State: Inline tenant name editing ─── */
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null)
  const [editingTenantName, setEditingTenantName] = useState("")

  /* ─── State: Tenant direct notification form ─── */
  const [tenantNotifTitle, setTenantNotifTitle] = useState("")
  const [tenantNotifMessage, setTenantNotifMessage] = useState("")
  const [tenantNotifSending, setTenantNotifSending] = useState(false)
  const [tenantNotifResult, setTenantNotifResult] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showNotifForm, setShowNotifForm] = useState(false)

  /* ─── State: Enhanced audit log — date range picker ─── */
  const [logDateFrom, setLogDateFrom] = useState("")
  const [logDateTo, setLogDateTo] = useState("")

  /* ─── State: Enhanced audit log — full text search ─── */
  const [logFullTextSearch, setLogFullTextSearch] = useState("")

  /* ─── Daily replies data from API ─── */
  const [dailyRepliesData, setDailyRepliesData] = useState<{ day: string; replies: number }[]>([])

  const pageSize = 20

  useEffect(() => { setMounted(true) }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/stats")
      setStats(res.data)
      setLastStatsRefresh(new Date())

      const dailyRes = await api.get("/admin/stats/daily-replies")
      setDailyRepliesData(dailyRes.data)
    } catch (error) {
      console.error("Failed to fetch stats", error)
    }
  }, [])

  const fetchTenants = useCallback(async (page: number, search: string) => {
    try {
      setTenantsLoading(true)
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set("search", search)
      const res = await api.get(`/admin/tenants?${params}`)
      setTenants(res.data.tenants)
      setTenantsTotal(res.data.total)
    } catch (error) {
      console.error("Failed to fetch tenants", error)
    } finally {
      setTenantsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (page: number, search: string) => {
    try {
      setUsersLoading(true)
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set("search", search)
      const res = await api.get(`/admin/users?${params}`)
      setUsers(res.data.users)
      setUsersTotal(res.data.total)
    } catch (error) {
      console.error("Failed to fetch users", error)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async (page: number) => {
    try {
      setLogsLoading(true)
      const res = await api.get(`/admin/audit-logs?page=${page}&pageSize=${pageSize}`)
      setLogs(res.data.logs)
      setLogsTotal(res.data.total)
    } catch (error) {
      console.error("Failed to fetch logs", error)
    } finally {
      setLogsLoading(false)
    }
  }, [])

  /* ─── Health check ─── */
  const checkHealth = useCallback(async () => {
    try {
      await api.get("/admin/stats")
      setApiHealthy(true)
    } catch {
      setApiHealthy(false)
    }
    setLastHealthCheck(new Date())
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchTenants(tenantsPage, tenantSearch) }, [fetchTenants, tenantsPage, tenantSearch])
  useEffect(() => { fetchUsers(usersPage, userSearch) }, [fetchUsers, usersPage, userSearch])
  useEffect(() => { fetchLogs(logsPage) }, [fetchLogs, logsPage])
  useEffect(() => { checkHealth() }, [checkHealth])

  /* ─── Auto-refresh logic ─── */
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        fetchStats()
        checkHealth()
      }, 30000)
    } else if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current)
      autoRefreshRef.current = null
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [autoRefresh, fetchStats, checkHealth])

  const handleTenantPlan = async (tenant: AdminTenant, plan: string) => {
    try {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, plan } : t))
      await api.put(`/admin/tenants/${tenant.id}`, { plan })
      // Also update selected tenant if in drawer
      if (selectedTenant?.id === tenant.id) {
        setSelectedTenant(prev => prev ? { ...prev, plan } : null)
      }
    } catch (error) {
      console.error("Failed to update plan", error)
      fetchTenants(tenantsPage, tenantSearch)
    }
  }

  const handleTenantSuspend = async (tenant: AdminTenant) => {
    try {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, isSuspended: !t.isSuspended } : t))
      await api.put(`/admin/tenants/${tenant.id}`, { isSuspended: !tenant.isSuspended })
      if (selectedTenant?.id === tenant.id) {
        setSelectedTenant(prev => prev ? { ...prev, isSuspended: !prev.isSuspended } : null)
      }
    } catch (error) {
      console.error("Failed to toggle suspension", error)
      fetchTenants(tenantsPage, tenantSearch)
    }
  }

  const handleTenantDelete = async (tenant: AdminTenant) => {
    const confirmed = await confirm({
      title: t("adminPage.deleteWorkspaceTitle"),
      message: t("adminPage.deleteWorkspaceMessage", { name: tenant.name }),
      variant: "destructive",
      confirmText: t("adminPage.confirmDelete"),
      cancelText: t("adminPage.cancel")
    })
    if (!confirmed) return
    try {
      await api.delete(`/admin/tenants/${tenant.id}`)
      if (selectedTenant?.id === tenant.id) {
        setDrawerOpen(false)
        setSelectedTenant(null)
      }
      fetchTenants(tenantsPage, tenantSearch)
      fetchStats()
    } catch (error) {
      console.error("Failed to delete tenant", error)
    }
  }

  const handleToggleAdmin = async (u: AdminUser) => {
    try {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isSuperAdmin: !x.isSuperAdmin } : x))
      await api.put(`/admin/users/${u.id}`, { isSuperAdmin: !u.isSuperAdmin })
    } catch (error) {
      console.error("Failed to toggle admin", error)
      fetchUsers(usersPage, userSearch)
    }
  }

  /* ─── User actions: verify email / reset password / delete ─── */
  const [userActionMsg, setUserActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleVerifyUserEmail = async (u: AdminUser) => {
    try {
      await api.post(`/admin/users/${u.id}/verify-email`)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, emailVerified: true } : x))
      setUserActionMsg({ type: "success", text: t("adminPage.userEmailVerifiedManually", { email: u.email }) })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setUserActionMsg({ type: "error", text: e.response?.data?.message || t("adminPage.userVerifyFailed") })
    }
  }

  const handleResetUserPassword = async (u: AdminUser) => {
    const confirmed = await confirm({
      title: t("adminPage.resetPasswordConfirmTitle"),
      message: t("adminPage.resetPasswordConfirmMessage", { email: u.email }),
      confirmText: t("adminPage.sendLink"),
      cancelText: t("adminPage.cancel"),
    })
    if (!confirmed) return
    try {
      const res = await api.post(`/admin/users/${u.id}/reset-password`)
      setUserActionMsg({ type: "success", text: res.data.message || t("adminPage.linkSent") })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setUserActionMsg({ type: "error", text: e.response?.data?.message || t("adminPage.linkSendFailed") })
    }
  }

  const handleDeleteUser = async (u: AdminUser) => {
    const confirmed = await confirm({
      title: t("adminPage.deleteUserTitle"),
      message: t("adminPage.deleteUserMessage", { name: u.name || u.email }),
      variant: "destructive",
      confirmText: t("adminPage.confirmDelete"),
      cancelText: t("adminPage.cancel"),
    })
    if (!confirmed) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      setUserActionMsg({ type: "success", text: t("adminPage.userDeleted", { email: u.email }) })
      fetchUsers(usersPage, userSearch)
      fetchStats()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setUserActionMsg({ type: "error", text: e.response?.data?.message || t("adminPage.userDeleteFailed") })
    }
  }

  /* ─── Email a tenant's owner from the drawer ─── */
  const [tenantEmailSubject, setTenantEmailSubject] = useState("")
  const [tenantEmailBody, setTenantEmailBody] = useState("")
  const [tenantEmailSending, setTenantEmailSending] = useState(false)
  const [tenantEmailResult, setTenantEmailResult] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)

  const handleEmailTenant = async () => {
    if (!selectedTenant || !tenantEmailSubject.trim() || !tenantEmailBody.trim()) return
    try {
      setTenantEmailSending(true)
      setTenantEmailResult(null)
      const res = await api.post(`/admin/tenants/${selectedTenant.id}/email`, {
        subject: tenantEmailSubject,
        body: tenantEmailBody,
      })
      setTenantEmailResult({ type: "success", text: res.data.message || t("adminPage.emailSent") })
      setTenantEmailSubject("")
      setTenantEmailBody("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setTenantEmailResult({ type: "error", text: e.response?.data?.message || t("adminPage.emailSendFailed") })
    } finally {
      setTenantEmailSending(false)
    }
  }

  /* ─── Inline tenant name edit ─── */
  const handleTenantNameDoubleClick = (tenant: AdminTenant) => {
    setEditingTenantId(tenant.id)
    setEditingTenantName(tenant.name)
  }

  const handleTenantNameSave = async (tenantId: string) => {
    const newName = editingTenantName.trim()
    if (!newName) {
      setEditingTenantId(null)
      return
    }
    try {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, name: newName } : t))
      if (selectedTenant?.id === tenantId) {
        setSelectedTenant(prev => prev ? { ...prev, name: newName } : null)
      }
      await api.put(`/admin/tenants/${tenantId}`, { name: newName })
    } catch (error) {
      console.error("Failed to update tenant name", error)
      fetchTenants(tenantsPage, tenantSearch)
    }
    setEditingTenantId(null)
  }

  /* ─── Send direct notification to tenant ─── */
  const handleSendTenantNotification = async () => {
    if (!selectedTenant || !tenantNotifTitle.trim() || !tenantNotifMessage.trim()) return
    try {
      setTenantNotifSending(true)
      setTenantNotifResult(null)
      await api.post(`/admin/tenants/${selectedTenant.id}/notify`, {
        title: tenantNotifTitle,
        message: tenantNotifMessage,
      })
      setTenantNotifResult({ type: "success", text: t("adminPage.notificationSentSuccess") })
      setTenantNotifTitle("")
      setTenantNotifMessage("")
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setTenantNotifResult({ type: "error", text: axiosErr.response?.data?.message || t("adminPage.notificationSendFailed") })
    } finally {
      setTenantNotifSending(false)
    }
  }

  /* ─── Open tenant detail drawer ─── */
  const openTenantDrawer = (tenant: AdminTenant) => {
    setSelectedTenant(tenant)
    setDrawerOpen(true)
    setShowNotifForm(false)
    setTenantNotifTitle("")
    setTenantNotifMessage("")
    setTenantNotifResult(null)
    setShowEmailForm(false)
    setTenantEmailSubject("")
    setTenantEmailBody("")
    setTenantEmailResult(null)
  }

  /* ─── CSV Export handlers ─── */
  const exportTenantsCSV = () => {
    const headers = tList("adminPage.csvTenantHeaders")
    const rows = tenants.map(tn => [
      tn.name, planLabels[tn.plan] || tn.plan, tn.isSuspended ? t("adminPage.suspended") : t("adminPage.active"),
      tn.owner?.email || "—", formatDate(tn.createdAt), String(tn.counts.members),
      String(tn.counts.connections), String(tn.counts.rules), String(tn.counts.conversations),
      String(tn.usage?.repliesThisMonth ?? 0)
    ])
    downloadCSV("tenants.csv", headers, rows)
  }

  const exportUsersCSV = () => {
    const headers = tList("adminPage.csvUserHeaders")
    const rows = users.map(u => [
      u.name || t("adminPage.noName"), u.email, u.isSuperAdmin ? t("adminPage.csvYes") : t("adminPage.csvNo"),
      formatDate(u.createdAt), u.tenants.map(tn => tn.name).join(" | ")
    ])
    downloadCSV("users.csv", headers, rows)
  }

  const exportLogsCSV = () => {
    const headers = tList("adminPage.csvLogHeaders")
    const rows = filteredLogs.map(l => [
      l.action, l.entityType, l.user?.email || "—",
      l.tenant?.name || "—", new Date(l.createdAt).toLocaleString(localeCode)
    ])
    downloadCSV("audit-logs.csv", headers, rows)
  }

  /* ─── Filtered logs (enhanced with date range + full text search + clickable action filter) ─── */
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logActionFilter !== "ALL" && log.action !== logActionFilter) return false
      if (logEntityFilter !== "ALL" && log.entityType !== logEntityFilter) return false
      if (logEmailSearch && !(log.user?.email || "").toLowerCase().includes(logEmailSearch.toLowerCase())) return false

      // Date range filter
      if (logDateFrom) {
        const logDate = new Date(log.createdAt)
        const fromDate = new Date(logDateFrom)
        fromDate.setHours(0, 0, 0, 0)
        if (logDate < fromDate) return false
      }
      if (logDateTo) {
        const logDate = new Date(log.createdAt)
        const toDate = new Date(logDateTo)
        toDate.setHours(23, 59, 59, 999)
        if (logDate > toDate) return false
      }

      // Full text search across all fields
      if (logFullTextSearch) {
        const searchLower = logFullTextSearch.toLowerCase()
        const searchFields = [
          log.action,
          log.entityType,
          log.user?.email || "",
          log.user?.name || "",
          log.tenant?.name || "",
          new Date(log.createdAt).toLocaleString("ar"),
        ]
        const matchesAny = searchFields.some(f => f.toLowerCase().includes(searchLower))
        if (!matchesAny) return false
      }

      return true
    })
  }, [logs, logActionFilter, logEntityFilter, logEmailSearch, logDateFrom, logDateTo, logFullTextSearch])

  /* ─── Unique entity types from logs ─── */
  const uniqueEntityTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.entityType))
    return Array.from(types)
  }, [logs])

  /* ─── Unique actions from logs (for clickable action badges) ─── */
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(l => l.action))
    return Array.from(actions)
  }, [logs])

  const statCards = stats ? [
    {
      title: t("adminPage.statTenants"), value: stats.tenants.total,
      sub: t("adminPage.statTenantsSub", { count: stats.tenants.suspended }), icon: Building2,
      gradient: "from-blue-500 to-cyan-500",
      bgGlow: "from-blue-500/20 to-cyan-500/5",
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    },
    {
      title: t("adminPage.statUsers"), value: stats.users.total,
      sub: t("adminPage.statUsersSub", { count: stats.users.newLast30Days }), icon: Users,
      gradient: "from-blue-500 to-cyan-600",
      bgGlow: "from-blue-500/20 to-cyan-500/5",
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
    },
    {
      title: t("adminPage.statConnections"), value: stats.connections.total,
      sub: t("adminPage.statConnectionsSub", { count: stats.connections.active }), icon: Share2,
      gradient: "from-emerald-500 to-green-600",
      bgGlow: "from-emerald-500/20 to-green-500/5",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    },
    {
      title: t("adminPage.statRules"), value: stats.rules.total,
      sub: t("adminPage.statRulesSub", { count: stats.rules.triggeredLast7Days }), icon: Zap,
      gradient: "from-amber-500 to-yellow-500",
      bgGlow: "from-amber-500/20 to-yellow-500/5",
      iconBg: "bg-gradient-to-br from-amber-500 to-yellow-500",
    },
    {
      title: t("adminPage.statRepliesMonth"), value: stats.usage?.repliesThisMonth ?? 0,
      sub: t("adminPage.statRepliesMonthSub", { count: stats.usage?.quotaSkippedThisMonth ?? 0 }), icon: MessageSquareText,
      gradient: "from-orange-500 to-amber-600",
      bgGlow: "from-orange-500/20 to-amber-500/5",
      iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    },
    {
      title: t("adminPage.statMessages"), value: stats.inbox.messages,
      sub: t("adminPage.statMessagesSub", { count: stats.inbox.messagesLast7Days }), icon: Inbox,
      gradient: "from-sky-500 to-blue-600",
      bgGlow: "from-sky-500/20 to-blue-500/5",
      iconBg: "bg-gradient-to-br from-sky-500 to-blue-600",
    },
  ] : []

  /* ─── Plan distribution total ─── */
  const planTotal = stats?.tenants.byPlan.reduce((s, p) => s + p.count, 0) || 1

  /* ─── Plan distribution pie data ─── */
  const planPieData = useMemo(() => {
    if (!stats) return []
    return stats.tenants.byPlan.map(p => ({
      name: planLabels[p.plan] || p.plan,
      value: p.count,
      plan: p.plan,
    }))
  }, [stats])

  /* ─── Top tenant bar chart data ─── */
  const topTenantBarData = useMemo(() => {
    if (!stats?.usage?.topTenants) return []
    return stats.usage.topTenants.map(t => ({
      name: t.name.length > 12 ? t.name.substring(0, 12) + "…" : t.name,
      replies: t.repliesThisMonth,
      plan: t.plan,
    }))
  }, [stats])

  /* ─── Top tenant max ─── */
  const topTenantMax = Math.max(1, ...(stats?.usage?.topTenants?.map(t => t.repliesThisMonth) ?? [1]))

  /* ─── Date range buttons ─── */
  const dateRangeButtons: { label: string; value: DateRange }[] = [
    { label: t("adminPage.rangeToday"), value: "today" },
    { label: t("adminPage.range7Days"), value: "7days" },
    { label: t("adminPage.range30Days"), value: "30days" },
    { label: t("adminPage.rangeMonth"), value: "month" },
  ]

  /* ─── Usage percent helper for drawer ─── */
  const getUsagePercent = (used: number, max: number) => {
    if (max === -1) return 100
    return Math.min(100, Math.round((used / Math.max(1, max)) * 100))
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Hero Header ─── */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-6 lg:p-8 border border-primary/15 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
        <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl -translate-x-1/3 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-56 h-56 bg-gradient-to-tl from-[#22d3ee]/10 to-transparent rounded-full blur-3xl translate-x-1/4 translate-y-1/3" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-primary to-[#22d3ee] p-3.5 rounded-2xl shadow-lg shadow-primary/30 animate-pulse-glow">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl font-black tracking-tight">
                  {t("adminPage.heroTitle1")} <span className="gradient-text">{t("adminPage.heroTitle2")}</span>
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{t("adminPage.live")}</span>
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm lg:text-base">{t("adminPage.heroSubtitle")}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {t("adminPage.lastUpdate")}: {lastStatsRefresh.toLocaleTimeString(localeCode, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={() => { fetchStats(); fetchTenants(tenantsPage, tenantSearch); fetchUsers(usersPage, userSearch); fetchLogs(logsPage); checkHealth() }}
              className="rounded-xl gap-2 h-10 font-bold border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              {t("adminPage.refreshNow")}
            </Button>
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">{t("adminPage.auto")}</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              {autoRefresh && (
                <span className="text-[10px] text-primary font-bold">{t("adminPage.autoRefreshInterval")}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex overflow-x-auto no-scrollbar md:grid md:grid-cols-6 w-full max-w-4xl mx-auto rounded-2xl h-auto md:h-13 p-1.5 bg-muted/70 backdrop-blur-sm gap-1 border border-border/40">
          <TabsTrigger value="overview" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <BarChart3 className="w-4 h-4" /> {t("adminPage.tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="tenants" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <Building2 className="w-4 h-4" /> {t("adminPage.tabTenants")}
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <Users className="w-4 h-4" /> {t("adminPage.tabUsers")}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <Megaphone className="w-4 h-4" /> {t("adminPage.tabAnnouncements")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <ShieldCheck className="w-4 h-4" /> {t("adminPage.tabSettings")}
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl font-bold gap-1.5 justify-center data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200 shrink-0">
            <ScrollText className="w-4 h-4" /> {t("adminPage.tabLogs")}
          </TabsTrigger>
        </TabsList>

        {/* ==================== Overview ==================== */}
        <TabsContent value="overview" className="pt-6 space-y-8">
          {!stats ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Date Range Filter + System Health ── */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-muted/50 border border-border/50">
                  {dateRangeButtons.map(btn => (
                    <button
                      key={btn.value}
                      onClick={() => setDateRange(btn.value)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                        dateRange === btn.value
                          ? "bg-[#4d9fff]/15 text-[#4d9fff] shadow-sm border border-[#4d9fff]/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* System Health Card */}
                <Card className="border-none shadow-lg bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-3 px-4 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground">{t("adminPage.apiStatus")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${apiHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                      <span className={`text-xs font-bold ${apiHealthy ? "text-emerald-500" : "text-red-500"}`}>
                        {apiHealthy ? t("adminPage.apiHealthy") : t("adminPage.apiUnhealthy")}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-border/50" />
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#4d9fff]" />
                      <span className="text-xs font-bold text-[#4d9fff]">{uptimePercent}%</span>
                      <span className="text-[10px] text-muted-foreground">{t("adminPage.uptime")}</span>
                    </div>
                    <div className="h-4 w-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lastHealthCheck.toLocaleTimeString(localeCode)}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* ── Stat Cards ── */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {statCards.map((card, index) => (
                  <Card
                    key={card.title}
                    className={`border-none shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 cursor-default relative overflow-hidden group ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                    style={{ animationDelay: `${(index + 1) * 100}ms` }}
                  >
                    {/* Background glow */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 relative z-10">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground">{card.title}</CardTitle>
                        {autoRefresh && <LiveIndicator lastUpdate={lastStatsRefresh} localeCode={localeCode} t={t} />}
                      </div>
                      <div className={`${card.iconBg} p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <card.icon className="w-5 h-5 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="text-4xl font-black tracking-tight">
                        <AnimatedNumber value={card.value} localeCode={localeCode} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-medium">{card.sub}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* ── Daily Replies LineChart ── */}
              <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-600' : 'opacity-0'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#4d9fff] to-[#0cc4a8]" />
                    <div className="flex-1">
                      <CardTitle className="text-lg font-black">{t("adminPage.dailyRepliesTitle")}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{t("adminPage.dailyRepliesSubtitle")}</CardDescription>
                    </div>
                    {autoRefresh && <LiveIndicator lastUpdate={lastStatsRefresh} localeCode={localeCode} t={t} />}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyRepliesData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                          width={40}
                        />
                        <RechartsTooltip content={<ChartTooltip localeCode={localeCode} dir={dir} />} />
                        <Line
                          type="monotone"
                          dataKey="replies"
                          name={t("adminPage.replyUnit")}
                          stroke={CHART_TEAL}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: CHART_TEAL, stroke: "#0a0a0f", strokeWidth: 2 }}
                          fill="url(#tealGradient)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* ── Bottom Row: Plan PieChart + Top Tenants BarChart + Recent Users ── */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Plan Distribution — PieChart (Donut) */}
                <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-700' : 'opacity-0'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                      <div>
                        <CardTitle className="text-lg font-black">{t("adminPage.planDistributionTitle")}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{t("adminPage.planDistributionSubtitle")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                            stroke="none"
                          >
                            {planPieData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={PIE_COLORS[entry.plan] || CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0]
                              return (
                                <div className="bg-[#0d1117] border border-[#4d9fff]/30 rounded-xl px-4 py-2.5 shadow-xl" dir={dir}>
                                  <p className="text-xs text-[#9ca3af] mb-0.5">{String(d.name)}</p>
                                  <p className="text-sm font-bold text-[#4d9fff]">{Number(d.value).toLocaleString(localeCode)} {t("adminPage.workspaceUnit")}</p>
                                </div>
                              )
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                      {planPieData.map((p) => (
                        <div key={p.plan} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[p.plan] || "#64748b" }} />
                          <span className="font-bold">{p.name}</span>
                          <span className="text-muted-foreground">({p.value})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Tenants — BarChart */}
                <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-800' : 'opacity-0'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
                      <div>
                        <CardTitle className="text-lg font-black">{t("adminPage.topActiveTitle")}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{t("adminPage.topActiveSubtitle")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(stats.usage?.topTenants?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("adminPage.noActivityThisMonth")}</p>
                    ) : (
                      <div className="h-[250px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topTenantBarData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                            <XAxis
                              type="number"
                              tick={{ fill: "#9ca3af", fontSize: 11 }}
                              tickLine={false}
                              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tick={{ fill: "#9ca3af", fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              width={90}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0]
                                return (
                                  <div className="bg-[#0d1117] border border-[#4d9fff]/30 rounded-xl px-4 py-2.5 shadow-xl" dir={dir}>
                                    <p className="text-sm font-bold text-[#4d9fff]">{Number(d.value).toLocaleString(localeCode)} {t("adminPage.replyUnit")}</p>
                                  </div>
                                )
                              }}
                            />
                            <Bar
                              dataKey="replies"
                              fill={CHART_TEAL}
                              radius={[0, 6, 6, 0]}
                              barSize={20}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Users */}
                <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-800' : 'opacity-0'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                      <div>
                        <CardTitle className="text-lg font-black">{t("adminPage.recentSignupsTitle")}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{t("adminPage.recentSignupsSubtitle")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(stats.recentUsers?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("adminPage.noUsersYet")}</p>
                    ) : (
                      stats.recentUsers.map((u, i) => {
                        const initials = (u.name || u.email).substring(0, 2).toUpperCase()
                        const avatarGradients = [
                          'from-blue-400 to-cyan-500', 'from-sky-400 to-blue-600',
                          'from-emerald-400 to-green-500', 'from-amber-400 to-orange-500',
                          'from-sky-400 to-blue-500',
                        ]
                        return (
                          <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 group">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                              <span className="text-white font-bold text-xs">{initials}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{u.name || u.email}</p>
                              <p className="text-[11px] text-muted-foreground truncate" dir="ltr">{u.email}</p>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(u.createdAt)}
                              </span>
                              {u.plan && (
                                <Badge variant="secondary" className={`text-[9px] h-4 border ${planColors[u.plan]?.badge || ''}`}>
                                  {planLabels[u.plan] || u.plan}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ==================== Tenants ==================== */}
        <TabsContent value="tenants" className="pt-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-gradient-to-b from-primary to-[oklch(0.62_0.15_230)]" />
                  <div>
                    <CardTitle className="text-lg font-black">{t("adminPage.tenantsTitle")}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{t("adminPage.tenantsSubtitle")}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-2 font-bold border-border/50 hover:bg-[#4d9fff]/10 hover:text-[#4d9fff] hover:border-[#4d9fff]/30 transition-all duration-200 cursor-pointer"
                    onClick={exportTenantsCSV}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("adminPage.exportCsv")}
                  </Button>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={tenantSearch}
                      onChange={e => { setTenantSearch(e.target.value); setTenantsPage(1) }}
                      placeholder={t("adminPage.searchByName")}
                      className="rounded-xl h-11 pr-10 bg-muted/50 border-border/50 focus:bg-background transition-colors duration-200"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">{t("adminPage.noResults")}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {tenants.map((tenant, idx) => (
                    <div
                      key={tenant.id}
                      className={`border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-4 transition-all duration-200 hover:shadow-md ${
                        tenant.isSuspended
                          ? 'opacity-70 bg-destructive/5 border-destructive/20 hover:bg-destructive/8'
                          : 'bg-card hover:bg-accent/30 border-border/50'
                      } ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Inline editable tenant name */}
                          {editingTenantId === tenant.id ? (
                            <Input
                              autoFocus
                              value={editingTenantName}
                              onChange={e => setEditingTenantName(e.target.value)}
                              onBlur={() => handleTenantNameSave(tenant.id)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleTenantNameSave(tenant.id)
                                if (e.key === "Escape") setEditingTenantId(null)
                              }}
                              className="h-8 w-48 rounded-lg text-sm font-black border-[#4d9fff]/50 bg-[#4d9fff]/5 focus:ring-[#4d9fff]/30"
                            />
                          ) : (
                            <span
                              className="font-black text-base cursor-pointer hover:text-[#4d9fff] transition-colors duration-200 group/name inline-flex items-center gap-1.5"
                              onDoubleClick={() => handleTenantNameDoubleClick(tenant)}
                              onClick={() => openTenantDrawer(tenant)}
                              title={t("adminPage.viewEditNameTitle")}
                            >
                              {tenant.name}
                              <Pencil className="w-3 h-3 opacity-0 group-hover/name:opacity-50 transition-opacity duration-200" />
                            </span>
                          )}
                          <Badge variant="secondary" className={`text-[10px] h-5 border font-bold ${planColors[tenant.plan]?.badge || ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${planColors[tenant.plan]?.dot || 'bg-slate-400'} inline-block mr-1`} />
                            {planLabels[tenant.plan] || tenant.plan}
                          </Badge>
                          {tenant.isSuspended && (
                            <Badge variant="outline" className="text-destructive border-destructive/40 gap-1 h-5 text-[10px]">
                              <Ban className="w-3 h-3" />
                              {t("adminPage.suspended")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 truncate">
                          {t("adminPage.ownerLabel")}: {tenant.owner?.email || "—"} · {t("adminPage.joinedLabel", { date: formatDate(tenant.createdAt) })}
                        </p>
                        <div className="flex gap-3 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{tenant.counts.members} {t("adminPage.memberUnit")}</span>
                          <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{tenant.counts.connections} {t("adminPage.channelUnit")}{tenant.usage?.maxConnections !== -1 ? ` ${t("adminPage.ofMax", { max: tenant.usage!.maxConnections })}` : ""}</span>
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{tenant.counts.rules} {t("adminPage.ruleUnit")}</span>
                          <span className="flex items-center gap-1"><MessageSquareText className="w-3 h-3" />{tenant.counts.conversations} {t("adminPage.conversationUnit")}</span>
                          <span className="flex items-center gap-1"><Inbox className="w-3 h-3" />{tenant.counts.subscribers} {t("adminPage.subscriberUnit")}</span>
                        </div>
                        {tenant.usage && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-2 rounded-full bg-muted/70 flex-1 max-w-[220px] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  tenant.usage.maxRepliesPerMonth !== -1 && tenant.usage.repliesThisMonth >= tenant.usage.maxRepliesPerMonth
                                    ? "bg-gradient-to-l from-red-500 to-destructive"
                                    : "bg-gradient-to-l from-cyan-400 to-primary"
                                }`}
                                style={{
                                  width: tenant.usage.maxRepliesPerMonth === -1
                                    ? "100%"
                                    : `${Math.min(100, (tenant.usage.repliesThisMonth / Math.max(1, tenant.usage.maxRepliesPerMonth)) * 100)}%`,
                                  opacity: tenant.usage.maxRepliesPerMonth === -1 ? 0.25 : 1,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                              {t("adminPage.repliesThisMonthOf", { used: tenant.usage.repliesThisMonth, max: tenant.usage.maxRepliesPerMonth !== -1 ? ` / ${tenant.usage.maxRepliesPerMonth}` : "" })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {/* View details button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5 text-xs font-bold border-border/50 hover:bg-[#4d9fff]/10 hover:text-[#4d9fff] hover:border-[#4d9fff]/30 transition-all duration-200 cursor-pointer"
                          onClick={() => openTenantDrawer(tenant)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t("adminPage.details")}
                        </Button>

                        <Select value={tenant.plan} onValueChange={(val) => val && handleTenantPlan(tenant, val)} items={{ STARTER: planLabels.STARTER, PRO: planLabels.PRO, ENTERPRISE: planLabels.ENTERPRISE }}>
                          <SelectTrigger className="rounded-xl h-9 w-[125px] text-xs font-bold border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="STARTER">{planLabels.STARTER}</SelectItem>
                            <SelectItem value="PRO">{planLabels.PRO}</SelectItem>
                            <SelectItem value="ENTERPRISE">{planLabels.ENTERPRISE}</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50">
                          <Switch checked={!tenant.isSuspended} onCheckedChange={() => handleTenantSuspend(tenant)} />
                          <span className="text-xs font-bold text-muted-foreground">{tenant.isSuspended ? t("adminPage.suspended") : t("adminPage.active")}</span>
                        </div>

                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 hover:scale-110" onClick={() => handleTenantDelete(tenant)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Pagination page={tenantsPage} total={tenantsTotal} pageSize={pageSize} onChange={setTenantsPage} />
            </CardContent>
          </Card>

          {/* ─── Tenant Detail Drawer (Sheet) ─── */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent side="left" className="!w-full sm:!max-w-lg overflow-y-auto p-0 bg-[#0d1117] border-[#4d9fff]/10" dir={dir}>
              {selectedTenant && (
                <>
                  <SheetHeader className="p-6 pb-4 border-b border-[#4d9fff]/10 bg-gradient-to-b from-[#4d9fff]/5 to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-[#4d9fff] to-[#4d9fff] p-3 rounded-xl shadow-lg shadow-[#4d9fff]/20">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SheetTitle className="text-xl font-black text-white truncate">{selectedTenant.name}</SheetTitle>
                        <SheetDescription className="text-xs text-[#9ca3af] mt-0.5">{t("adminPage.workspaceDetailsTitle")}</SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="p-6 space-y-6">
                    {/* ── Basic Info ── */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[#4d9fff] flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {t("adminPage.basicInfoTitle")}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <p className="text-[10px] text-[#9ca3af] mb-1">{t("adminPage.workspaceNameLabel")}</p>
                          <p className="text-sm font-bold text-white truncate">{selectedTenant.name}</p>
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <p className="text-[10px] text-[#9ca3af] mb-1">{t("adminPage.planLabel")}</p>
                          <Badge variant="secondary" className={`text-[10px] h-5 border font-bold ${planColors[selectedTenant.plan]?.badge || ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${planColors[selectedTenant.plan]?.dot || 'bg-slate-400'} inline-block mr-1`} />
                            {planLabels[selectedTenant.plan] || selectedTenant.plan}
                          </Badge>
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <p className="text-[10px] text-[#9ca3af] mb-1">{t("adminPage.ownerLabel")}</p>
                          <p className="text-sm font-bold text-white truncate" dir="ltr">{selectedTenant.owner?.email || "—"}</p>
                          {selectedTenant.owner?.name && (
                            <p className="text-[10px] text-[#9ca3af]">{selectedTenant.owner.name}</p>
                          )}
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <p className="text-[10px] text-[#9ca3af] mb-1">{t("adminPage.createdAtLabel")}</p>
                          <p className="text-sm font-bold text-white">{formatDate(selectedTenant.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Stats Grid ── */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[#4d9fff] flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {t("adminPage.statsTitle")}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <div className="flex items-center gap-2 mb-2">
                            <Share2 className="w-3.5 h-3.5 text-[#4d9fff]" />
                            <p className="text-[10px] text-[#9ca3af]">{t("adminPage.channelsLabel")}</p>
                          </div>
                          <p className="text-2xl font-black text-white">{selectedTenant.counts.connections}</p>
                          {selectedTenant.usage.maxConnections !== -1 && (
                            <p className="text-[10px] text-[#9ca3af] mt-0.5">{t("adminPage.ofMaxLimit", { max: selectedTenant.usage.maxConnections })}</p>
                          )}
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <p className="text-[10px] text-[#9ca3af]">{t("adminPage.rulesLabel")}</p>
                          </div>
                          <p className="text-2xl font-black text-white">{selectedTenant.counts.rules}</p>
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <div className="flex items-center gap-2 mb-2">
                            <Inbox className="w-3.5 h-3.5 text-emerald-400" />
                            <p className="text-[10px] text-[#9ca3af]">{t("adminPage.subscribersLabel")}</p>
                          </div>
                          <p className="text-2xl font-black text-white">{selectedTenant.counts.subscribers}</p>
                        </div>
                        <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquareText className="w-3.5 h-3.5 text-sky-400" />
                            <p className="text-[10px] text-[#9ca3af]">{t("adminPage.conversationsLabel")}</p>
                          </div>
                          <p className="text-2xl font-black text-white">{selectedTenant.counts.conversations}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Usage Stats with Progress Bars ── */}
                    {selectedTenant.usage && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-[#4d9fff] flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          {t("adminPage.usageThisMonthTitle")}
                        </h3>
                        <div className="bg-[#161b22] rounded-xl p-4 border border-[#30363d] space-y-4">
                          {/* Replies usage */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[#9ca3af]">{t("adminPage.autoRepliesLabel")}</span>
                              <span className="text-xs font-bold text-white">
                                {selectedTenant.usage.repliesThisMonth}
                                {selectedTenant.usage.maxRepliesPerMonth !== -1 ? ` / ${selectedTenant.usage.maxRepliesPerMonth}` : ` (${t("adminPage.unlimited")})`}
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-[#21262d] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  selectedTenant.usage.maxRepliesPerMonth !== -1 && selectedTenant.usage.repliesThisMonth >= selectedTenant.usage.maxRepliesPerMonth
                                    ? "bg-gradient-to-l from-red-500 to-orange-500"
                                    : "bg-gradient-to-l from-[#4d9fff] to-[#4d9fff]"
                                }`}
                                style={{
                                  width: `${getUsagePercent(selectedTenant.usage.repliesThisMonth, selectedTenant.usage.maxRepliesPerMonth)}%`,
                                  opacity: selectedTenant.usage.maxRepliesPerMonth === -1 ? 0.3 : 1,
                                }}
                              />
                            </div>
                            {selectedTenant.usage.maxRepliesPerMonth !== -1 && (
                              <p className="text-[10px] text-[#9ca3af] mt-1 text-left" dir="ltr">
                                {getUsagePercent(selectedTenant.usage.repliesThisMonth, selectedTenant.usage.maxRepliesPerMonth)}%
                              </p>
                            )}
                          </div>

                          {/* Connections usage */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-[#9ca3af]">{t("adminPage.connectedChannelsLabel")}</span>
                              <span className="text-xs font-bold text-white">
                                {selectedTenant.counts.connections}
                                {selectedTenant.usage.maxConnections !== -1 ? ` / ${selectedTenant.usage.maxConnections}` : ` (${t("adminPage.unlimited")})`}
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-[#21262d] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 bg-gradient-to-l from-[#4d9fff] to-[#22d3ee]"
                                style={{
                                  width: `${getUsagePercent(selectedTenant.counts.connections, selectedTenant.usage.maxConnections)}%`,
                                  opacity: selectedTenant.usage.maxConnections === -1 ? 0.3 : 1,
                                }}
                              />
                            </div>
                            {selectedTenant.usage.maxConnections !== -1 && (
                              <p className="text-[10px] text-[#9ca3af] mt-1 text-left" dir="ltr">
                                {getUsagePercent(selectedTenant.counts.connections, selectedTenant.usage.maxConnections)}%
                              </p>
                            )}
                          </div>

                          {/* Members */}
                          <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
                            <span className="text-xs text-[#9ca3af] flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              {t("adminPage.membersLabel")}
                            </span>
                            <span className="text-sm font-bold text-white">{selectedTenant.counts.members}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Quick Action Buttons ── */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-[#4d9fff] flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        {t("adminPage.quickActionsTitle")}
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                        {/* Change Plan */}
                        <div className="flex items-center gap-3 bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white flex-1">{t("adminPage.changePlan")}</span>
                          <Select value={selectedTenant.plan} onValueChange={(val) => val && handleTenantPlan(selectedTenant, val)} items={{ STARTER: planLabels.STARTER, PRO: planLabels.PRO, ENTERPRISE: planLabels.ENTERPRISE }}>
                            <SelectTrigger className="rounded-lg h-8 w-[110px] text-xs font-bold border-[#30363d] bg-[#0d1117]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STARTER">{planLabels.STARTER}</SelectItem>
                              <SelectItem value="PRO">{planLabels.PRO}</SelectItem>
                              <SelectItem value="ENTERPRISE">{planLabels.ENTERPRISE}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Suspend / Activate */}
                        <button
                          className={`flex items-center gap-3 rounded-xl p-3 border transition-all duration-200 w-full text-right cursor-pointer ${
                            selectedTenant.isSuspended
                              ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                              : "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                          }`}
                          onClick={() => handleTenantSuspend(selectedTenant)}
                        >
                          <Ban className={`w-4 h-4 ${selectedTenant.isSuspended ? "text-emerald-400" : "text-red-400"}`} />
                          <span className={`text-xs font-bold flex-1 ${selectedTenant.isSuspended ? "text-emerald-400" : "text-red-400"}`}>
                            {selectedTenant.isSuspended ? t("adminPage.reactivate") : t("adminPage.suspendWorkspace")}
                          </span>
                        </button>

                        {/* Send Notification */}
                        <button
                          className="flex items-center gap-3 bg-[#161b22] rounded-xl p-3 border border-[#30363d] hover:bg-[#4d9fff]/5 hover:border-[#4d9fff]/20 transition-all duration-200 w-full text-right cursor-pointer"
                          onClick={() => setShowNotifForm(!showNotifForm)}
                        >
                          <Bell className="w-4 h-4 text-[#4d9fff]" />
                          <span className="text-xs font-bold text-white flex-1">{t("adminPage.sendNotification")}</span>
                          <ChevronLeft className={`w-3.5 h-3.5 text-[#9ca3af] transition-transform duration-200 ${showNotifForm ? "-rotate-90" : ""}`} />
                        </button>

                        {/* Notification Form (collapsible) */}
                        {showNotifForm && (
                          <div className="bg-[#161b22] rounded-xl p-4 border border-[#4d9fff]/20 space-y-3 animate-fade-in">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#9ca3af]">{t("adminPage.notificationTitleLabel")}</label>
                              <Input
                                value={tenantNotifTitle}
                                onChange={e => setTenantNotifTitle(e.target.value)}
                                placeholder={t("adminPage.notificationTitlePlaceholder")}
                                className="rounded-lg h-9 text-xs bg-[#0d1117] border-[#30363d] text-white placeholder:text-[#484f58]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#9ca3af]">{t("adminPage.messageTextLabel")}</label>
                              <Textarea
                                value={tenantNotifMessage}
                                onChange={e => setTenantNotifMessage(e.target.value)}
                                placeholder={t("adminPage.notificationTextPlaceholder")}
                                className="rounded-lg min-h-[80px] text-xs bg-[#0d1117] border-[#30363d] text-white placeholder:text-[#484f58]"
                              />
                            </div>
                            {tenantNotifResult && (
                              <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-bold border ${
                                tenantNotifResult.type === "success"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}>
                                {tenantNotifResult.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                {tenantNotifResult.text}
                              </div>
                            )}
                            <Button
                              size="sm"
                              disabled={tenantNotifSending || !tenantNotifTitle.trim() || !tenantNotifMessage.trim()}
                              className="w-full rounded-lg gap-2 font-bold text-xs h-9 bg-gradient-to-r from-[#4d9fff] to-[#4d9fff] text-[#0d1117] hover:opacity-90 transition-all duration-200 cursor-pointer"
                              onClick={handleSendTenantNotification}
                            >
                              {tenantNotifSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              {t("adminPage.sendNotificationBtn")}
                            </Button>
                          </div>
                        )}

                        {/* Email the owner */}
                        <button
                          className="flex items-center gap-3 bg-[#161b22] rounded-xl p-3 border border-[#30363d] hover:bg-[#4d9fff]/5 hover:border-[#4d9fff]/20 transition-all duration-200 w-full text-right cursor-pointer"
                          onClick={() => setShowEmailForm(!showEmailForm)}
                        >
                          <Mail className="w-4 h-4 text-[#4d9fff]" />
                          <span className="text-xs font-bold text-white flex-1">{t("adminPage.emailOwner")}</span>
                          <ChevronLeft className={`w-3.5 h-3.5 text-[#9ca3af] transition-transform duration-200 ${showEmailForm ? "-rotate-90" : ""}`} />
                        </button>

                        {showEmailForm && (
                          <div className="bg-[#161b22] rounded-xl p-4 border border-[#4d9fff]/20 space-y-3 animate-fade-in">
                            <p className="text-[10px] text-[#9ca3af]">{t("adminPage.sendsTo")} <span dir="ltr" className="font-bold text-white">{selectedTenant.owner?.email || "—"}</span></p>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#9ca3af]">{t("adminPage.subjectLabel")}</label>
                              <Input
                                value={tenantEmailSubject}
                                onChange={e => setTenantEmailSubject(e.target.value)}
                                placeholder={t("adminPage.subjectPlaceholder")}
                                className="rounded-lg h-9 text-xs bg-[#0d1117] border-[#30363d] text-white placeholder:text-[#484f58]"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#9ca3af]">{t("adminPage.messageTextLabel")}</label>
                              <Textarea
                                value={tenantEmailBody}
                                onChange={e => setTenantEmailBody(e.target.value)}
                                placeholder={t("adminPage.emailBodyPlaceholder")}
                                className="rounded-lg min-h-[80px] text-xs bg-[#0d1117] border-[#30363d] text-white placeholder:text-[#484f58]"
                              />
                            </div>
                            {tenantEmailResult && (
                              <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-bold border ${
                                tenantEmailResult.type === "success"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}>
                                {tenantEmailResult.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                {tenantEmailResult.text}
                              </div>
                            )}
                            <Button
                              size="sm"
                              disabled={tenantEmailSending || !tenantEmailSubject.trim() || !tenantEmailBody.trim()}
                              className="w-full rounded-lg gap-2 font-bold text-xs h-9 bg-gradient-to-r from-[#4d9fff] to-[#22d3ee] text-[#0d1117] hover:opacity-90 transition-all duration-200 cursor-pointer"
                              onClick={handleEmailTenant}
                            >
                              {tenantEmailSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              {t("adminPage.sendEmailBtn")}
                            </Button>
                          </div>
                        )}

                        {/* Delete */}
                        <button
                          className="flex items-center gap-3 bg-red-500/5 rounded-xl p-3 border border-red-500/20 hover:bg-red-500/10 transition-all duration-200 w-full text-right cursor-pointer"
                          onClick={() => handleTenantDelete(selectedTenant)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-bold text-red-400 flex-1">{t("adminPage.deleteWorkspacePermanently")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ==================== Announcements ==================== */}
        <TabsContent value="announcements" className="pt-6">
          <Card className="border-none shadow-lg max-w-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 rounded-xl shadow-lg">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black">{t("adminPage.newsletterTitle")}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("adminPage.newsletterSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {t("adminPage.messageSubjectLabel")}
                </label>
                <Input
                  value={annSubject}
                  onChange={e => setAnnSubject(e.target.value)}
                  placeholder={t("adminPage.messageSubjectPlaceholder")}
                  className="rounded-xl h-11 font-bold bg-muted/30 border-border/50 focus:bg-background transition-colors duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">{t("adminPage.messageContentLabel")}</label>
                <Textarea
                  value={annBody}
                  onChange={e => setAnnBody(e.target.value)}
                  placeholder={t("adminPage.messageContentPlaceholder")}
                  className="rounded-xl min-h-[200px] leading-relaxed bg-muted/30 border-border/50 focus:bg-background transition-colors duration-200"
                />
              </div>
              {annResult && (
                <div className={`flex items-center gap-2.5 p-4 rounded-xl text-sm font-bold border ${
                  annResult.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  {annResult.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                  {annResult.text}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button
                  disabled={annSending || !annSubject.trim() || !annBody.trim()}
                  className="rounded-xl gap-2.5 font-bold shadow-lg shadow-primary/20 px-8 h-11 text-sm hover:scale-105 transition-all duration-200 cursor-pointer"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: t("adminPage.sendNewsletterTitle"),
                      message: t("adminPage.sendNewsletterMessage"),
                      variant: "primary",
                      confirmText: t("adminPage.send"),
                      cancelText: t("adminPage.cancel")
                    })
                    if (!confirmed) return
                    try {
                      setAnnSending(true)
                      setAnnResult(null)
                      const res = await api.post("/admin/announcements", { subject: annSubject, body: annBody })
                      setAnnResult({ type: "success", text: t("adminPage.sendResultSuccess", { sent: res.data.sent, total: res.data.total, failedNote: res.data.failed ? t("adminPage.sendResultFailedNote", { count: res.data.failed }) : "" }) })
                      setAnnSubject("")
                      setAnnBody("")
                    } catch (err: unknown) {
                      const axiosErr = err as { response?: { data?: { message?: string } } }
                      setAnnResult({ type: "error", text: axiosErr.response?.data?.message || t("adminPage.sendNewsletterFailed") })
                    } finally {
                      setAnnSending(false)
                    }
                  }}
                >
                  {annSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t("adminPage.sendToAll")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Platform Settings ==================== */}
        <TabsContent value="settings" className="pt-6">
          <AdminSettings />
        </TabsContent>

        {/* ==================== Users ==================== */}
        <TabsContent value="users" className="pt-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                  <div>
                    <CardTitle className="text-lg font-black">{t("adminPage.usersTitle")}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{t("adminPage.usersSubtitle")}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-2 font-bold border-border/50 hover:bg-[#4d9fff]/10 hover:text-[#4d9fff] hover:border-[#4d9fff]/30 transition-all duration-200 cursor-pointer"
                    onClick={exportUsersCSV}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("adminPage.exportCsv")}
                  </Button>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); setUsersPage(1) }}
                      placeholder={t("adminPage.searchByNameOrEmail")}
                      className="rounded-xl h-11 pr-10 bg-muted/50 border-border/50 focus:bg-background transition-colors duration-200"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {userActionMsg && (
                <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border ${
                  userActionMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                }`}>
                  {userActionMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {userActionMsg.text}
                  <button onClick={() => setUserActionMsg(null)} className="mr-auto text-xs opacity-60 hover:opacity-100 cursor-pointer">{t("adminPage.close")}</button>
                </div>
              )}
              {usersLoading ? (
                <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
              ) : users.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">{t("adminPage.noResults")}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {users.map((u, idx) => {
                    const initials = (u.name || u.email).substring(0, 2).toUpperCase()
                    return (
                      <div
                        key={u.id}
                        className={`group border border-border/50 rounded-2xl p-4 bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                              u.isSuperAdmin
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                                : 'bg-gradient-to-br from-primary/60 to-primary'
                            }`}>
                              {u.isSuperAdmin ? (
                                <Crown className="w-5 h-5 text-white" />
                              ) : (
                                <span className="text-white font-bold text-sm">{initials}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black">{u.name || t("adminPage.noName")}</span>
                                {u.isSuperAdmin && (
                                  <Badge className="gap-1 h-5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white">
                                    <ShieldCheck className="w-3 h-3" />
                                    {t("adminPage.platformAdmin")}
                                  </Badge>
                                )}
                                {u.emailVerified ? (
                                  <Badge className="gap-1 h-5 text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {t("adminPage.emailVerified")}
                                  </Badge>
                                ) : (
                                  <Badge className="gap-1 h-5 text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                    <AlertTriangle className="w-3 h-3" />
                                    {t("adminPage.emailNotVerified")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">{u.email}</p>
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {u.tenants.map(tn => (
                                  <Badge key={tn.id} variant="secondary" className={`text-[10px] h-5 rounded-lg border ${planColors[tn.plan]?.badge || ''}`}>
                                    {tn.name} · {tn.role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Control cluster */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/40">
                              <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-[11px] font-bold text-muted-foreground">{t("adminPage.admin")}</span>
                              <Switch checked={u.isSuperAdmin} onCheckedChange={() => handleToggleAdmin(u)} />
                            </div>
                            {!u.emailVerified && (
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleVerifyUserEmail(u)}
                                className="rounded-xl gap-1.5 h-9 font-bold text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t("adminPage.verifyEmail")}
                              </Button>
                            )}
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleResetUserPassword(u)}
                              className="rounded-xl gap-1.5 h-9 font-bold text-xs border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              {t("adminPage.resetPassword")}
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleDeleteUser(u)}
                              className="rounded-xl gap-1.5 h-9 font-bold text-xs border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t("adminPage.delete")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <Pagination page={usersPage} total={usersTotal} pageSize={pageSize} onChange={setUsersPage} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Audit Logs ==================== */}
        <TabsContent value="logs" className="pt-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-slate-500 to-gray-600 p-2.5 rounded-xl shadow-lg">
                      <ScrollText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black">{t("adminPage.logsTitle")}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{t("adminPage.logsSubtitle")}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-2 font-bold border-border/50 hover:bg-[#4d9fff]/10 hover:text-[#4d9fff] hover:border-[#4d9fff]/30 transition-all duration-200 cursor-pointer"
                      onClick={exportLogsCSV}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t("adminPage.exportCsv")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-2 font-bold border-border/50 hover:bg-accent hover:scale-105 transition-all duration-200"
                      onClick={() => fetchLogs(logsPage)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {t("adminPage.refresh")}
                    </Button>
                  </div>
                </div>

                {/* ── Date Range Picker ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-[#4d9fff]/5 border border-[#4d9fff]/10">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#4d9fff] shrink-0">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {t("adminPage.dateRangeLabel")}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold">{t("adminPage.from")}</span>
                      <Input
                        type="date"
                        value={logDateFrom}
                        onChange={e => setLogDateFrom(e.target.value)}
                        className="rounded-lg h-8 w-[150px] text-xs bg-background border-border/50"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold">{t("adminPage.to")}</span>
                      <Input
                        type="date"
                        value={logDateTo}
                        onChange={e => setLogDateTo(e.target.value)}
                        className="rounded-lg h-8 w-[150px] text-xs bg-background border-border/50"
                      />
                    </div>
                    {(logDateFrom || logDateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-bold text-[#4d9fff] hover:bg-[#4d9fff]/10 rounded-lg cursor-pointer"
                        onClick={() => { setLogDateFrom(""); setLogDateTo("") }}
                      >
                        {t("adminPage.clear")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* ── Full Text Search ── */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={logFullTextSearch}
                    onChange={e => setLogFullTextSearch(e.target.value)}
                    placeholder={t("adminPage.fullTextSearchPlaceholder")}
                    className="rounded-xl h-10 pr-10 bg-muted/30 border-border/50 focus:bg-background transition-colors duration-200"
                  />
                </div>

                {/* ── Clickable Action Badges (quick filter) ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground">{t("adminPage.filterByAction")}</span>
                  <button
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer border ${
                      logActionFilter === "ALL"
                        ? "bg-[#4d9fff]/15 text-[#4d9fff] border-[#4d9fff]/30"
                        : "bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50"
                    }`}
                    onClick={() => setLogActionFilter("ALL")}
                  >
                    {t("adminPage.all")}
                  </button>
                  {uniqueActions.map(action => {
                    const actionBadgeColors: Record<string, string> = {
                      CREATE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                      UPDATE: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                      DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
                    }
                    const isActive = logActionFilter === action
                    return (
                      <button
                        key={action}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer border ${
                          isActive
                            ? (actionBadgeColors[action] || "bg-[#4d9fff]/15 text-[#4d9fff] border-[#4d9fff]/30")
                            : "bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50"
                        }`}
                        onClick={() => setLogActionFilter(isActive ? "ALL" : action)}
                      >
                        {action}
                      </button>
                    )
                  })}
                </div>

                {/* ── Existing Filters Row ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground shrink-0">
                    <Filter className="w-3.5 h-3.5" />
                    {t("adminPage.filter")}
                  </div>
                  <Select
                    value={logActionFilter}
                    onValueChange={(v) => v && setLogActionFilter(v)}
                    items={{ ALL: t("adminPage.allActions"), CREATE: t("adminPage.actionCreate"), UPDATE: t("adminPage.actionUpdate"), DELETE: t("adminPage.actionDelete") }}
                  >
                    <SelectTrigger className="rounded-xl h-9 w-[140px] text-xs font-bold border-border/50">
                      <SelectValue placeholder={t("adminPage.actionTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t("adminPage.allActions")}</SelectItem>
                      <SelectItem value="CREATE">{t("adminPage.actionCreate")}</SelectItem>
                      <SelectItem value="UPDATE">{t("adminPage.actionUpdate")}</SelectItem>
                      <SelectItem value="DELETE">{t("adminPage.actionDelete")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={logEntityFilter}
                    onValueChange={(v) => v && setLogEntityFilter(v)}
                    items={{ ALL: t("adminPage.allEntities"), ...Object.fromEntries(uniqueEntityTypes.map(et => [et, et])) }}
                  >
                    <SelectTrigger className="rounded-xl h-9 w-[160px] text-xs font-bold border-border/50">
                      <SelectValue placeholder={t("adminPage.entityTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t("adminPage.allEntities")}</SelectItem>
                      {uniqueEntityTypes.map(et => (
                        <SelectItem key={et} value={et}>{et}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={logEmailSearch}
                      onChange={e => setLogEmailSearch(e.target.value)}
                      placeholder={t("adminPage.searchByEmail")}
                      className="rounded-xl h-9 pr-9 text-xs bg-background border-border/50 focus:bg-background"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-16">
                  <ScrollText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">{t("adminPage.noLogsYet")}</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredLogs.map((log, idx) => {
                    const actionColors: Record<string, string> = {
                      CREATE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                      DELETE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                    }
                    const colorClass = actionColors[log.action] || "bg-muted text-muted-foreground border-border/50"
                    return (
                      <div
                        key={log.id}
                        className={`flex items-center gap-3 border border-border/40 rounded-xl px-4 py-3.5 text-sm bg-card hover:bg-accent/30 hover:shadow-sm transition-all duration-200 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        {/* Clickable action badge */}
                        <Badge
                          variant="outline"
                          className={`rounded-lg text-[10px] font-bold shrink-0 border cursor-pointer hover:scale-110 transition-transform duration-200 ${colorClass}`}
                          dir="ltr"
                          onClick={() => setLogActionFilter(logActionFilter === log.action ? "ALL" : log.action)}
                        >
                          {log.action}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground text-xs truncate block">
                            {log.entityType}
                            {log.tenant?.name ? ` · ${log.tenant.name}` : ""}
                          </span>
                          {log.user?.email && (
                            <span className="text-[11px] text-muted-foreground/70" dir="ltr">{log.user.email}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleString(localeCode)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <Pagination page={logsPage} total={logsTotal} pageSize={pageSize} onChange={setLogsPage} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Pagination component extracted to the file level to avoid ESLint warnings
interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}

function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const { t } = useLanguage()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between pt-5 border-t border-border/50 mt-2">
      <span className="text-xs text-muted-foreground font-medium">
        {t("adminPage.pageOf", { page, total: totalPages, count: total })}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs font-bold cursor-pointer"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5 ml-1" />
          {t("adminPage.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs font-bold cursor-pointer"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          {t("adminPage.next")}
          <ChevronRight className="w-3.5 h-3.5 mr-1" />
        </Button>
      </div>
    </div>
  )
}
