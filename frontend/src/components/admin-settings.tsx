"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Mail, Save, RefreshCw, CheckCircle2, AlertTriangle, X, Sparkles, Webhook, Send } from "lucide-react"
import api from "@/lib/api"

interface PlatformSetting {
  key: string
  label: string
  group: "mail" | "meta" | "ai"
  secret: boolean
  placeholder: string
  isSet: boolean
  source: "db" | "env" | null
  value: string | null
}

const groupMeta: Record<string, { title: string; description: string; icon: React.ElementType }> = {
  mail: {
    title: "البريد الإلكتروني (SMTP)",
    description: "تشغّل رسائل التفعيل واستعادة كلمة المرور والدعوات والنشرة. جرّب Resend أو أي مزود SMTP.",
    icon: Mail,
  },
  meta: {
    title: "تطبيق ميتا (فيسبوك)",
    description: "بيانات تطبيقك من developers.facebook.com — تشغّل زر الربط عبر فيسبوك والويبهوك.",
    icon: Webhook,
  },
  ai: {
    title: "الذكاء الاصطناعي",
    description: "مفتاح Anthropic لتشغيل الردود الذكية. يفعّلها كل مشترك من إعداداته الخاصة.",
    icon: Sparkles,
  },
}

// Admin panel section: edits platform-wide settings stored in the DB.
// Changes apply immediately — no server restart needed.
export function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await api.get("/admin/settings")
      setSettings(res.data)
      const initial: Record<string, string> = {}
      for (const s of res.data as PlatformSetting[]) {
        initial[s.key] = s.secret ? "" : (s.value || "")
      }
      setValues(initial)
    } catch (error) {
      console.error("Failed to fetch settings", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setBanner(null)
      // Send non-secret fields always; secrets only when the admin typed something
      const payload: Record<string, string> = {}
      for (const s of settings) {
        const typed = values[s.key] ?? ""
        if (s.secret) {
          if (typed.trim() !== "") payload[s.key] = typed.trim()
        } else {
          payload[s.key] = typed.trim()
        }
      }
      await api.put("/admin/settings", payload)
      setBanner({ type: "success", text: "تم حفظ الإعدادات — سارية فوراً بدون إعادة تشغيل." })
      fetchSettings()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBanner({ type: "error", text: axiosErr.response?.data?.message || "فشل حفظ الإعدادات." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestEmail = async () => {
    try {
      setIsTesting(true)
      setBanner(null)
      const res = await api.post("/admin/settings/test-email")
      setBanner({ type: res.data.sent ? "success" : "error", text: res.data.message })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBanner({ type: "error", text: axiosErr.response?.data?.message || "فشل إرسال رسالة الاختبار." })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
  }

  const groups: ("mail" | "meta" | "ai")[] = ["mail", "meta", "ai"]

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {banner && (
        <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold animate-fade-in ${
          banner.type === "success"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          {banner.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="p-1 hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {groups.map(group => {
        const meta = groupMeta[group]
        const GroupIcon = meta.icon
        const groupSettings = settings.filter(s => s.group === group)
        return (
          <Card key={group} className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <GroupIcon className="w-5 h-5 text-primary" />
                {meta.title}
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {groupSettings.map(setting => (
                <div key={setting.key} className="grid gap-1.5">
                  <Label htmlFor={setting.key} className="font-bold text-xs flex items-center gap-2">
                    {setting.label}
                    {setting.isSet && (
                      <Badge variant="outline" className="h-4 text-[9px] rounded gap-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {setting.source === "env" ? "من ملف البيئة" : "محفوظ"}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id={setting.key}
                    type={setting.secret ? "password" : "text"}
                    value={values[setting.key] ?? ""}
                    onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                    placeholder={setting.secret && setting.isSet ? "•••••••• (اتركه فارغاً للإبقاء عليه)" : setting.placeholder}
                    className="rounded-xl h-10 text-sm"
                    dir="ltr"
                    autoComplete="off"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" className="rounded-xl gap-2 font-bold" disabled={isTesting} onClick={handleTestEmail}>
          {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          اختبار البريد
        </Button>
        <Button className="rounded-xl gap-2 font-bold shadow-lg shadow-primary/20 px-8" disabled={isSaving} onClick={handleSave}>
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  )
}
