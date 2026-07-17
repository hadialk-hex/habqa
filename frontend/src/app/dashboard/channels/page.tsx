"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Trash2, ShieldCheck, RefreshCw, MessageCircle, Share2, WifiOff,
  CheckCircle2, AlertTriangle, X, ExternalLink, Zap, ArrowLeft,
  MessageSquare, Radio, Users, BookOpen, Heart, Film, UserPlus, Send, Info,
  Webhook, Wrench, QrCode, Copy, Download
} from "lucide-react"
import QRCode from "qrcode"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

interface Channel {
  id: string
  platform: string
  platformId: string
  name: string
  isActive: boolean
}

interface FeatureBadge {
  icon: React.ElementType
  label: string
}

function FeatureBadgeList({ features, accentColor }: { features: FeatureBadge[]; accentColor: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5">
      {features.map((f) => {
        const Icon = f.icon
        return (
          <span
            key={f.label}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${accentColor}`}
          >
            <Icon className="w-3 h-3" />
            {f.label}
          </span>
        )
      })}
    </div>
  )
}

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsContent />
    </Suspense>
  )
}

function ChannelsContent() {
  const { t, dir } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()

  const platformConfig: Record<string, { icon: React.ElementType; color: string; bg: string; gradient: string; gradientBg: string; label: string }> = {
    FACEBOOK_PAGE: {
      icon: FacebookIcon,
      color: "text-[#1877F2]",
      bg: "bg-[#1877F2]/10",
      gradient: "from-[#1877F2] to-[#0d5cbf]",
      gradientBg: "from-[#1877F2]/20 via-[#1877F2]/5 to-transparent",
      label: t("channelsPage.facebookPageLabel"),
    },
    INSTAGRAM: {
      icon: InstagramIcon,
      color: "text-[#E1306C]",
      bg: "bg-[#E1306C]/10",
      gradient: "from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
      gradientBg: "from-[#E1306C]/20 via-[#E1306C]/5 to-transparent",
      label: t("channelsPage.instagramLabel"),
    },
    WHATSAPP: {
      icon: WhatsAppIcon,
      color: "text-[#25D366]",
      bg: "bg-[#25D366]/10",
      gradient: "from-[#25D366] to-[#128C7E]",
      gradientBg: "from-[#25D366]/20 via-[#25D366]/5 to-transparent",
      label: t("channelsPage.whatsappLabel"),
    },
  }

  const fbFeatures: FeatureBadge[] = [
    { icon: MessageSquare, label: t("channelsPage.featureCommentToMessage") },
    { icon: MessageCircle, label: t("channelsPage.featureAutoReply") },
    { icon: Radio, label: t("channelsPage.featureBroadcast") },
  ]

  const waFeatures: FeatureBadge[] = [
    { icon: MessageCircle, label: t("channelsPage.featureAutoReply") },
    { icon: Radio, label: t("channelsPage.featureBroadcast") },
    { icon: BookOpen, label: t("channelsPage.featureCatalog") },
  ]

  const igFeatures: FeatureBadge[] = [
    { icon: Send, label: t("channelsPage.featureDmAutomation") },
    { icon: Heart, label: t("channelsPage.featureStoryMention") },
    { icon: Film, label: t("channelsPage.featureReelsComments") },
    { icon: UserPlus, label: t("channelsPage.featureFollowWelcome") },
  ]

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnectingFb, setIsConnectingFb] = useState(false)
  const [isConnectingIg, setIsConnectingIg] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Webhook diagnostics per channel: did Facebook actually register our app
  // on this page with the "messages" field? (The reason messages do/don't
  // reach the inbox.)
  interface WebhookState {
    loading?: boolean
    fixing?: boolean
    subscribed?: boolean
    hasMessagesField?: boolean
    error?: string
  }
  const [webhookStatus, setWebhookStatus] = useState<Record<string, WebhookState>>({})

  // Growth tool: m.me deep link + QR code per Facebook page (ManyChat-style
  // "ref URL" entry point customers can scan/click to start a conversation).
  const [growthTarget, setGrowthTarget] = useState<Channel | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const growthLink = growthTarget ? `https://m.me/${growthTarget.platformId}` : ""

  useEffect(() => {
    if (!growthTarget) { setQrDataUrl(""); return }
    QRCode.toDataURL(`https://m.me/${growthTarget.platformId}`, {
      width: 480, margin: 2,
      color: { dark: "#0a0a0f", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""))
  }, [growthTarget])

  const copyGrowthLink = async () => {
    try {
      await navigator.clipboard.writeText(growthLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const checkWebhook = async (channelId: string) => {
    setWebhookStatus(prev => ({ ...prev, [channelId]: { loading: true } }))
    try {
      const res = await api.get(`/channels/${channelId}/webhook-status`)
      setWebhookStatus(prev => ({ ...prev, [channelId]: res.data }))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setWebhookStatus(prev => ({
        ...prev,
        [channelId]: { error: axiosErr.response?.data?.message || t("channelsPage.webhookCheckFailed") },
      }))
    }
  }

  const fixWebhook = async (channelId: string) => {
    setWebhookStatus(prev => ({ ...prev, [channelId]: { ...prev[channelId], fixing: true } }))
    try {
      await api.post(`/channels/${channelId}/webhook-subscribe`)
      await checkWebhook(channelId)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setWebhookStatus(prev => ({
        ...prev,
        [channelId]: { error: axiosErr.response?.data?.message || t("channelsPage.webhookFixFailed") },
      }))
    }
  }
  const [waDialog, setWaDialog] = useState(false)
  const [waStep, setWaStep] = useState(1)
  const [waName, setWaName] = useState("")
  const [waPhoneId, setWaPhoneId] = useState("")
  const [waToken, setWaToken] = useState("")
  const [waSubmitting, setWaSubmitting] = useState(false)

  // Show the OAuth result banner when returning from Facebook
  useEffect(() => {
    const connected = searchParams.get("connected")
    if (!connected) return
    if (connected === "success") {
      const count = searchParams.get("count") || "0"
      const skipped = Number(searchParams.get("skipped") || "0")
      setBanner({
        type: "success",
        text: t("channelsPage.connectedSuccessBanner", { count, skippedNote: skipped > 0 ? t("channelsPage.connectedSkippedNote", { count: skipped }) : "" }),
      })
    } else {
      setBanner({ type: "error", text: t("channelsPage.facebookConnectFailedBanner") })
    }
    router.replace("/dashboard/channels")
     
  }, [searchParams])

  const handleConnectFacebook = async () => {
    try {
      setIsConnectingFb(true)
      const res = await api.get("/channels/facebook/connect-url")
      if (res.data.configured && res.data.url) {
        window.location.href = res.data.url
      } else {
        setBanner({ type: "error", text: res.data.message || t("channelsPage.facebookNotConfigured") })
        setIsConnectingFb(false)
      }
    } catch {
      setBanner({ type: "error", text: t("channelsPage.connectStartFailed") })
      setIsConnectingFb(false)
    }
  }

  // Standalone Instagram Business Login — the user signs in with their
  // Instagram professional account directly, no Facebook account needed.
  // Falls back to the Facebook OAuth flow when the standalone app isn't
  // configured (accounts linked to a Facebook page still work that way).
  const handleConnectInstagram = async () => {
    try {
      setIsConnectingIg(true)
      const res = await api.get("/channels/instagram/connect-url")
      if (res.data.configured && res.data.url) {
        window.location.href = res.data.url
        return
      }
      const fb = await api.get("/channels/facebook/connect-url")
      if (fb.data.configured && fb.data.url) {
        window.location.href = fb.data.url
        return
      }
      setBanner({ type: "error", text: res.data.message || t("channelsPage.instagramNotConfigured") })
      setIsConnectingIg(false)
    } catch {
      setBanner({ type: "error", text: t("channelsPage.connectStartFailed") })
      setIsConnectingIg(false)
    }
  }

  const fetchChannels = async () => {
    try {
      setIsLoading(true)
      const res = await api.get("/channels")
      setChannels(res.data)
    } catch (error) {
      console.error("Failed to fetch channels", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [])

  const handleDeleteChannel = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await api.delete(`/channels/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchChannels()
      setBanner({ type: "success", text: t("channelsPage.disconnectSuccess") })
    } catch (error) {
      console.error("Failed to delete", error)
      setBanner({ type: "error", text: t("channelsPage.disconnectFailed") })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConnectWhatsApp = async () => {
    try {
      setWaSubmitting(true)
      await api.post("/channels", {
        platform: "WHATSAPP",
        name: waName || t("channelsPage.whatsappDefaultName"),
        platformId: waPhoneId,
        accessToken: waToken,
      })
      setWaDialog(false)
      setWaStep(1)
      setWaName("")
      setWaPhoneId("")
      setWaToken("")
      fetchChannels()
      setBanner({ type: "success", text: t("channelsPage.whatsappConnectSuccess") })
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } }
      setBanner({
        type: "error",
        text: axiosErr.response?.data?.message || t("channelsPage.whatsappConnectFailed"),
      })
    } finally {
      setWaSubmitting(false)
    }
  }

  const fbChannels = channels.filter(c => c.platform === "FACEBOOK_PAGE")
  const igChannels = channels.filter(c => c.platform === "INSTAGRAM")
  const waChannels = channels.filter(c => c.platform === "WHATSAPP")

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          {t("channelsPage.title")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("channelsPage.subtitle")}</p>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold animate-fade-in-up ${
          banner.type === "success"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          {banner.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="p-1 hover:opacity-70 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-60">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              </div>
            </div>
            <span className="text-sm text-muted-foreground font-medium">{t("channelsPage.loadingChannels")}</span>
          </div>
        </div>
      ) : (
        <>
          {/* Platform Connect Cards */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* ───────── Facebook Connect Card ───────── */}
            <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className={`absolute inset-0 bg-gradient-to-br ${platformConfig.FACEBOOK_PAGE.gradientBg} opacity-50`} />
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${platformConfig.FACEBOOK_PAGE.gradient}`} />
              <CardContent className="relative p-5 sm:p-6 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                    <FacebookIcon className="w-7 h-7 text-[#1877F2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">{t("channelsPage.facebookCardTitle")}</h3>
                    <p className="text-sm text-muted-foreground truncate">{t("channelsPage.facebookCardSubtitle")}</p>
                  </div>
                </div>

                {/* Feature Badges */}
                <FeatureBadgeList
                  features={fbFeatures}
                  accentColor="bg-[#1877F2]/5 text-[#1877F2] border-[#1877F2]/20"
                />

                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {t("channelsPage.facebookCardDesc")}
                </p>

                <div className="mt-auto">
                  {fbChannels.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        {t("channelsPage.pagesConnected", { count: fbChannels.length })}
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleConnectFacebook}
                    disabled={isConnectingFb}
                    className="w-full gap-2 rounded-xl h-12 font-bold bg-[#1877F2] hover:bg-[#0d5cbf] text-white shadow-lg shadow-[#1877F2]/25 transition-all hover:shadow-xl"
                  >
                    {isConnectingFb ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FacebookIcon className="w-5 h-5" />
                    )}
                    {fbChannels.length > 0 ? t("channelsPage.connectMorePages") : t("channelsPage.connectFacebookAccount")}
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ───────── Instagram Connect Card (Independent Design) ───────── */}
            <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-300 group">
              {/* Instagram multi-gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#F58529]/15 via-[#DD2A7B]/10 to-[#8134AF]/15 opacity-60" />
              {/* Top bar with Instagram brand gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#F58529] via-[#DD2A7B] to-[#8134AF]" />
              {/* Corner glow accent */}
              <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-[#DD2A7B]/10 blur-2xl group-hover:bg-[#DD2A7B]/20 transition-all duration-500" />
              <CardContent className="relative p-5 sm:p-6 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/20 to-[#8134AF]/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0 ring-1 ring-[#DD2A7B]/20">
                    <InstagramIcon className="w-7 h-7 text-[#DD2A7B]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg bg-gradient-to-l from-[#F58529] via-[#DD2A7B] to-[#8134AF] bg-clip-text text-transparent">{t("channelsPage.instagramCardTitle")}</h3>
                    <p className="text-sm text-muted-foreground truncate">{t("channelsPage.instagramCardSubtitle")}</p>
                  </div>
                </div>

                {/* Instagram Feature Badges */}
                <FeatureBadgeList
                  features={igFeatures}
                  accentColor="bg-[#DD2A7B]/5 text-[#DD2A7B] border-[#DD2A7B]/20"
                />

                {/* Instagram Features List */}
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Send className="w-3.5 h-3.5 text-[#DD2A7B] shrink-0" />
                    <span>{t("channelsPage.igFeatureDm")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Heart className="w-3.5 h-3.5 text-[#DD2A7B] shrink-0" />
                    <span>{t("channelsPage.igFeatureStoryMention")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Film className="w-3.5 h-3.5 text-[#DD2A7B] shrink-0" />
                    <span>{t("channelsPage.igFeatureReels")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <UserPlus className="w-3.5 h-3.5 text-[#DD2A7B] shrink-0" />
                    <span>{t("channelsPage.igFeatureFollow")}</span>
                  </div>
                </div>

                <div className="mt-auto">
                  {igChannels.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        {t("channelsPage.accountsConnected", { count: igChannels.length })}
                      </div>
                    </div>
                  )}

                  {/* Meta Business Suite note */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#8134AF]/5 border border-[#8134AF]/15 mb-3">
                    <Info className="w-3.5 h-3.5 text-[#8134AF] shrink-0" />
                    <span className="text-[11px] text-muted-foreground leading-snug">{t("channelsPage.metaBusinessSuiteNote")}</span>
                  </div>

                  <Button
                    onClick={handleConnectInstagram}
                    disabled={isConnectingIg}
                    className="w-full gap-2 rounded-xl h-12 font-bold text-white shadow-lg transition-all hover:shadow-xl bg-gradient-to-l from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90"
                  >
                    {isConnectingIg ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <InstagramIcon className="w-5 h-5" />
                    )}
                    {igChannels.length > 0 ? t("channelsPage.connectAnotherAccount") : t("channelsPage.connectInstagramAccount")}
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ───────── WhatsApp Connect Card ───────── */}
            <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className={`absolute inset-0 bg-gradient-to-br ${platformConfig.WHATSAPP.gradientBg} opacity-50`} />
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${platformConfig.WHATSAPP.gradient}`} />
              <CardContent className="relative p-5 sm:p-6 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                    <WhatsAppIcon className="w-7 h-7 text-[#25D366]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">{t("channelsPage.whatsappCardTitle")}</h3>
                    <p className="text-sm text-muted-foreground truncate">{t("channelsPage.whatsappCardSubtitle")}</p>
                  </div>
                </div>

                {/* Feature Badges */}
                <FeatureBadgeList
                  features={waFeatures}
                  accentColor="bg-[#25D366]/5 text-[#25D366] border-[#25D366]/20"
                />

                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {t("channelsPage.whatsappCardDesc")}
                </p>

                <div className="mt-auto">
                  {waChannels.length > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        {t("channelsPage.numbersConnected", { count: waChannels.length })}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-xl h-12 font-bold border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 transition-all hover:shadow-lg hover:shadow-[#25D366]/10"
                    onClick={() => { setWaDialog(true); setWaStep(1) }}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    {waChannels.length > 0 ? t("channelsPage.connectAnotherNumber") : t("channelsPage.connectWhatsappAccount")}
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Connected Channels List */}
          {channels.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                {t("channelsPage.connectedChannelsTitle")}
                <Badge variant="secondary" className="font-bold">{channels.length}</Badge>
              </h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {channels.map((channel, index) => {
                  const config = platformConfig[channel.platform] || platformConfig.FACEBOOK_PAGE
                  const PlatformIcon = config.icon
                  return (
                    <Card 
                      key={channel.id} 
                      className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-none shadow-lg animate-fade-in-up"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${config.gradient}`} />
                      
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 ${config.bg} rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                              <PlatformIcon className={`w-5 h-5 ${config.color}`} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-base truncate">{channel.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-bold text-xs shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1.5" />
                            {t("channelsPage.connectedBadge")}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 border-t border-border/50">
                          <span className="text-xs text-muted-foreground font-mono truncate" dir="ltr">ID: {channel.platformId}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {channel.platform === "FACEBOOK_PAGE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-lg h-8 px-2.5 text-xs gap-1.5"
                                onClick={() => setGrowthTarget(channel)}
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                {t("channelsPage.growthBtn")}
                              </Button>
                            )}
                            {channel.platform === "FACEBOOK_PAGE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-lg h-8 px-3 text-xs gap-1.5"
                                disabled={webhookStatus[channel.id]?.loading}
                                onClick={() => checkWebhook(channel.id)}
                              >
                                {webhookStatus[channel.id]?.loading
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <Webhook className="w-3.5 h-3.5" />}
                                {t("channelsPage.webhookCheckBtn")}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 rounded-lg h-8 px-3 text-xs gap-1.5"
                              onClick={() => setDeleteTarget(channel)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t("channelsPage.disconnectBtn")}
                            </Button>
                          </div>
                        </div>

                        {(() => {
                          const ws = webhookStatus[channel.id]
                          if (!ws || ws.loading) return null
                          const healthy = ws.subscribed && ws.hasMessagesField
                          return (
                            <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg text-xs font-medium ${
                              healthy
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}>
                              {healthy
                                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                              <div className="flex-1 min-w-0">
                                <p className="leading-relaxed">
                                  {healthy
                                    ? t("channelsPage.webhookOk")
                                    : ws.error
                                      ? ws.error
                                      : ws.subscribed
                                        ? t("channelsPage.webhookNoMessagesField")
                                        : t("channelsPage.webhookNotSubscribed")}
                                </p>
                                {!healthy && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 rounded-lg h-7 px-2.5 text-[11px] gap-1"
                                    disabled={ws.fixing}
                                    onClick={() => fixWebhook(channel.id)}
                                  >
                                    {ws.fixing
                                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                                      : <Wrench className="w-3 h-3" />}
                                    {t("channelsPage.webhookFixBtn")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {channels.length === 0 && (
            <Card className="border-dashed border-2 shadow-none bg-accent/20">
              <CardContent className="flex flex-col items-center justify-center p-8 sm:p-16 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mb-6 animate-float">
                  <WifiOff className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-black mb-3">{t("channelsPage.emptyTitle")}</h3>
                <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                  {t("channelsPage.emptyDesc")}
                </p>
                <Button onClick={handleConnectFacebook} disabled={isConnectingFb} className="rounded-xl gap-2 h-12 px-8 shadow-lg shadow-primary/20 font-bold bg-[#1877F2] hover:bg-[#0d5cbf] text-white">
                  {isConnectingFb ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FacebookIcon className="w-5 h-5" />}
                  {t("channelsPage.connectFacebookAccount")}
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Growth tool: m.me link + QR */}
      <Dialog open={!!growthTarget} onOpenChange={(open) => !open && setGrowthTarget(null)}>
        <DialogContent className="sm:max-w-[420px]" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              {t("channelsPage.growthTitle")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed pt-1">
              {t("channelsPage.growthDesc", { name: growthTarget?.name || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" className="w-56 h-56 rounded-2xl border border-border/50 bg-white p-2" />
            )}
            <div className="flex items-center gap-2 w-full">
              <code className="flex-1 text-xs bg-muted/50 border border-border/50 rounded-xl px-3 py-2.5 truncate" dir="ltr">{growthLink}</code>
              <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 shrink-0" onClick={copyGrowthLink}>
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? t("channelsPage.growthCopied") : t("channelsPage.growthCopy")}
              </Button>
            </div>
            <a
              href={qrDataUrl}
              download={`hubqa-messenger-qr-${growthTarget?.platformId}.png`}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Download className="w-4 h-4" />
              {t("channelsPage.growthDownload")}
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-xl">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              {t("channelsPage.disconnectConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-2">
              {t("channelsPage.disconnectConfirmMessage", { name: deleteTarget?.name || "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">{t("channelsPage.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChannel}
              disabled={isDeleting}
              className="rounded-xl gap-2"
            >
              {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("channelsPage.confirmDisconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Connection Wizard */}
      <Dialog open={waDialog} onOpenChange={(open) => { if (!open) { setWaDialog(false); setWaStep(1) } }}>
        <DialogContent className="sm:max-w-[520px]" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-3">
              <div className="p-2.5 bg-[#25D366]/10 rounded-xl">
                <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
              </div>
              {t("channelsPage.waWizardTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm pt-1">
              {waStep === 1 ? t("channelsPage.waStepInstructions") : t("channelsPage.waStepData")}
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicators */}
          <div className="flex items-center gap-3 py-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${waStep === 1 ? "bg-[#25D366]/10 text-[#25D366]" : "bg-muted text-muted-foreground"}`}>
              <span className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>
              {t("channelsPage.waStep1Label")}
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${waStep === 2 ? "bg-[#25D366]/10 text-[#25D366]" : "bg-muted text-muted-foreground"}`}>
              <span className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>
              {t("channelsPage.waStep2Label")}
            </div>
          </div>

          {waStep === 1 ? (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center text-xs font-black">1</span>
                  {t("channelsPage.waStep1Title")}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed pr-8">
                  {t("channelsPage.waStep1Desc1")}{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline font-medium inline-flex items-center gap-1">
                    Meta for Developers
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {" "}{t("channelsPage.waStep1Desc2")}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center text-xs font-black">2</span>
                  {t("channelsPage.waStep2Title")}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed pr-8">
                  {t("channelsPage.waStep2Desc")}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center text-xs font-black">3</span>
                  {t("channelsPage.waStep3Title")}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed pr-8">
                  {t("channelsPage.waStep3Desc", { phoneId: "@@PHONE@@", token: "@@TOKEN@@" }).split(/(@@PHONE@@|@@TOKEN@@)/).map((part, i) =>
                    part === "@@PHONE@@" ? <strong key={i} className="text-foreground">Phone Number ID</strong>
                    : part === "@@TOKEN@@" ? <strong key={i} className="text-foreground">Permanent Access Token</strong>
                    : part
                  )}
                </p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("channelsPage.waTokenWarning", { permanent: "@@PERMANENT@@" }).split("@@PERMANENT@@").map((part, i, arr) =>
                    i < arr.length - 1 ? <span key={i}>{part}<strong>Permanent Token</strong></span> : <span key={i}>{part}</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-bold">{t("channelsPage.channelNameLabel")}</label>
                <Input
                  value={waName}
                  onChange={e => setWaName(e.target.value)}
                  placeholder={t("channelsPage.channelNamePlaceholder")}
                  className="rounded-xl h-11 bg-muted/30 border-border/50 focus:border-[#25D366]/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  Phone Number ID
                  <Badge variant="outline" className="text-[10px] font-normal">{t("channelsPage.required")}</Badge>
                </label>
                <Input
                  value={waPhoneId}
                  onChange={e => setWaPhoneId(e.target.value)}
                  placeholder="e.g. 100234567890123"
                  className="rounded-xl h-11 bg-muted/30 border-border/50 focus:border-[#25D366]/50 font-mono text-sm"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">{t("channelsPage.phoneNumberIdHint")}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  Access Token
                  <Badge variant="outline" className="text-[10px] font-normal">{t("channelsPage.required")}</Badge>
                </label>
                <Input
                  type="password"
                  value={waToken}
                  onChange={e => setWaToken(e.target.value)}
                  placeholder="EAAxxxxxxx..."
                  className="rounded-xl h-11 bg-muted/30 border-border/50 focus:border-[#25D366]/50 font-mono text-sm"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">{t("channelsPage.accessTokenHint")}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => { setWaDialog(false); setWaStep(1) }} className="rounded-xl">{t("channelsPage.cancel")}</Button>
            {waStep === 1 ? (
              <Button onClick={() => setWaStep(2)} className="rounded-xl gap-2 bg-[#25D366] hover:bg-[#1da851] text-white">
                {t("channelsPage.next")}
                <ArrowLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleConnectWhatsApp}
                disabled={waSubmitting || !waPhoneId || !waToken}
                className="rounded-xl gap-2 bg-[#25D366] hover:bg-[#1da851] text-white shadow-lg shadow-[#25D366]/20"
              >
                {waSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
                {t("channelsPage.confirmConnect")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
