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
import { useLanguage } from "@/lib/i18n/language-context"

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

const fieldLabelKeys: Record<string, string> = {
  SMTP_HOST: "fieldSmtpHost",
  SMTP_PORT: "fieldSmtpPort",
  SMTP_USER: "fieldSmtpUser",
  SMTP_PASS: "fieldSmtpPass",
  SMTP_FROM: "fieldSmtpFrom",
  SMTP_REPLY_TO: "fieldSmtpReplyTo",
  FACEBOOK_APP_ID: "fieldFacebookAppId",
  FACEBOOK_APP_SECRET: "fieldFacebookAppSecret",
  FACEBOOK_REDIRECT_URI: "fieldFacebookRedirectUri",
  WEBHOOK_VERIFY_TOKEN: "fieldWebhookVerifyToken",
  INSTAGRAM_APP_ID: "fieldInstagramAppId",
  INSTAGRAM_APP_SECRET: "fieldInstagramAppSecret",
  INSTAGRAM_REDIRECT_URI: "fieldInstagramRedirectUri",
  ANTHROPIC_API_KEY: "fieldAnthropicApiKey",
}

// Admin panel section: edits platform-wide settings stored in the DB.
// Changes apply immediately — no server restart needed.
export function AdminSettings() {
  const { t } = useLanguage()
  const groupMeta: Record<string, { title: string; description: string; icon: React.ElementType }> = {
    mail: {
      title: t("platformSettingsPage.mailGroupTitle"),
      description: t("platformSettingsPage.mailGroupDesc"),
      icon: Mail,
    },
    meta: {
      title: t("platformSettingsPage.metaGroupTitle"),
      description: t("platformSettingsPage.metaGroupDesc"),
      icon: Webhook,
    },
    ai: {
      title: t("platformSettingsPage.aiGroupTitle"),
      description: t("platformSettingsPage.aiGroupDesc"),
      icon: Sparkles,
    },
  }
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
      setBanner({ type: "success", text: t("platformSettingsPage.savedSuccess") })
      fetchSettings()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBanner({ type: "error", text: axiosErr.response?.data?.message || t("platformSettingsPage.saveFailed") })
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
      setBanner({ type: "error", text: axiosErr.response?.data?.message || t("platformSettingsPage.testEmailFailed") })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
  }

  const groups: ("mail" | "meta" | "ai")[] = ["mail", "meta", "ai"]

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
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

      {/* Two-column grid on large screens so the settings tab uses the full
          page width instead of one narrow column; the mail card (5 fields)
          spans the full row, meta + AI share the second row. */}
      <div className="grid gap-6 xl:grid-cols-2 items-start">
      {groups.map(group => {
        const meta = groupMeta[group]
        const GroupIcon = meta.icon
        const groupSettings = settings.filter(s => s.group === group)
        return (
          <Card key={group} className={`border-none shadow-lg ${group === "mail" ? "xl:col-span-2" : ""}`}>
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
                    {fieldLabelKeys[setting.key] ? t(`platformSettingsPage.${fieldLabelKeys[setting.key]}`) : setting.label}
                    {setting.isSet && (
                      <Badge variant="outline" className="h-4 text-[9px] rounded gap-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {setting.source === "env" ? t("platformSettingsPage.fromEnvBadge") : t("platformSettingsPage.savedBadge")}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id={setting.key}
                    type={setting.secret ? "password" : "text"}
                    value={values[setting.key] ?? ""}
                    onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                    placeholder={setting.secret && setting.isSet ? t("platformSettingsPage.secretSetPlaceholder") : setting.placeholder}
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
      </div>

      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" className="rounded-xl gap-2 font-bold" disabled={isTesting} onClick={handleTestEmail}>
          {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("platformSettingsPage.testEmailBtn")}
        </Button>
        <Button className="rounded-xl gap-2 font-bold shadow-lg shadow-primary/20 px-8" disabled={isSaving} onClick={handleSave}>
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("platformSettingsPage.saveSettingsBtn")}
        </Button>
      </div>
    </div>
  )
}
