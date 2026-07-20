"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { MessageSquareText, Plus, Trash2, ToggleRight, Image as ImageIcon, Video, Save, RefreshCw, Zap, Target, Globe2, Sparkles, Newspaper, X, Send, MessageCircle, Edit, ArrowUp, ArrowDown, LayoutGrid, Smartphone, ChevronRight, Search, Copy, Clock, Filter, AlertTriangle, Play, CheckSquare } from "lucide-react"
import api from "@/lib/api"
import { PostPicker, PickedPost } from "@/components/post-picker"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/language-context"

interface Rule {
  id: string
  name: string
  triggerType: string
  postId: string | null
  keywords: string
  replyText: string | null
  replyMedia: string | null
  privateText: string | null
  isActive: boolean
  priority: number
  triggerCount: number
  lastTriggeredAt: string | null
  replyMessages: any
  connectionId: string | null
  scheduleConfig?: ScheduleConfig | null
}

interface ScheduleConfig {
  enabled: boolean
  days: string[]
  startTime: string
  endTime: string
}

interface PredefinedTemplate {
  name: string
  description: string
  keywords: string
  replyText: string
  isSequentialEnabled: boolean
  replyMessages: any[]
  sector?: string
}

const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    name: "استفسار عن السعر",
    description: "للرد التلقائي وإرسال قائمة أسعار تفاعلية في الخاص عند السؤال عن السعر.",
    keywords: "سعر, كم, السعر, تفاصيل, بكم, السعر كام",
    replyText: "أهلاً بك! تفاصيل الأسعار والمنتجات تم إرسالها إليك في رسالة خاصة 💬",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك! شكراً لاستفسارك عن منتجاتنا. الأسعار تبدأ من 150 ريال سعودي فقط! 🎁"
      },
      {
        type: "CAROUSEL",
        cards: [
          {
            title: "باقة البرو (الاحترافية)",
            subtitle: "أفضل خيار للشركات الناشئة والمتاجر النامية",
            imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500",
            buttons: [
              { type: "url", title: "شراء الآن", url: "https://example.com/buy-pro" }
            ]
          },
          {
            title: "الباقة الأساسية",
            subtitle: "مثالية للاستخدام الفردي والمشاريع الصغيرة",
            imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500",
            buttons: [
              { type: "url", title: "شراء الآن", url: "https://example.com/buy-basic" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "ترحيب بالعملاء الجدد",
    description: "للترحيب بالعملاء الجدد وإعطائهم خيارات تفاعلية فورية.",
    keywords: "مرحبا, هلا, ترحيب, سلام, السلام عليكم, السلام",
    replyText: "وعليكم السلام ورحمة الله وبركاته! أهلاً بك في صفحتنا 🌸 سنقوم بالرد عليك في الخاص الآن.",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك يا غالي! نسعد جداً بتواصلك معنا. كيف يمكننا مساعدتك اليوم؟"
      },
      {
        type: "QUICK_REPLIES",
        text: "اختر أحد الخيارات التالية للمتابعة الفورية:",
        replies: [
          { title: "استفسار عن الخدمات", payload: "services_inquiry" },
          { title: "التحدث مع الدعم", payload: "support_talk" }
        ]
      }
    ]
  },
  {
    name: "مواعيد وساعات العمل",
    description: "للرد تلقائياً بأوقات العمل الرسمية وموقع الفرع الرئيسي.",
    keywords: "مواعيد, ساعات العمل, متى تفتحوا, متى تغلقوا, اوقات العمل",
    replyText: "أهلاً بك! تفضل مواعيد العمل وتفاصيل الفروع في الخاص 📍",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "ساعات العمل لدينا هي من السبت إلى الخميس، من الساعة 9 صباحاً وحتى 10 مساءً. ⏰"
      },
      {
        type: "IMAGE",
        caption: "خريطة فروعنا وموقع المعرض الرئيسي",
        imageUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500"
      }
    ]
  },
  // ═══════ 🍽️ قطاع المطاعم ═══════
  {
    sector: "مطاعم",
    name: "المنيو والتوصيل",
    description: "يرسل قائمة الطعام في الخاص مع خيارات التوصيل أو الاستلام عند أي سؤال عن المنيو.",
    keywords: "منيو, المنيو, قائمة, الطعام, توصيل, دليفري, طلب, اطلب",
    replyText: "أهلاً وسهلاً! 🍽️ أرسلنا لك المنيو كامل مع خيارات الطلب في الخاص ||| يا هلا بك! المنيو وتفاصيل التوصيل وصلتك على الخاص 📩",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك في مطعمنا! 🍽️ تفضل قائمة الطعام: [رابط المنيو]. التوصيل متاح يومياً من 11 صباحاً حتى 12 منتصف الليل. ||| يا هلا وغلا! 😍 منيونا الكامل هنا: [رابط المنيو] — والتوصيل لباب البيت خلال 45 دقيقة."
      },
      {
        type: "QUICK_REPLIES",
        text: "كيف تحب تكمل طلبك؟",
        replies: [
          { title: "🛵 توصيل", payload: "delivery_order" },
          { title: "🏃 استلام من الفرع", payload: "pickup_order" }
        ]
      }
    ]
  },
  {
    sector: "مطاعم",
    name: "حجز طاولة",
    description: "يستقبل طلبات حجز الطاولات ويطلب التفاصيل اللازمة تلقائياً.",
    keywords: "حجز, طاولة, احجز, حجوزات, عائلات",
    replyText: "أهلاً بك! 🪑 تم استلام طلب الحجز، راسلناك في الخاص لتأكيد التفاصيل ||| حياك الله! تفاصيل الحجز وصلتك على الخاص 📩",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "يسعدنا حجز طاولتك! 🎉 فضلاً أرسل لنا: عدد الأشخاص، التاريخ، والوقت المفضل — وسنؤكد الحجز فوراً. ||| أهلاً بك! لإتمام الحجز نحتاج: كم شخص؟ أي يوم؟ وأي ساعة؟ وبنأكد لك خلال دقائق ⏱️"
      }
    ]
  },
  // ═══════ 🩺 قطاع العيادات ═══════
  {
    sector: "عيادات",
    name: "حجز موعد كشف",
    description: "ينقل طلبات حجز المواعيد للخاص فوراً حفاظاً على خصوصية المرضى.",
    keywords: "موعد, حجز, كشف, دكتور, عيادة, احجز, متى الدوام",
    replyText: "أهلاً بك 🌟 حفاظاً على خصوصيتك أرسلنا لك تفاصيل حجز الموعد في الخاص ||| حياك الله! راسلناك على الخاص بخصوص الموعد 📩",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك في عيادتنا 🩺 لحجز موعدك فضلاً أرسل: الاسم الكامل، رقم الجوال، والتخصص المطلوب — وسيتواصل معك فريق المواعيد خلال ساعات الدوام. ||| يسعدنا خدمتك! 🌟 أرسل لنا اسمك ورقمك والتخصص الذي تريده، وسنؤكد أقرب موعد متاح."
      },
      {
        type: "QUICK_REPLIES",
        text: "أو اختر مباشرة:",
        replies: [
          { title: "📅 أقرب موعد متاح", payload: "nearest_appointment" },
          { title: "💬 استشارة سريعة", payload: "quick_consult" }
        ]
      }
    ]
  },
  {
    sector: "عيادات",
    name: "أسعار الكشف والخدمات",
    description: "يرد على استفسارات أسعار الكشف بلباقة وينقل التفاصيل للخاص.",
    keywords: "سعر الكشف, كم الكشف, بكم الكشف, اسعار, التكلفة, كم سعر",
    replyText: "أهلاً بك! أرسلنا لك تفاصيل الأسعار والعروض الحالية في الخاص 📩 ||| حياك الله! قائمة الأسعار وصلتك على الخاص 🌟",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك 🌟 سعر الكشف يبدأ من [السعر] ريال، ولدينا حالياً عروض على باقات المتابعة. للحجز أرسل اسمك ورقم جوالك. ||| يسعدنا اهتمامك! الكشف يبدأ من [السعر] ريال وتوجد خصومات على الباقات العائلية 👨‍👩‍👧 — أرسل بياناتك وسنتواصل معك."
      }
    ]
  },
  // ═══════ 🛍️ قطاع المتاجر ═══════
  {
    sector: "متاجر",
    name: "توفر المنتج والمقاسات",
    description: "يرد فوراً على أسئلة توفر المنتجات والمقاسات والألوان.",
    keywords: "متوفر, المقاس, مقاس, لون, الوان, موجود, متاح",
    replyText: "أهلاً بك! ✨ تفاصيل التوفر والمقاسات أرسلناها لك في الخاص ||| حياك الله! راسلناك على الخاص بكل التفاصيل 📩",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك! 🛍️ المنتج متوفر حالياً بجميع المقاسات والألوان الظاهرة في المنشور. اطلب الآن قبل نفاد الكمية: [رابط المتجر] ||| يا هلا! ✨ نعم متوفر، والمقاسات من S إلى XXL. تقدر تطلبه مباشرة من هنا: [رابط المتجر]"
      }
    ]
  },
  {
    sector: "متاجر",
    name: "الشحن والاسترجاع",
    description: "يجيب تلقائياً على أسئلة الشحن ومدة التوصيل وسياسة الاسترجاع.",
    keywords: "شحن, الشحن, توصيل, كم يوصل, استرجاع, استبدال, ارجاع",
    replyText: "أهلاً بك! 🚚 تفاصيل الشحن والاسترجاع كاملة في رسالتك الخاصة ||| حياك الله! أرسلنا لك سياسة الشحن والاسترجاع في الخاص 📩",
    isSequentialEnabled: true,
    replyMessages: [
      {
        type: "TEXT",
        text: "أهلاً بك! 🚚 الشحن لجميع المدن خلال 2-5 أيام عمل، والشحن مجاني للطلبات فوق 200 ريال. الاسترجاع متاح خلال 14 يوم بدون أسئلة. ||| يا هلا! التوصيل 2-5 أيام عمل 📦 ومجاني فوق 200 ريال — وتقدر تسترجع أو تستبدل خلال 14 يوم بكل سهولة."
      }
    ]
  }
]

export default function RulesPage() {
  const { t, locale, dir } = useLanguage()
  const localeCode = locale === "ar" ? "ar-EG" : "en-US"
  const DAYS_OF_WEEK = [
    { key: "sat", label: t("rulesPage.dayShortSat") },
    { key: "sun", label: t("rulesPage.dayShortSun") },
    { key: "mon", label: t("rulesPage.dayShortMon") },
    { key: "tue", label: t("rulesPage.dayShortTue") },
    { key: "wed", label: t("rulesPage.dayShortWed") },
    { key: "thu", label: t("rulesPage.dayShortThu") },
    { key: "fri", label: t("rulesPage.dayShortFri") },
  ]
  const confirm = useConfirm()
  const { showToast } = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [ruleType, setRuleType] = useState("GLOBAL")
  const [storyTrigger, setStoryTrigger] = useState("STORY_REPLY")
  const [postId, setPostId] = useState("")
  const [selectedPost, setSelectedPost] = useState<PickedPost | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [showManualId, setShowManualId] = useState(false)
  const [keywords, setKeywords] = useState("")
  const [replyText, setReplyText] = useState("")
  const [privateText, setPrivateText] = useState("")
  const [mediaType, setMediaType] = useState("NONE")
  const [mediaUrl, setMediaUrl] = useState("")
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Channel scope for the rule: "" = all channels (Facebook + Instagram),
  // otherwise a specific connection id. Only meaningful for GLOBAL/keyword
  // rules; POST rules derive their channel from the picked post.
  const [ruleConnectionId, setRuleConnectionId] = useState("")
  const [ruleChannels, setRuleChannels] = useState<{ id: string; name: string; platform: string }[]>([])

  // Sequential message state
  const [isSequentialEnabled, setIsSequentialEnabled] = useState(false)
  const [replyMessages, setReplyMessages] = useState<any[]>([
    { type: "TEXT", text: "" },
    { type: "TEXT", text: "" }
  ])

  // Mobile preview state
  const [previewPlatform, setPreviewPlatform] = useState<"MESSENGER" | "WHATSAPP">("MESSENGER")

  // --- NEW: Search, Filter, Sort state ---
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"ALL" | "GLOBAL" | "POST">("ALL")
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [sortBy, setSortBy] = useState<"name" | "date" | "triggers">("date")

  // --- NEW: Bulk selection state ---
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set())

  // --- NEW: Scheduling state ---
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleDays, setScheduleDays] = useState<string[]>([])
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00")
  const [scheduleEndTime, setScheduleEndTime] = useState("22:00")

  // --- NEW: Keyword conflict warnings ---
  const [keywordConflicts, setKeywordConflicts] = useState<{ keyword: string; ruleName: string }[]>([])

  const fetchRules = async () => {
    try {
      setIsLoading(true)
      const res = await api.get("/rules")
      setRules(res.data)
    } catch (error) {
      console.error("Failed to fetch rules", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
    // Load the tenant's Facebook/Instagram channels so a rule can target a
    // specific one, or all of them at once.
    api.get("/channels")
      .then(res => {
        setRuleChannels(
          res.data.filter((c: { platform: string }) =>
            c.platform === "FACEBOOK_PAGE" || c.platform === "INSTAGRAM"
          )
        )
      })
      .catch(() => { /* non-fatal: scope selector just won't show channels */ })
  }, [])

  // --- NEW: Keyword conflict detection ---
  useEffect(() => {
    if (!keywords.trim()) {
      setKeywordConflicts([])
      return
    }
    const enteredKeywords = keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
    const conflicts: { keyword: string; ruleName: string }[] = []
    for (const rule of rules) {
      if (rule.id === editingRuleId) continue
      if (!rule.keywords) continue
      const ruleKeywords = rule.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
      for (const ek of enteredKeywords) {
        if (ruleKeywords.includes(ek)) {
          conflicts.push({ keyword: ek, ruleName: rule.name })
        }
      }
    }
    setKeywordConflicts(conflicts)
  }, [keywords, rules, editingRuleId])

  // --- NEW: Filtered & sorted rules ---
  const filteredRules = useMemo(() => {
    let result = [...rules]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.keywords && r.keywords.toLowerCase().includes(q))
      )
    }

    // Type filter
    if (filterType === "GLOBAL") {
      result = result.filter(r => !r.postId)
    } else if (filterType === "POST") {
      result = result.filter(r => !!r.postId)
    }

    // Status filter
    if (filterStatus === "ACTIVE") {
      result = result.filter(r => r.isActive)
    } else if (filterStatus === "INACTIVE") {
      result = result.filter(r => !r.isActive)
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name, localeCode))
    } else if (sortBy === "triggers") {
      result.sort((a, b) => (b.triggerCount || 0) - (a.triggerCount || 0))
    } else {
      // date - newest first (default order from API)
    }

    return result
  }, [rules, searchQuery, filterType, filterStatus, sortBy])

  const handleSaveRule = async () => {
    try {
      setIsSubmitting(true)
      const replyMedia = mediaType !== "NONE" && mediaUrl ? [mediaUrl] : null
      const effectivePostId = selectedPost?.id || postId
      
      const payload: any = {
        name,
        triggerType:
          ruleType === "STORY"
            ? storyTrigger
            : keywords ? "KEYWORD" : "ANY_COMMENT",
        postId: ruleType === "POST" && effectivePostId ? effectivePostId : null,
        // POST rules take their channel from the picked post; GLOBAL/STORY
        // rules use the explicit scope selector ("" = all channels).
        connectionId:
          ruleType === "POST"
            ? (selectedPost?.channelId || null)
            : (ruleConnectionId || null),
        keywords,
        replyText,
        privateText: isSequentialEnabled ? null : (privateText || null),
        replyMedia: isSequentialEnabled ? null : replyMedia,
        priority: ruleType === "POST" ? 10 : 0,
        isActive: true,
        replyMessages: isSequentialEnabled ? replyMessages : null,
        scheduleConfig: scheduleEnabled ? {
          enabled: true,
          days: scheduleDays,
          startTime: scheduleStartTime,
          endTime: scheduleEndTime
        } : null
      }

      if (editingRuleId) {
        await api.put(`/rules/${editingRuleId}`, payload)
        setBanner({ type: "success", text: t("rulesPage.ruleUpdatedSuccess") })
      } else {
        await api.post("/rules", payload)
        setBanner({ type: "success", text: t("rulesPage.ruleCreatedSuccess") })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchRules()
    } catch (error) {
      console.error("Failed to save rule", error)
      setBanner({ type: "error", text: t("rulesPage.saveRuleFailed") })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRuleActive = async (rule: Rule) => {
    try {
      setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      await api.put(`/rules/${rule.id}`, { isActive: !rule.isActive })
    } catch (error) {
      console.error("Failed to toggle", error)
      fetchRules()
    }
  }

  const handleEditRule = (rule: Rule) => {
    setEditingRuleId(rule.id)
    setName(rule.name)
    if (rule.triggerType === "STORY_REPLY" || rule.triggerType === "STORY_MENTION") {
      setRuleType("STORY")
      setStoryTrigger(rule.triggerType)
    } else {
      setRuleType(rule.postId ? "POST" : "GLOBAL")
    }
    setPostId(rule.postId || "")
    if (rule.postId) {
      setSelectedPost({
        id: rule.postId,
        message: t("rulesPage.postAlreadySelected"),
        picture: "",
        commentsCount: 0,
        channelName: "",
        createdTime: "",
        permalink: "",
        channelId: rule.connectionId || ""
      })
    } else {
      setSelectedPost(null)
    }
    setRuleConnectionId(rule.connectionId || "")
    setKeywords(rule.keywords || "")
    setReplyText(rule.replyText || "")
    setPrivateText(rule.privateText || "")
    
    let mediaUrlVal = ""
    let mediaTypeVal = "NONE"
    if (rule.replyMedia) {
      try {
        const parsed = typeof rule.replyMedia === 'string' ? JSON.parse(rule.replyMedia) : rule.replyMedia
        if (Array.isArray(parsed) && parsed.length > 0) {
          mediaUrlVal = parsed[0]
          mediaTypeVal = mediaUrlVal.includes(".mp4") ? "VIDEO" : "IMAGE"
        }
      } catch (e) {
        // fallback
      }
    }
    setMediaType(mediaTypeVal)
    setMediaUrl(mediaUrlVal)

    if (rule.replyMessages) {
      try {
        const parsed = typeof rule.replyMessages === 'string' ? JSON.parse(rule.replyMessages) : rule.replyMessages
        if (Array.isArray(parsed) && parsed.length > 0) {
          setIsSequentialEnabled(true)
          setReplyMessages(parsed)
        } else {
          setIsSequentialEnabled(false)
          setReplyMessages([{ type: "TEXT", text: "" }, { type: "TEXT", text: "" }])
        }
      } catch (e) {
        setIsSequentialEnabled(false)
        setReplyMessages([{ type: "TEXT", text: "" }, { type: "TEXT", text: "" }])
      }
    } else {
      setIsSequentialEnabled(false)
      setReplyMessages([{ type: "TEXT", text: "" }, { type: "TEXT", text: "" }])
    }

    // Load schedule config
    if (rule.scheduleConfig) {
      try {
        const sc = typeof rule.scheduleConfig === 'string' ? JSON.parse(rule.scheduleConfig) : rule.scheduleConfig
        if (sc && sc.enabled) {
          setScheduleEnabled(true)
          setScheduleDays(sc.days || [])
          setScheduleStartTime(sc.startTime || "09:00")
          setScheduleEndTime(sc.endTime || "22:00")
        } else {
          setScheduleEnabled(false)
          setScheduleDays([])
          setScheduleStartTime("09:00")
          setScheduleEndTime("22:00")
        }
      } catch {
        setScheduleEnabled(false)
        setScheduleDays([])
        setScheduleStartTime("09:00")
        setScheduleEndTime("22:00")
      }
    } else {
      setScheduleEnabled(false)
      setScheduleDays([])
      setScheduleStartTime("09:00")
      setScheduleEndTime("22:00")
    }

    setIsDialogOpen(true)
  }

  const applyTemplate = (tpl: PredefinedTemplate) => {
    resetForm()
    setName(tpl.name)
    setKeywords(tpl.keywords)
    setReplyText(tpl.replyText)
    setIsSequentialEnabled(tpl.isSequentialEnabled)
    if (tpl.replyMessages) {
      setReplyMessages(JSON.parse(JSON.stringify(tpl.replyMessages)))
    }
    setIsTemplatesOpen(false)
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setName("")
    setRuleType("GLOBAL")
    setStoryTrigger("STORY_REPLY")
    setPostId("")
    setSelectedPost(null)
    setShowManualId(false)
    setRuleConnectionId("")
    setKeywords("")
    setReplyText("")
    setPrivateText("")
    setMediaType("NONE")
    setMediaUrl("")
    setEditingRuleId(null)
    setIsSequentialEnabled(false)
    setReplyMessages([
      { type: "TEXT", text: "" },
      { type: "TEXT", text: "" }
    ])
    setScheduleEnabled(false)
    setScheduleDays([])
    setScheduleStartTime("09:00")
    setScheduleEndTime("22:00")
    setKeywordConflicts([])
  }

  const handleAddMessage = () => {
    if (replyMessages.length < 5) {
      setReplyMessages([...replyMessages, { type: "TEXT", text: "" }])
    }
  }

  const handleRemoveMessage = (index: number) => {
    if (replyMessages.length > 2) {
      const updated = [...replyMessages]
      updated.splice(index, 1)
      setReplyMessages(updated)
    }
  }

  const handleUpdateMessageField = (index: number, field: string, value: any) => {
    const updated = [...replyMessages]
    updated[index] = { ...updated[index], [field]: value }
    setReplyMessages(updated)
  }

  const moveMessageUp = (index: number) => {
    if (index > 0) {
      const updated = [...replyMessages]
      const temp = updated[index]
      updated[index] = updated[index - 1]
      updated[index - 1] = temp
      setReplyMessages(updated)
    }
  }

  const moveMessageDown = (index: number) => {
    if (index < replyMessages.length - 1) {
      const updated = [...replyMessages]
      const temp = updated[index]
      updated[index] = updated[index + 1]
      updated[index + 1] = temp
      setReplyMessages(updated)
    }
  }

  const formatArabicDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return t("rulesPage.notTriggeredYet")
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return t("rulesPage.notTriggeredYet")
      return new Intl.DateTimeFormat(localeCode, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date)
    } catch (e) {
      return t("rulesPage.notTriggeredYet")
    }
  }

  // --- NEW: Clone/Duplicate Rule ---
  const handleCloneRule = async (rule: Rule) => {
    try {
      let parsedMessages = null
      if (rule.replyMessages) {
        try {
          parsedMessages = typeof rule.replyMessages === 'string' ? JSON.parse(rule.replyMessages) : rule.replyMessages
        } catch { /* ignore */ }
      }

      let parsedMedia = null
      if (rule.replyMedia) {
        try {
          parsedMedia = typeof rule.replyMedia === 'string' ? JSON.parse(rule.replyMedia) : rule.replyMedia
        } catch { /* ignore */ }
      }

      const payload = {
        name: t("rulesPage.copyOfRuleName", { name: rule.name }),
        triggerType: rule.triggerType,
        postId: rule.postId || null,
        keywords: rule.keywords || "",
        replyText: rule.replyText || "",
        privateText: rule.privateText || null,
        replyMedia: parsedMedia,
        priority: rule.priority,
        isActive: false,
        replyMessages: parsedMessages,
      }
      await api.post("/rules", payload)
      showToast(t("rulesPage.ruleClonedSuccess", { name: rule.name }), "success")
      fetchRules()
    } catch (error) {
      console.error("Failed to clone rule", error)
      showToast(t("rulesPage.cloneRuleFailed"), "error")
    }
  }

  // --- NEW: Bulk Actions ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRuleIds(new Set(filteredRules.map(r => r.id)))
    } else {
      setSelectedRuleIds(new Set())
    }
  }

  const handleToggleSelect = (ruleId: string) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev)
      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }
      return next
    })
  }

  const handleBulkActivate = async () => {
    try {
      const ids = Array.from(selectedRuleIds)
      await Promise.all(ids.map(id => api.put(`/rules/${id}`, { isActive: true })))
      showToast(t("rulesPage.bulkActivateSuccess", { count: ids.length }), "success")
      setSelectedRuleIds(new Set())
      fetchRules()
    } catch (error) {
      console.error("Bulk activate failed", error)
      showToast(t("rulesPage.bulkActivateFailed"), "error")
    }
  }

  const handleBulkDeactivate = async () => {
    try {
      const ids = Array.from(selectedRuleIds)
      await Promise.all(ids.map(id => api.put(`/rules/${id}`, { isActive: false })))
      showToast(t("rulesPage.bulkDeactivateSuccess", { count: ids.length }), "success")
      setSelectedRuleIds(new Set())
      fetchRules()
    } catch (error) {
      console.error("Bulk deactivate failed", error)
      showToast(t("rulesPage.bulkDeactivateFailed"), "error")
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedRuleIds)
    const confirmed = await confirm({
      title: t("rulesPage.bulkDeleteConfirmTitle"),
      message: t("rulesPage.bulkDeleteConfirmMessage", { count: ids.length }),
      variant: "destructive",
      confirmText: t("rulesPage.confirmDelete"),
      cancelText: t("rulesPage.cancel")
    })
    if (confirmed) {
      try {
        await Promise.all(ids.map(id => api.delete(`/rules/${id}`)))
        showToast(t("rulesPage.bulkDeleteSuccess", { count: ids.length }), "success")
        setSelectedRuleIds(new Set())
        fetchRules()
      } catch (error) {
        console.error("Bulk delete failed", error)
        showToast(t("rulesPage.bulkDeleteFailed"), "error")
      }
    }
  }

  const isAllSelected = filteredRules.length > 0 && filteredRules.every(r => selectedRuleIds.has(r.id))

  return (
    <>
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
              <Zap className="w-6 h-6 text-white" />
            </div>
            {t("rulesPage.title")}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">{t("rulesPage.subtitle")}</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setIsTemplatesOpen(true)}
            className="gap-2 rounded-xl px-5 h-11 font-bold border-primary/30 hover:bg-primary/10 cursor-pointer w-full sm:w-auto"
          >
            <LayoutGrid className="w-4 h-4 text-primary" />
            {t("rulesPage.templatesLibraryBtn")}
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger render={<Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl px-6 h-11 font-bold cursor-pointer w-full sm:w-auto" />}>
              <Plus className="w-4 h-4" />
              {t("rulesPage.addNewRuleBtn")}
            </DialogTrigger>
            <DialogContent className={`${isSequentialEnabled ? 'sm:max-w-[1100px]' : 'sm:max-w-[650px]'} max-h-[90vh] overflow-y-auto transition-all duration-300`} dir={dir}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">
                  {editingRuleId ? t("rulesPage.editRuleTitle") : t("rulesPage.createRuleTitle")}
                </DialogTitle>
                <DialogDescription className="font-medium">
                  {t("rulesPage.dialogDesc")}
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex flex-col lg:flex-row gap-8 py-4">
                {/* Form Inputs Column */}
                <div className="flex-1 space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="font-bold">{t("rulesPage.ruleNameLabel")}</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={t("rulesPage.ruleNamePlaceholder")} className="rounded-xl h-11 font-medium" />
                  </div>

                  <div className="grid gap-2">
                    <Label className="font-bold">{t("rulesPage.ruleScopeLabel")}</Label>
                    <Tabs value={ruleType} onValueChange={setRuleType} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 rounded-xl h-11">
                        <TabsTrigger value="GLOBAL" className="rounded-lg gap-2 font-bold cursor-pointer">
                          <Globe2 className="w-4 h-4" />
                          {t("rulesPage.scopeGlobal")}
                        </TabsTrigger>
                        <TabsTrigger value="POST" className="rounded-lg gap-2 font-bold cursor-pointer">
                          <Target className="w-4 h-4" />
                          {t("rulesPage.scopePost")}
                        </TabsTrigger>
                        <TabsTrigger value="STORY" className="rounded-lg gap-2 font-bold cursor-pointer">
                          <Play className="w-4 h-4" />
                          {t("rulesPage.scopeStory")}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="STORY" className="pt-4 border-t mt-4">
                        <div className="grid gap-2">
                          <Label className="font-bold text-sm">{t("rulesPage.storyTriggerTypeLabel")}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setStoryTrigger("STORY_REPLY")}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-bold transition-colors cursor-pointer ${
                                storyTrigger === "STORY_REPLY"
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              <Send className="w-4 h-4 shrink-0" />
                              {t("rulesPage.storyReplyOption")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStoryTrigger("STORY_MENTION")}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-bold transition-colors cursor-pointer ${
                                storyTrigger === "STORY_MENTION"
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              <Sparkles className="w-4 h-4 shrink-0" />
                              {t("rulesPage.storyMentionOption")}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            {storyTrigger === "STORY_REPLY"
                              ? t("rulesPage.storyReplyHint")
                              : t("rulesPage.storyMentionHint")}
                          </p>
                        </div>
                      </TabsContent>
                      <TabsContent value="POST" className="pt-4 border-t mt-4">
                        <div className="grid gap-3">
                          {selectedPost ? (
                            <div className="flex gap-3 p-3 border rounded-xl bg-accent/30 items-start">
                              {selectedPost.picture ? (
                                 
                                <img src={selectedPost.picture} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border" />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Newspaper className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold line-clamp-2">
                                  {selectedPost.message || <span className="italic text-muted-foreground">{t("rulesPage.postWithoutText")}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                                  <MessageCircle className="w-3 h-3" />
                                  {t("rulesPage.commentsCountChannel", { count: selectedPost.commentsCount, channel: selectedPost.channelName })}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                                onClick={() => setSelectedPost(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl h-14 gap-2 border-dashed border-2 font-bold cursor-pointer"
                              onClick={() => setIsPickerOpen(true)}
                            >
                              <Newspaper className="w-5 h-5 text-primary" />
                              {t("rulesPage.selectPostFromPage")}
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground font-medium">
                            {t("rulesPage.postRuleHint")}
                          </p>

                          {!selectedPost && (
                            <div className="grid gap-2">
                              <button
                                type="button"
                                onClick={() => setShowManualId(!showManualId)}
                                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-right w-fit cursor-pointer font-medium"
                              >
                                {showManualId ? t("rulesPage.hideManualInput") : t("rulesPage.orEnterPostIdManually")}
                              </button>
                              {showManualId && (
                                <Input
                                  id="postId"
                                  value={postId}
                                  onChange={e => setPostId(e.target.value)}
                                  placeholder={t("rulesPage.postIdPlaceholder")}
                                  className="rounded-xl h-11"
                                  dir="ltr"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Channel scope — only for GLOBAL/STORY rules; POST rules
                      inherit their channel from the picked post. Hidden when
                      the tenant has one channel or fewer (nothing to choose). */}
                  {ruleType !== "POST" && ruleChannels.length > 1 && (
                    <div className="grid gap-2">
                      <Label className="font-bold">{t("rulesPage.channelScopeLabel")}</Label>
                      <Select
                        value={ruleConnectionId || "ALL"}
                        onValueChange={(v) => setRuleConnectionId(!v || v === "ALL" ? "" : v)}
                      >
                        <SelectTrigger className="rounded-xl h-11 w-full">
                          <SelectValue>
                            {(value: string) => {
                              if (!value || value === "ALL") return t("rulesPage.channelScopeAll")
                              const c = ruleChannels.find(ch => ch.id === value)
                              if (!c) return t("rulesPage.channelScopeAll")
                              return `${c.name} · ${c.platform === "INSTAGRAM" ? "انستغرام" : "فيسبوك"}`
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">
                            <span className="flex items-center gap-2 font-bold">
                              <Globe2 className="w-4 h-4 shrink-0 text-primary" />
                              {t("rulesPage.channelScopeAll")}
                            </span>
                          </SelectItem>
                          {ruleChannels.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <span>{c.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {c.platform === "INSTAGRAM" ? "انستغرام" : "فيسبوك"}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t("rulesPage.channelScopeHint")}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="keywords" className="font-bold">{t("rulesPage.keywordsLabel")}</Label>
                    <Input id="keywords" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder={t("rulesPage.keywordsPlaceholder")} className="rounded-xl h-11 font-medium" />
                    <p className="text-xs text-muted-foreground font-medium">{t("rulesPage.keywordsHint")}</p>

                    {/* --- NEW: Keyword Conflict Warnings --- */}
                    {keywordConflicts.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {keywordConflicts.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{t("rulesPage.keywordConflictWarning", { keyword: c.keyword, ruleName: c.ruleName })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* --- NEW: Time-based Scheduling --- */}
                  <div className="grid gap-3 border-t pt-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border bg-accent/20">
                      <div className="space-y-0.5">
                        <Label className="font-bold text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          {t("rulesPage.schedulingLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground font-medium">{t("rulesPage.schedulingHint")}</p>
                      </div>
                      <Switch
                        checked={scheduleEnabled}
                        onCheckedChange={setScheduleEnabled}
                      />
                    </div>

                    {scheduleEnabled && (
                      <div className="p-4 rounded-xl border bg-accent/10 space-y-4">
                        <div className="grid gap-2">
                          <Label className="text-xs font-bold">{t("rulesPage.activeDaysLabel")}</Label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map(day => (
                              <button
                                key={day.key}
                                type="button"
                                onClick={() => {
                                  setScheduleDays(prev =>
                                    prev.includes(day.key)
                                      ? prev.filter(d => d !== day.key)
                                      : [...prev, day.key]
                                  )
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                                  scheduleDays.includes(day.key)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-accent/30 text-muted-foreground border-border hover:border-primary/50'
                                }`}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-1">
                            <Label className="text-xs font-bold">{t("rulesPage.fromTimeLabel")}</Label>
                            <Input
                              type="time"
                              value={scheduleStartTime}
                              onChange={e => setScheduleStartTime(e.target.value)}
                              className="rounded-lg h-9 text-sm"
                              dir="ltr"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-bold">{t("rulesPage.toTimeLabel")}</Label>
                            <Input
                              type="time"
                              value={scheduleEndTime}
                              onChange={e => setScheduleEndTime(e.target.value)}
                              className="rounded-lg h-9 text-sm"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 border-t pt-4">
                    <Label className="text-lg font-black flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {t("rulesPage.replyContentLabel")}
                    </Label>

                    <div className="grid gap-4 mt-2">
                      <div className="grid gap-2">
                        <Label htmlFor="replyText" className="font-bold">{t("rulesPage.publicReplyLabel")}</Label>
                        <Textarea
                          id="replyText"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder={t("rulesPage.publicReplyPlaceholder")}
                          className="min-h-[90px] rounded-xl font-medium"
                        />
                        <p className="text-xs text-muted-foreground font-medium">
                          {t("rulesPage.variantsTip").split("|||").map((part, i, arr) => i < arr.length - 1 ? <span key={i}>{part}<code className="bg-accent px-1.5 py-0.5 rounded font-bold" dir="ltr">|||</code></span> : <span key={i}>{part}</span>)}
                        </p>
                      </div>

                      {/* Sequential Messages Switch */}
                      <div className="flex items-center justify-between p-4 rounded-xl border bg-accent/20">
                        <div className="space-y-0.5">
                          <Label className="font-bold text-sm">{t("rulesPage.sequentialToggleLabel")}</Label>
                          <p className="text-xs text-muted-foreground font-medium">{t("rulesPage.sequentialToggleHint")}</p>
                        </div>
                        <Switch
                          checked={isSequentialEnabled}
                          onCheckedChange={setIsSequentialEnabled}
                        />
                      </div>

                      {isSequentialEnabled ? (
                        /* Sequence Messages Builder */
                        <div className="space-y-4 border-t pt-4">
                          <div className="flex justify-between items-center">
                            <Label className="font-black text-base flex items-center gap-2 text-primary">
                              <MessageSquareText className="w-4 h-4" />
                              {t("rulesPage.sequenceMessagesLabel", { count: replyMessages.length })}
                            </Label>
                            {replyMessages.length < 5 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddMessage}
                                className="rounded-lg font-bold border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 ml-1" />
                                {t("rulesPage.addMessageBtn")}
                              </Button>
                            )}
                          </div>

                          <div className="space-y-4">
                            {replyMessages.map((msg, idx) => (
                              <div key={idx} className="p-4 border rounded-xl bg-card relative space-y-3 shadow-sm">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="font-bold text-sm text-muted-foreground">{t("rulesPage.messageNumberLabel", { n: idx + 1 })}</span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveMessageUp(idx)}
                                      disabled={idx === 0}
                                      className="h-7 w-7 rounded-md cursor-pointer"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveMessageDown(idx)}
                                      disabled={idx === replyMessages.length - 1}
                                      className="h-7 w-7 rounded-md cursor-pointer"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </Button>
                                    {replyMessages.length > 2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveMessage(idx)}
                                        className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* --- NEW: Delay input between sequential messages --- */}
                                {idx > 0 && (
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 border border-border/50">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{t("rulesPage.delayLabel")}</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={60}
                                      value={msg.delay ?? 1}
                                      onChange={(e) => handleUpdateMessageField(idx, "delay", Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
                                      className="h-7 w-16 text-xs rounded text-center"
                                      dir="ltr"
                                    />
                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{t("rulesPage.secondsBeforeSend")}</span>
                                  </div>
                                )}

                                <div className="grid gap-2">
                                  <Label className="text-xs font-bold">{t("rulesPage.messageTypeLabel")}</Label>
                                  <Select
                                    value={msg.type}
                                    items={{ TEXT: t("rulesPage.typeTextOption"), IMAGE: t("rulesPage.typeImageOption"), VIDEO: t("rulesPage.typeVideoOption"), CAROUSEL: t("rulesPage.typeCarouselOption"), QUICK_REPLIES: t("rulesPage.typeQuickRepliesOption") }}
                                    onValueChange={(val) => {
                                      const updated = [...replyMessages]
                                      const prevDelay = updated[idx].delay
                                      updated[idx] = { type: val }
                                      if (prevDelay !== undefined) updated[idx].delay = prevDelay
                                      if (val === "TEXT" || val === "QUICK_REPLIES") updated[idx].text = ""
                                      if (val === "IMAGE") {
                                        updated[idx].imageUrl = ""
                                        updated[idx].caption = ""
                                      }
                                      if (val === "VIDEO") {
                                        updated[idx].videoUrl = ""
                                        updated[idx].caption = ""
                                      }
                                      if (val === "CAROUSEL") {
                                        updated[idx].cards = [
                                          { title: "", subtitle: "", imageUrl: "", buttons: [{ type: "url", title: "", url: "" }] }
                                        ]
                                      }
                                      if (val === "QUICK_REPLIES") {
                                        updated[idx].replies = [{ title: "", payload: "" }]
                                      }
                                      setReplyMessages(updated)
                                    }}
                                  >
                                    <SelectTrigger className="rounded-lg h-9 text-xs">
                                      <SelectValue placeholder={t("rulesPage.selectTypePlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TEXT">{t("rulesPage.typeTextOption")}</SelectItem>
                                      <SelectItem value="IMAGE">{t("rulesPage.typeImageOption")}</SelectItem>
                                      <SelectItem value="VIDEO">{t("rulesPage.typeVideoOption")}</SelectItem>
                                      <SelectItem value="CAROUSEL">{t("rulesPage.typeCarouselOption")}</SelectItem>
                                      <SelectItem value="QUICK_REPLIES">{t("rulesPage.typeQuickRepliesOption")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {msg.type === "TEXT" && (
                                  <div className="grid gap-1">
                                    <Label className="text-xs font-bold">{t("rulesPage.messageTextLabel")}</Label>
                                    <Textarea
                                      value={msg.text || ""}
                                      onChange={(e) => handleUpdateMessageField(idx, "text", e.target.value)}
                                      placeholder={t("rulesPage.messageTextPlaceholder")}
                                      className="min-h-[70px] rounded-lg text-xs"
                                    />
                                  </div>
                                )}

                                {msg.type === "IMAGE" && (
                                  <div className="grid gap-2">
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">{t("rulesPage.imageUrlLabel")}</Label>
                                      <Input
                                        value={msg.imageUrl || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "imageUrl", e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                        className="h-9 rounded-lg text-xs"
                                      />
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">{t("rulesPage.imageCaptionLabel")}</Label>
                                      <Input
                                        value={msg.caption || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "caption", e.target.value)}
                                        placeholder={t("rulesPage.imageCaptionPlaceholder")}
                                        className="h-9 rounded-lg text-xs"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* --- NEW: VIDEO Message Type --- */}
                                {msg.type === "VIDEO" && (
                                  <div className="grid gap-2">
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">{t("rulesPage.videoUrlLabel")}</Label>
                                      <Input
                                        value={msg.videoUrl || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "videoUrl", e.target.value)}
                                        placeholder="https://example.com/video.mp4"
                                        className="h-9 rounded-lg text-xs"
                                        dir="ltr"
                                      />
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">{t("rulesPage.videoCaptionLabel")}</Label>
                                      <Input
                                        value={msg.caption || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "caption", e.target.value)}
                                        placeholder={t("rulesPage.videoCaptionPlaceholder")}
                                        className="h-9 rounded-lg text-xs"
                                      />
                                    </div>
                                    {/* Video Preview Placeholder */}
                                    {msg.videoUrl && (
                                      <div className="mt-1 rounded-xl overflow-hidden border border-border/50 bg-muted/30 flex items-center justify-center h-[120px] relative">
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                          <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                                            <Play className="w-6 h-6 text-primary-foreground fill-primary-foreground" />
                                          </div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded" dir="ltr">{msg.videoUrl.split('/').pop()}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {msg.type === "CAROUSEL" && (
                                  <div className="space-y-3 bg-accent/20 p-3 rounded-lg border">
                                    <div className="flex justify-between items-center">
                                      <Label className="text-xs font-bold">{t("rulesPage.cardsShownLabel", { count: msg.cards?.length || 0 })}</Label>
                                      {(msg.cards?.length || 0) < 5 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const updated = [...replyMessages]
                                            updated[idx].cards = [...(updated[idx].cards || []), { title: "", subtitle: "", imageUrl: "", buttons: [{ type: "url", title: "", url: "" }] }]
                                            setReplyMessages(updated)
                                          }}
                                          className="h-6 rounded text-[10px] font-bold text-primary hover:bg-primary/5 cursor-pointer"
                                        >
                                          {t("rulesPage.addCardBtn")}
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {(msg.cards || []).map((card: any, cIdx: number) => (
                                      <div key={cIdx} className="p-3 border rounded bg-card space-y-2 relative">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground border-b pb-1">
                                          <span>{t("rulesPage.cardNumberLabel", { n: cIdx + 1 })}</span>
                                          {(msg.cards || []).length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = [...replyMessages]
                                                updated[idx].cards.splice(cIdx, 1)
                                                setReplyMessages(updated)
                                              }}
                                              className="text-destructive hover:underline cursor-pointer"
                                            >
                                              {t("rulesPage.deleteCardBtn")}
                                            </button>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="grid gap-1">
                                            <Label className="text-[10px]">{t("rulesPage.mainTitleLabel")}</Label>
                                            <Input
                                              value={card.title || ""}
                                              onChange={(e) => {
                                                const updated = [...replyMessages]
                                                updated[idx].cards[cIdx].title = e.target.value
                                                setReplyMessages(updated)
                                              }}
                                              className="h-7 text-xs rounded"
                                            />
                                          </div>
                                          <div className="grid gap-1">
                                            <Label className="text-[10px]">{t("rulesPage.subtitleLabel")}</Label>
                                            <Input
                                              value={card.subtitle || ""}
                                              onChange={(e) => {
                                                const updated = [...replyMessages]
                                                updated[idx].cards[cIdx].subtitle = e.target.value
                                                setReplyMessages(updated)
                                              }}
                                              className="h-7 text-xs rounded"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid gap-1">
                                          <Label className="text-[10px]">{t("rulesPage.imageUrlLabel")}</Label>
                                          <Input
                                            value={card.imageUrl || ""}
                                            onChange={(e) => {
                                              const updated = [...replyMessages]
                                              updated[idx].cards[cIdx].imageUrl = e.target.value
                                              setReplyMessages(updated)
                                            }}
                                            className="h-7 text-xs rounded"
                                          />
                                        </div>

                                        {/* Carousel Card Buttons */}
                                        <div className="space-y-1 border-t pt-2">
                                          <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold">{t("rulesPage.cardButtonsLabel", { count: card.buttons?.length || 0 })}</span>
                                            {(card.buttons?.length || 0) < 3 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = [...replyMessages]
                                                  updated[idx].cards[cIdx].buttons = [...(updated[idx].cards[cIdx].buttons || []), { type: "url", title: "", url: "" }]
                                                  setReplyMessages(updated)
                                                }}
                                                className="text-primary hover:underline font-bold cursor-pointer"
                                              >
                                                {t("rulesPage.addButtonBtn")}
                                              </button>
                                            )}
                                          </div>
                                          {(card.buttons || []).map((btn: any, bIdx: number) => (
                                            <div key={bIdx} className="grid grid-cols-3 gap-1 items-center bg-accent/10 p-1.5 rounded">
                                              <Select
                                                value={btn.type}
                                                items={{ url: t("rulesPage.urlTypeOption"), postback: t("rulesPage.postbackTypeOption") }}
                                                onValueChange={(val) => {
                                                  const updated = [...replyMessages]
                                                  updated[idx].cards[cIdx].buttons[bIdx] = { type: val, title: "", [val === 'url' ? 'url' : 'payload']: "" }
                                                  setReplyMessages(updated)
                                                }}
                                              >
                                                <SelectTrigger className="h-6 text-[10px] px-1.5 rounded">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="url">{t("rulesPage.urlTypeOption")}</SelectItem>
                                                  <SelectItem value="postback">{t("rulesPage.postbackTypeOption")}</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <Input
                                                placeholder={t("rulesPage.buttonTitlePlaceholder")}
                                                value={btn.title || ""}
                                                onChange={(e) => {
                                                  const updated = [...replyMessages]
                                                  updated[idx].cards[cIdx].buttons[bIdx].title = e.target.value
                                                  setReplyMessages(updated)
                                                }}
                                                className="h-6 text-[10px] rounded px-1.5"
                                              />
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  placeholder={btn.type === 'url' ? t("rulesPage.linkPlaceholder") : t("rulesPage.payloadPlaceholder")}
                                                  value={btn.type === 'url' ? (btn.url || "") : (btn.payload || "")}
                                                  onChange={(e) => {
                                                    const updated = [...replyMessages]
                                                    if (btn.type === 'url') {
                                                      updated[idx].cards[cIdx].buttons[bIdx].url = e.target.value
                                                    } else {
                                                      updated[idx].cards[cIdx].buttons[bIdx].payload = e.target.value
                                                    }
                                                    setReplyMessages(updated)
                                                  }}
                                                  className="h-6 text-[10px] rounded px-1.5 flex-1"
                                                />
                                                {(card.buttons || []).length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const updated = [...replyMessages]
                                                      updated[idx].cards[cIdx].buttons.splice(bIdx, 1)
                                                      setReplyMessages(updated)
                                                    }}
                                                    className="text-destructive font-bold cursor-pointer text-xs"
                                                  >
                                                    ×
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {msg.type === "QUICK_REPLIES" && (
                                  <div className="space-y-3 bg-accent/20 p-3 rounded-lg border">
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">{t("rulesPage.promptTextLabel")}</Label>
                                      <Input
                                        value={msg.text || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "text", e.target.value)}
                                        placeholder={t("rulesPage.promptTextPlaceholder")}
                                        className="h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span>{t("rulesPage.quickReplyOptionsLabel", { count: msg.replies?.length || 0 })}</span>
                                        {(msg.replies?.length || 0) < 10 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...replyMessages]
                                              updated[idx].replies = [...(updated[idx].replies || []), { title: "", payload: "" }]
                                              setReplyMessages(updated)
                                            }}
                                            className="text-primary hover:underline font-bold cursor-pointer"
                                          >
                                            {t("rulesPage.addOptionBtn")}
                                          </button>
                                        )}
                                      </div>
                                      {(msg.replies || []).map((chip: any, rIdx: number) => (
                                        <div key={rIdx} className="grid grid-cols-2 gap-1 items-center bg-accent/10 p-1.5 rounded">
                                          <Input
                                            placeholder={t("rulesPage.optionTitlePlaceholder")}
                                            value={chip.title || ""}
                                            onChange={(e) => {
                                              const updated = [...replyMessages]
                                              updated[idx].replies[rIdx].title = e.target.value
                                              setReplyMessages(updated)
                                            }}
                                            className="h-7 text-xs rounded px-1.5"
                                          />
                                          <div className="flex items-center gap-1">
                                            <Input
                                              placeholder={t("rulesPage.payloadLabel2")}
                                              value={chip.payload || ""}
                                              onChange={(e) => {
                                                const updated = [...replyMessages]
                                                updated[idx].replies[rIdx].payload = e.target.value
                                                setReplyMessages(updated)
                                              }}
                                              className="h-7 text-xs rounded px-1.5 flex-1"
                                            />
                                            {(msg.replies || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = [...replyMessages]
                                                  updated[idx].replies.splice(rIdx, 1)
                                                  setReplyMessages(updated)
                                                }}
                                                className="text-destructive font-bold cursor-pointer text-xs"
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Legacy Fields */
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="privateText" className="flex items-center gap-1.5 font-bold">
                              <Send className="w-3.5 h-3.5 text-primary" />
                              {t("rulesPage.autoPrivateMessageLabel")}
                            </Label>
                            <Textarea
                              id="privateText"
                              value={privateText}
                              onChange={e => setPrivateText(e.target.value)}
                              placeholder={t("rulesPage.autoPrivateMessagePlaceholder")}
                              className="min-h-[80px] rounded-xl font-medium"
                            />
                            <p className="text-xs text-muted-foreground font-medium">{t("rulesPage.autoPrivateMessageHint")}</p>
                          </div>

                          <div className="grid gap-2">
                            <Label className="font-bold">{t("rulesPage.attachMediaLabel")}</Label>
                            <Select value={mediaType} onValueChange={(val) => setMediaType(val || "NONE")} items={{ NONE: t("rulesPage.noMediaOption"), IMAGE: t("rulesPage.imageOption"), VIDEO: t("rulesPage.videoOption") }}>
                              <SelectTrigger className="rounded-xl h-11 text-sm font-medium">
                                <SelectValue placeholder={t("rulesPage.selectAttachmentType")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">{t("rulesPage.noMediaOption")}</SelectItem>
                                <SelectItem value="IMAGE">{t("rulesPage.imageOption")}</SelectItem>
                                <SelectItem value="VIDEO">{t("rulesPage.videoOption")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {mediaType !== "NONE" && (
                            <div className="grid gap-2 p-4 border rounded-xl bg-accent/30">
                              <Label htmlFor="mediaUrl" className="font-bold">{t("rulesPage.mediaUrlLabel", { type: mediaType === 'IMAGE' ? t("rulesPage.mediaTypeImage") : t("rulesPage.mediaTypeVideo") })}</Label>
                              <Input 
                                id="mediaUrl" 
                                value={mediaUrl} 
                                onChange={e => setMediaUrl(e.target.value)} 
                                placeholder="https://example.com/image.jpg"
                                className="rounded-xl h-11"
                              />
                              {mediaUrl && (
                                <div className="mt-2 rounded-xl overflow-hidden border max-h-[200px] flex justify-center bg-muted/30">
                                  {mediaType === 'IMAGE' ? (
                                     
                                    <img src={mediaUrl} alt="Preview" className="max-h-[200px] object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                  ) : (
                                    <video src={mediaUrl} controls className="max-h-[200px] w-full" />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Preview Column */}
                {isSequentialEnabled && (
                  <div className="hidden lg:flex w-[350px] shrink-0 border-r border-border pr-6 flex-col gap-4 sticky top-0 self-start">
                    <div className="flex justify-between items-center">
                      <Label className="font-black text-sm flex items-center gap-1">
                        <Smartphone className="w-4 h-4 text-primary" />
                        {t("rulesPage.mobilePreviewLabel")}
                      </Label>
                      <div className="flex rounded-lg border overflow-hidden p-0.5 bg-muted">
                        <button
                          type="button"
                          onClick={() => setPreviewPlatform("MESSENGER")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${previewPlatform === 'MESSENGER' ? 'bg-primary text-black' : 'text-muted-foreground'}`}
                        >
                          Messenger
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewPlatform("WHATSAPP")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${previewPlatform === 'WHATSAPP' ? 'bg-primary text-black' : 'text-muted-foreground'}`}
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>

                    {/* Simulated Smartphone */}
                    <div className="w-[300px] h-[550px] border-8 border-slate-800 rounded-[36px] bg-slate-950 shadow-2xl relative overflow-hidden flex flex-col mx-auto select-none">
                      {/* Top Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20 flex justify-center items-center">
                        <div className="w-12 h-1.5 bg-slate-900 rounded-full mb-1"></div>
                      </div>

                      {/* Phone App Bar */}
                      <div className={`h-16 pt-6 px-4 flex items-center gap-2 border-b z-10 ${previewPlatform === 'MESSENGER' ? 'bg-[#0a0a0f] border-border text-white' : 'bg-[#005c4b] border-[#025143] text-white'}`}>
                        <ChevronRight className="w-4 h-4 shrink-0 rotate-180" />
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20 text-xs font-bold text-primary">
                          {t("rulesPage.botInitial")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{t("rulesPage.botAssistantName")}</p>
                          <p className="text-[9px] text-emerald-400 font-medium">{t("rulesPage.activeNowLabel")}</p>
                        </div>
                      </div>

                      {/* Chat Messages Area */}
                      <div className={`flex-1 overflow-y-auto p-3 space-y-3 flex flex-col justify-end text-xs leading-relaxed ${previewPlatform === 'MESSENGER' ? 'bg-[#030303]' : 'bg-[#efeae2]'}`} style={{ backgroundImage: previewPlatform === 'WHATSAPP' ? 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)' : 'none', backgroundSize: 'cover' }}>
                        
                        {/* Public comment reply (Simulated as first message if present) */}
                        {replyText && (
                          <div className="self-stretch bg-accent/20 p-2.5 rounded-lg border border-border/30 text-[10px] text-muted-foreground mb-2 text-right">
                            <span className="font-bold block text-foreground mb-1 text-xs">{t("rulesPage.publicCommentReplyLabel")}</span>
                            {replyText}
                          </div>
                        )}

                        {/* Sequence messages */}
                        {replyMessages.map((msg, mIdx) => {
                          if (msg.type === "TEXT" && msg.text) {
                            return (
                              <div
                                key={mIdx}
                                className={`p-2.5 max-w-[85%] rounded-2xl ${
                                  previewPlatform === 'MESSENGER'
                                    ? 'bg-primary text-black self-start rounded-tr-none'
                                    : 'bg-[#d9fdd3] text-[#111b21] self-start rounded-tl-none shadow-sm'
                                }`}
                              >
                                {msg.text}
                              </div>
                            )
                          }
                          if (msg.type === "IMAGE" && msg.imageUrl) {
                            return (
                              <div key={mIdx} className="space-y-1 max-w-[85%] self-start">
                                {msg.caption && (
                                  <div className={`p-2.5 rounded-2xl ${
                                    previewPlatform === 'MESSENGER' ? 'bg-primary text-black rounded-tr-none' : 'bg-[#d9fdd3] text-[#111b21] rounded-tl-none shadow-sm'
                                  }`}>
                                    {msg.caption}
                                  </div>
                                )}
                                <div className="rounded-xl overflow-hidden border border-border/30 max-h-[140px]">
                                  { }
                                  <img src={msg.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              </div>
                            )
                          }
                          {/* --- NEW: VIDEO preview in mobile --- */}
                          if (msg.type === "VIDEO" && msg.videoUrl) {
                            return (
                              <div key={mIdx} className="space-y-1 max-w-[85%] self-start">
                                {msg.caption && (
                                  <div className={`p-2.5 rounded-2xl ${
                                    previewPlatform === 'MESSENGER' ? 'bg-primary text-black rounded-tr-none' : 'bg-[#d9fdd3] text-[#111b21] rounded-tl-none shadow-sm'
                                  }`}>
                                    {msg.caption}
                                  </div>
                                )}
                                <div className="rounded-xl overflow-hidden border border-border/30 h-[120px] bg-black/60 flex items-center justify-center relative">
                                  <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center">
                                    <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
                                  </div>
                                  <span className="absolute bottom-1.5 left-1.5 text-[8px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded font-medium">{t("rulesPage.videoBadge")}</span>
                                </div>
                              </div>
                            )
                          }
                          if (msg.type === "CAROUSEL" && msg.cards && msg.cards.length > 0) {
                            return (
                              <div key={mIdx} className="flex gap-2 overflow-x-auto py-1 self-stretch max-w-[100%]">
                                {msg.cards.map((card: any, cIdx: number) => (
                                  <div key={cIdx} className="w-[180px] bg-slate-900 border border-border/50 rounded-xl overflow-hidden shrink-0 flex flex-col text-[10px]">
                                    {card.imageUrl && (
                                      <div className="h-[90px] w-full overflow-hidden bg-accent/20">
                                        { }
                                        <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    <div className="p-2 space-y-1 flex-1">
                                      <p className="font-bold text-white truncate">{card.title || t("rulesPage.cardTitleFallback")}</p>
                                      <p className="text-[9px] text-muted-foreground line-clamp-2">{card.subtitle || t("rulesPage.cardSubtitleFallback")}</p>
                                    </div>
                                    <div className="border-t border-border/50 flex flex-col shrink-0">
                                      {(card.buttons || []).map((btn: any, bIdx: number) => (
                                        <div key={bIdx} className="p-1.5 text-center text-primary font-bold border-b last:border-b-0 border-border/30 hover:bg-white/5 truncate">
                                          {btn.title || t("rulesPage.buttonFallback")}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                          if (msg.type === "QUICK_REPLIES" && msg.text) {
                            return (
                              <div key={mIdx} className="space-y-2 self-stretch flex flex-col items-start">
                                <div className={`p-2.5 max-w-[85%] rounded-2xl ${
                                  previewPlatform === 'MESSENGER' ? 'bg-primary text-black rounded-tr-none' : 'bg-[#d9fdd3] text-[#111b21] rounded-tl-none shadow-sm'
                                }`}>
                                  {msg.text}
                                </div>
                                <div className="flex gap-1.5 flex-wrap justify-start max-w-[100%]">
                                  {(msg.replies || []).map((reply: any, rIdx: number) => (
                                    <span
                                      key={rIdx}
                                      className={`px-3 py-1 rounded-full border text-[10px] font-bold text-primary border-primary bg-primary/10`}
                                    >
                                      {reply.title || t("rulesPage.optionFallback")}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>

                      {/* Message Input Simulator */}
                      <div className="h-12 border-t border-border bg-[#0a0a0f] shrink-0 flex items-center px-3 justify-between">
                        <div className="w-6 h-6 rounded-full bg-accent/20"></div>
                        <div className="flex-1 bg-accent/10 border border-border/30 h-7 mx-2 rounded-full px-3 text-[10px] text-muted-foreground flex items-center">
                          {t("rulesPage.typeMessagePlaceholder")}
                        </div>
                        <Send className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter className="sm:justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl cursor-pointer font-bold">{t("rulesPage.cancel")}</Button>
                <Button type="button" onClick={handleSaveRule} disabled={isSubmitting || !name || (!replyText && !privateText && !isSequentialEnabled) || (ruleType === 'POST' && !selectedPost && !postId)} className="rounded-xl gap-2 shadow-lg shadow-primary/20 cursor-pointer font-bold">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingRuleId ? t("rulesPage.updateAndActivate") : t("rulesPage.saveAndActivate")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* --- NEW: Search & Filter Bar --- */}
      {!isLoading && rules.length > 0 && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("rulesPage.searchPlaceholder")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-10 rounded-xl h-10 font-medium"
              />
            </div>

            {/* Filter by Type */}
            <Select value={filterType} onValueChange={(val) => setFilterType(val as typeof filterType)} items={{ ALL: t("rulesPage.allTypes"), GLOBAL: t("rulesPage.globalType"), POST: t("rulesPage.postType") }}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[160px] text-xs font-bold">
                <Filter className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder={t("rulesPage.typeFilterPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("rulesPage.allTypes")}</SelectItem>
                <SelectItem value="GLOBAL">{t("rulesPage.globalType")}</SelectItem>
                <SelectItem value="POST">{t("rulesPage.postType")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by Status */}
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as typeof filterStatus)} items={{ ALL: t("rulesPage.allStatuses"), ACTIVE: t("rulesPage.activeStatusOption"), INACTIVE: t("rulesPage.inactiveStatusOption") }}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[150px] text-xs font-bold">
                <ToggleRight className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder={t("rulesPage.statusFilterPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("rulesPage.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("rulesPage.activeStatusOption")}</SelectItem>
                <SelectItem value="INACTIVE">{t("rulesPage.inactiveStatusOption")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as typeof sortBy)} items={{ date: t("rulesPage.sortByDate"), name: t("rulesPage.sortByName"), triggers: t("rulesPage.sortByTriggers") }}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[150px] text-xs font-bold">
                <SelectValue placeholder={t("rulesPage.sortPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t("rulesPage.sortByDate")}</SelectItem>
                <SelectItem value="name">{t("rulesPage.sortByName")}</SelectItem>
                <SelectItem value="triggers">{t("rulesPage.sortByTriggers")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count + Bulk actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-xs font-bold text-muted-foreground">{t("rulesPage.selectAllLabel")}</span>
              <span className="text-xs text-muted-foreground font-medium">|</span>
              <span className="text-xs font-bold text-muted-foreground">
                {t("rulesPage.showingRulesCount", { shown: filteredRules.length, total: rules.length })}
              </span>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedRuleIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-bold">
                  <CheckSquare className="w-3 h-3 ml-1" />
                  {t("rulesPage.selectedCount", { count: selectedRuleIds.size })}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkActivate}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  {t("rulesPage.activateSelected")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                >
                  {t("rulesPage.deactivateSelected")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("rulesPage.deleteSelected")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground font-medium">{t("rulesPage.loadingRules")}</span>
          </div>
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none bg-accent/20">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mb-6 animate-float">
              <MessageSquareText className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-black mb-3">{t("rulesPage.noRulesYetTitle")}</h3>
            <p className="text-muted-foreground mb-8 max-w-md leading-relaxed font-medium">
              {t("rulesPage.noRulesYetDesc")}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl gap-2 h-12 px-8 shadow-lg shadow-primary/20 font-bold cursor-pointer">
              <Plus className="w-5 h-5" />
              {t("rulesPage.createFirstRule")}
            </Button>
          </CardContent>
        </Card>
      ) : filteredRules.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none bg-accent/20">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-black mb-2">{t("rulesPage.noResultsTitle")}</h3>
            <p className="text-muted-foreground text-sm font-medium">
              {t("rulesPage.noResultsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredRules.map((rule, index) => (
            <Card 
              key={rule.id} 
              className={`transition-all duration-300 hover:shadow-xl group animate-fade-in-up border-none shadow-lg relative ${
                !rule.isActive ? 'opacity-60 grayscale-[40%]' : ''
              } ${selectedRuleIds.has(rule.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {rule.isActive && (
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-primary to-[oklch(0.62_0.15_230)] rounded-t-lg" />
              )}
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {/* --- NEW: Selection checkbox --- */}
                  <Checkbox
                    checked={selectedRuleIds.has(rule.id)}
                    onCheckedChange={() => handleToggleSelect(rule.id)}
                  />
                  <div className="space-y-2 flex-1 min-w-0">
                    <CardTitle className="text-lg font-black flex items-center gap-2 flex-wrap">
                      <span className="truncate">{rule.name}</span>
                      {rule.postId && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">
                          <Target className="w-3 h-3 ml-1" />
                          {t("rulesPage.customBadge")}
                        </Badge>
                      )}
                      {rule.replyMessages && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 font-bold">
                          {t("rulesPage.sequentialBadge")}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 font-medium">
                      {rule.triggerType === 'KEYWORD' ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">{t("rulesPage.keywordsColonLabel")}</span>
                          <span className="font-bold text-foreground bg-accent px-2 py-0.5 rounded-md text-xs">{rule.keywords}</span>
                        </span>
                      ) : rule.triggerType === 'STORY_REPLY' ? (
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 text-muted-foreground" />
                          {t("rulesPage.storyReplyTriggerLabel")}
                        </span>
                      ) : rule.triggerType === 'STORY_MENTION' ? (
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                          {t("rulesPage.storyMentionTriggerLabel")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Globe2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {t("rulesPage.anyCommentTriggerLabel")}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* --- NEW: Clone/Duplicate button --- */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => handleCloneRule(rule)}
                    title={t("rulesPage.copyTooltip")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => handleEditRule(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                    <ToggleRight className={`w-4 h-4 ${rule.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-accent/50 p-4 rounded-xl text-sm border border-border/50 space-y-3">
                  <div>
                    <div className="font-bold mb-1 text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquareText className="w-3.5 h-3.5" />
                      {t("rulesPage.publicReplyCardLabel")}
                    </div>
                    <p className="line-clamp-2 leading-relaxed font-medium">{rule.replyText || <span className="italic text-muted-foreground">{t("rulesPage.withoutTextFallback")}</span>}</p>
                  </div>
                  
                  {rule.replyMessages ? (
                    <div>
                      <div className="font-bold mb-1 text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        {t("rulesPage.sequentialRepliesLabel")}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(() => {
                          const msgs = typeof rule.replyMessages === 'string' ? JSON.parse(rule.replyMessages) : rule.replyMessages
                          return (Array.isArray(msgs) ? msgs : []).map((m: any, mIdx: number) => (
                            <Badge key={mIdx} variant="outline" className="text-[10px] px-2 py-0.5 rounded bg-card text-primary font-bold">
                              {m.type === 'TEXT' ? t("rulesPage.typeTextBadge") : m.type === 'IMAGE' ? t("rulesPage.typeImageBadge") : m.type === 'VIDEO' ? t("rulesPage.typeVideoBadge") : m.type === 'CAROUSEL' ? t("rulesPage.typeCarouselBadge") : t("rulesPage.typeOptionsBadge")}
                            </Badge>
                          ))
                        })()}
                      </div>
                    </div>
                  ) : (
                    (rule.replyMedia || rule.privateText) && (
                      <div className="flex gap-2 flex-wrap">
                        {rule.replyMedia && (
                          <Badge variant="outline" className="gap-1.5 bg-card rounded-lg text-xs font-bold">
                            {typeof rule.replyMedia === 'string' && rule.replyMedia.includes('.mp4') ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                            {t("rulesPage.mediaAttachedBadge")}
                          </Badge>
                        )}
                        {rule.privateText && (
                          <Badge variant="outline" className="gap-1.5 bg-card rounded-lg text-xs text-primary border-primary/30 font-bold">
                            <Send className="w-3 h-3" />
                            {t("rulesPage.privateMessageBadge")}
                          </Badge>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Rules Analytics Display */}
                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/30 text-xs font-bold text-muted-foreground">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground/75">{t("rulesPage.totalTriggersLabel")}</span>
                    <span className="text-foreground text-sm font-black">{rule.triggerCount || 0}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground/75">{t("rulesPage.lastTriggeredLabel")}</span>
                    <span className="text-foreground truncate block font-black">{formatArabicDate(rule.lastTriggeredAt)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2.5">
                    <Switch 
                      checked={rule.isActive} 
                      onCheckedChange={() => toggleRuleActive(rule)} 
                    />
                    <span className={`text-sm font-bold ${rule.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {rule.isActive ? t("rulesPage.activeLabel") : t("rulesPage.inactiveLabel")}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: t("rulesPage.deleteRuleConfirmTitle"),
                        message: t("rulesPage.deleteRuleConfirmMessage", { name: rule.name }),
                        variant: "destructive",
                        confirmText: t("rulesPage.confirmDelete"),
                        cancelText: t("rulesPage.cancel")
                      })
                      if (confirmed) {
                        try {
                          await api.delete(`/rules/${rule.id}`)
                          fetchRules()
                          setBanner({ type: "success", text: t("rulesPage.ruleDeletedSuccess") })
                        } catch (error) {
                          console.error("Failed to delete", error)
                          setBanner({ type: "error", text: t("rulesPage.deleteRuleFailed") })
                        }
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

    {/* Predefined Templates Modal */}
    <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            {t("rulesPage.templatesLibraryBtn")}
          </DialogTitle>
          <DialogDescription className="font-medium">
            {t("rulesPage.templatesModalDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {["عام", "مطاعم", "عيادات", "متاجر"].map((sector) => {
            const sectorTemplates = PREDEFINED_TEMPLATES.filter(
              (tpl) => (tpl.sector || "عام") === sector
            )
            if (sectorTemplates.length === 0) return null
            const sectorEmoji: Record<string, string> = { "عام": "⚡", "مطاعم": "🍽️", "عيادات": "🩺", "متاجر": "🛍️" }
            const sectorLabelKeys: Record<string, string> = { "عام": "sectorGeneral", "مطاعم": "sectorRestaurants", "عيادات": "sectorClinics", "متاجر": "sectorStores" }
            return (
              <div key={sector} className="space-y-3">
                <h3 className="text-sm font-black text-muted-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                  <span>{sectorEmoji[sector]}</span>
                  {sector === "عام" ? t("rulesPage.generalTemplates") : t("rulesPage.sectorTemplates", { sector: t(`rulesPage.${sectorLabelKeys[sector]}`) })}
                </h3>
                {sectorTemplates.map((tpl, tIdx) => (
                  <Card key={tIdx} className="hover:border-primary/50 transition-all cursor-pointer bg-accent/15 border" onClick={() => applyTemplate(tpl)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-black text-primary">{tpl.name}</CardTitle>
                      <CardDescription className="font-medium text-xs text-muted-foreground">{tpl.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs font-medium">
                      <div>
                        <span className="text-muted-foreground">{t("rulesPage.keywordsColonLabel2")}</span>
                        <span className="font-bold text-foreground">{tpl.keywords}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("rulesPage.publicReplyColonLabel")}</span>
                        <span className="text-foreground line-clamp-1">{tpl.replyText}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-muted-foreground">{t("rulesPage.attachedMessageTypeLabel")}</span>
                        <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-black">
                          {t("rulesPage.sequentialMessagesCount", { count: tpl.replyMessages.length })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setIsTemplatesOpen(false)} className="rounded-xl cursor-pointer font-bold">{t("rulesPage.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Post Picker */}
    <PostPicker
      open={isPickerOpen}
      onOpenChange={setIsPickerOpen}
      onSelect={(post) => {
        setSelectedPost(post)
        setPostId("")
        setShowManualId(false)
      }}
    />

    {/* Banner */}
    {banner && (
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-bold shadow-lg animate-fade-in-up ${
        banner.type === "success"
          ? "bg-emerald-500/90 text-white"
          : "bg-destructive/90 text-white"
      }`}>
        <span>{banner.text}</span>
        <button onClick={() => setBanner(null)} className="p-1 hover:opacity-70 cursor-pointer">✕</button>
      </div>
    )}
  </>
  )
}
