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
  }
]

const DAYS_OF_WEEK = [
  { key: "sat", label: "السبت" },
  { key: "sun", label: "الأحد" },
  { key: "mon", label: "الإثنين" },
  { key: "tue", label: "الثلاثاء" },
  { key: "wed", label: "الأربعاء" },
  { key: "thu", label: "الخميس" },
  { key: "fri", label: "الجمعة" },
]

export default function RulesPage() {
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
      result.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
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
        triggerType: keywords ? "KEYWORD" : "ANY_COMMENT",
        postId: ruleType === "POST" && effectivePostId ? effectivePostId : null,
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
        setBanner({ type: "success", text: "✅ تم تحديث القاعدة بنجاح." })
      } else {
        await api.post("/rules", payload)
        setBanner({ type: "success", text: "✅ تم إنشاء القاعدة بنجاح." })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchRules()
    } catch (error) {
      console.error("Failed to save rule", error)
      setBanner({ type: "error", text: "فشل حفظ القاعدة. حاول مرة أخرى." })
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
    setRuleType(rule.postId ? "POST" : "GLOBAL")
    setPostId(rule.postId || "")
    if (rule.postId) {
      setSelectedPost({
        id: rule.postId,
        message: "تم اختيار هذا المنشور مسبقاً",
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
    setPostId("")
    setSelectedPost(null)
    setShowManualId(false)
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
    if (!dateStr) return "لم يتم التفعيل بعد"
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return "لم يتم التفعيل بعد"
      return new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date)
    } catch (e) {
      return "لم يتم التفعيل بعد"
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
        name: `نسخة من ${rule.name}`,
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
      showToast(`✅ تم نسخ قاعدة "${rule.name}" بنجاح`, "success")
      fetchRules()
    } catch (error) {
      console.error("Failed to clone rule", error)
      showToast("فشل نسخ القاعدة. حاول مرة أخرى.", "error")
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
      showToast(`✅ تم تفعيل ${ids.length} قاعدة بنجاح`, "success")
      setSelectedRuleIds(new Set())
      fetchRules()
    } catch (error) {
      console.error("Bulk activate failed", error)
      showToast("فشل تفعيل القواعد المحددة.", "error")
    }
  }

  const handleBulkDeactivate = async () => {
    try {
      const ids = Array.from(selectedRuleIds)
      await Promise.all(ids.map(id => api.put(`/rules/${id}`, { isActive: false })))
      showToast(`✅ تم تعطيل ${ids.length} قاعدة بنجاح`, "success")
      setSelectedRuleIds(new Set())
      fetchRules()
    } catch (error) {
      console.error("Bulk deactivate failed", error)
      showToast("فشل تعطيل القواعد المحددة.", "error")
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedRuleIds)
    const confirmed = await confirm({
      title: "تأكيد حذف القواعد المحددة",
      message: `هل أنت متأكد من حذف ${ids.length} قاعدة؟ سيتوقف الرد الآلي المرتبط بها فوراً.`,
      variant: "destructive",
      confirmText: "تأكيد الحذف",
      cancelText: "إلغاء"
    })
    if (confirmed) {
      try {
        await Promise.all(ids.map(id => api.delete(`/rules/${id}`)))
        showToast(`✅ تم حذف ${ids.length} قاعدة بنجاح`, "success")
        setSelectedRuleIds(new Set())
        fetchRules()
      } catch (error) {
        console.error("Bulk delete failed", error)
        showToast("فشل حذف القواعد المحددة.", "error")
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
            الردود الآلية
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">إدارة قواعد الرد الآلي على التعليقات والرسائل.</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setIsTemplatesOpen(true)}
            className="gap-2 rounded-xl px-5 h-11 font-bold border-primary/30 hover:bg-primary/10 cursor-pointer w-full sm:w-auto"
          >
            <LayoutGrid className="w-4 h-4 text-primary" />
            مكتبة القوالب الجاهزة
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger render={<Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl px-6 h-11 font-bold cursor-pointer w-full sm:w-auto" />}>
              <Plus className="w-4 h-4" />
              إضافة قاعدة جديدة
            </DialogTrigger>
            <DialogContent className={`${isSequentialEnabled ? 'sm:max-w-[1100px]' : 'sm:max-w-[650px]'} max-h-[90vh] overflow-y-auto transition-all duration-300`} dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">
                  {editingRuleId ? "تعديل قاعدة الرد الآلي" : "إنشاء قاعدة رد آلي جديدة"}
                </DialogTitle>
                <DialogDescription className="font-medium">
                  يمكنك تخصيص الرد ليكون عاماً لجميع المنشورات أو مخصصاً لمنشور محدد، مع دعم إرفاق الصور والفيديوهات والردود المتسلسلة.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex flex-col lg:flex-row gap-8 py-4">
                {/* Form Inputs Column */}
                <div className="flex-1 space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="font-bold">اسم القاعدة (للتنظيم الداخلي)</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: رد الخصومات 50%" className="rounded-xl h-11 font-medium" />
                  </div>

                  <div className="grid gap-2">
                    <Label className="font-bold">نطاق عمل القاعدة</Label>
                    <Tabs value={ruleType} onValueChange={setRuleType} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 rounded-xl h-11">
                        <TabsTrigger value="GLOBAL" className="rounded-lg gap-2 font-bold cursor-pointer">
                          <Globe2 className="w-4 h-4" />
                          رد عام
                        </TabsTrigger>
                        <TabsTrigger value="POST" className="rounded-lg gap-2 font-bold cursor-pointer">
                          <Target className="w-4 h-4" />
                          مخصص لمنشور
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="POST" className="pt-4 border-t mt-4">
                        <div className="grid gap-3">
                          {selectedPost ? (
                            <div className="flex gap-3 p-3 border rounded-xl bg-accent/30 items-start">
                              {selectedPost.picture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selectedPost.picture} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border" />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Newspaper className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold line-clamp-2">
                                  {selectedPost.message || <span className="italic text-muted-foreground">منشور بدون نص</span>}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                                  <MessageCircle className="w-3 h-3" />
                                  {selectedPost.commentsCount} تعليق · {selectedPost.channelName}
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
                              اختيار منشور من الصفحة
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground font-medium">
                            سيتم تنفيذ هذه القاعدة فقط عندما يعلق المستخدم على المنشور المحدد.
                          </p>

                          {!selectedPost && (
                            <div className="grid gap-2">
                              <button
                                type="button"
                                onClick={() => setShowManualId(!showManualId)}
                                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-right w-fit cursor-pointer font-medium"
                              >
                                {showManualId ? 'إخفاء الإدخال اليدوي' : 'أو أدخل معرف المنشور يدوياً (متقدم)'}
                              </button>
                              {showManualId && (
                                <Input
                                  id="postId"
                                  value={postId}
                                  onChange={e => setPostId(e.target.value)}
                                  placeholder="مثال: 123456789_987654321"
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

                  <div className="grid gap-2">
                    <Label htmlFor="keywords" className="font-bold">الكلمات المفتاحية (اختياري)</Label>
                    <Input id="keywords" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="مثال: تفاصيل، السعر، بكم (افصل بفاصلة)" className="rounded-xl h-11 font-medium" />
                    <p className="text-xs text-muted-foreground font-medium">إذا تركتها فارغة، سيتم الرد على أي تعليق.</p>

                    {/* --- NEW: Keyword Conflict Warnings --- */}
                    {keywordConflicts.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {keywordConflicts.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>تنبيه: الكلمة &lsquo;{c.keyword}&rsquo; مستخدمة أيضاً في قاعدة &lsquo;{c.ruleName}&rsquo;</span>
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
                          جدولة زمنية
                        </Label>
                        <p className="text-xs text-muted-foreground font-medium">تفعيل القاعدة فقط في أوقات وأيام محددة.</p>
                      </div>
                      <Switch
                        checked={scheduleEnabled}
                        onCheckedChange={setScheduleEnabled}
                      />
                    </div>

                    {scheduleEnabled && (
                      <div className="p-4 rounded-xl border bg-accent/10 space-y-4">
                        <div className="grid gap-2">
                          <Label className="text-xs font-bold">أيام التفعيل</Label>
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
                            <Label className="text-xs font-bold">من الساعة</Label>
                            <Input
                              type="time"
                              value={scheduleStartTime}
                              onChange={e => setScheduleStartTime(e.target.value)}
                              className="rounded-lg h-9 text-sm"
                              dir="ltr"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-bold">إلى الساعة</Label>
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
                      محتوى الرد
                    </Label>

                    <div className="grid gap-4 mt-2">
                      <div className="grid gap-2">
                        <Label htmlFor="replyText" className="font-bold">الرد العلني على التعليق</Label>
                        <Textarea
                          id="replyText"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="مرحباً! تفضل التفاصيل..."
                          className="min-h-[90px] rounded-xl font-medium"
                        />
                        <p className="text-xs text-muted-foreground font-medium">
                          💡 نصيحة: اكتب عدة صيغ مفصولة بـ <code className="bg-accent px-1.5 py-0.5 rounded font-bold" dir="ltr">|||</code> وسيُرسل واحدة عشوائياً كل مرة.
                        </p>
                      </div>

                      {/* Sequential Messages Switch */}
                      <div className="flex items-center justify-between p-4 rounded-xl border bg-accent/20">
                        <div className="space-y-0.5">
                          <Label className="font-bold text-sm">تفعيل الردود المتسلسلة (إرسال عدة رسائل)</Label>
                          <p className="text-xs text-muted-foreground font-medium">إرسال تسلسل رسائل متعددة للعميل في الخاص بدلاً من رسالة واحدة.</p>
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
                              تسلسل الرسائل الخاصة ({replyMessages.length} من 5)
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
                                إضافة رسالة
                              </Button>
                            )}
                          </div>

                          <div className="space-y-4">
                            {replyMessages.map((msg, idx) => (
                              <div key={idx} className="p-4 border rounded-xl bg-card relative space-y-3 shadow-sm">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="font-bold text-sm text-muted-foreground">الرسالة #{idx + 1}</span>
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
                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">تأخير</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={60}
                                      value={msg.delay ?? 1}
                                      onChange={(e) => handleUpdateMessageField(idx, "delay", Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
                                      className="h-7 w-16 text-xs rounded text-center"
                                      dir="ltr"
                                    />
                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">ثانية قبل إرسال هذه الرسالة</span>
                                  </div>
                                )}

                                <div className="grid gap-2">
                                  <Label className="text-xs font-bold">نوع الرسالة</Label>
                                  <Select 
                                    value={msg.type} 
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
                                      <SelectValue placeholder="اختر النوع" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TEXT">نصي (TEXT)</SelectItem>
                                      <SelectItem value="IMAGE">صورة (IMAGE)</SelectItem>
                                      <SelectItem value="VIDEO">فيديو (VIDEO)</SelectItem>
                                      <SelectItem value="CAROUSEL">كارت متحرك (CAROUSEL)</SelectItem>
                                      <SelectItem value="QUICK_REPLIES">ردود سريعة (QUICK REPLIES)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {msg.type === "TEXT" && (
                                  <div className="grid gap-1">
                                    <Label className="text-xs font-bold">نص الرسالة</Label>
                                    <Textarea
                                      value={msg.text || ""}
                                      onChange={(e) => handleUpdateMessageField(idx, "text", e.target.value)}
                                      placeholder="مرحباً! كيف يمكنني مساعدتك؟"
                                      className="min-h-[70px] rounded-lg text-xs"
                                    />
                                  </div>
                                )}

                                {msg.type === "IMAGE" && (
                                  <div className="grid gap-2">
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">رابط الصورة</Label>
                                      <Input
                                        value={msg.imageUrl || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "imageUrl", e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                        className="h-9 rounded-lg text-xs"
                                      />
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">شرح الصورة (Caption) - اختياري</Label>
                                      <Input
                                        value={msg.caption || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "caption", e.target.value)}
                                        placeholder="شاهد منتجاتنا الحصرية"
                                        className="h-9 rounded-lg text-xs"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* --- NEW: VIDEO Message Type --- */}
                                {msg.type === "VIDEO" && (
                                  <div className="grid gap-2">
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">رابط الفيديو</Label>
                                      <Input
                                        value={msg.videoUrl || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "videoUrl", e.target.value)}
                                        placeholder="https://example.com/video.mp4"
                                        className="h-9 rounded-lg text-xs"
                                        dir="ltr"
                                      />
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-xs font-bold">شرح الفيديو (Caption) - اختياري</Label>
                                      <Input
                                        value={msg.caption || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "caption", e.target.value)}
                                        placeholder="شاهد الفيديو التوضيحي"
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
                                      <Label className="text-xs font-bold">الكروت المعروضة ({msg.cards?.length || 0})</Label>
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
                                          + إضافة كارت
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {(msg.cards || []).map((card: any, cIdx: number) => (
                                      <div key={cIdx} className="p-3 border rounded bg-card space-y-2 relative">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground border-b pb-1">
                                          <span>الكارت #{cIdx + 1}</span>
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
                                              حذف الكارت
                                            </button>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="grid gap-1">
                                            <Label className="text-[10px]">العنوان الرئيسي</Label>
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
                                            <Label className="text-[10px]">العنوان الفرعي</Label>
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
                                          <Label className="text-[10px]">رابط الصورة</Label>
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
                                            <span className="font-bold">أزرار الكارت ({card.buttons?.length || 0})</span>
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
                                                + إضافة زر
                                              </button>
                                            )}
                                          </div>
                                          {(card.buttons || []).map((btn: any, bIdx: number) => (
                                            <div key={bIdx} className="grid grid-cols-3 gap-1 items-center bg-accent/10 p-1.5 rounded">
                                              <Select
                                                value={btn.type}
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
                                                  <SelectItem value="url">رابط URL</SelectItem>
                                                  <SelectItem value="postback">حدث Postback</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <Input
                                                placeholder="عنوان الزر"
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
                                                  placeholder={btn.type === 'url' ? "رابط" : "حمولة حدث"}
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
                                      <Label className="text-xs font-bold">نص التوجيه (Prompt Text)</Label>
                                      <Input
                                        value={msg.text || ""}
                                        onChange={(e) => handleUpdateMessageField(idx, "text", e.target.value)}
                                        placeholder="اختر أحد الخيارات للبدء:"
                                        className="h-8 text-xs rounded-lg"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-bold">
                                        <span>خيارات الرد السريع ({msg.replies?.length || 0})</span>
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
                                            + إضافة خيار
                                          </button>
                                        )}
                                      </div>
                                      {(msg.replies || []).map((chip: any, rIdx: number) => (
                                        <div key={rIdx} className="grid grid-cols-2 gap-1 items-center bg-accent/10 p-1.5 rounded">
                                          <Input
                                            placeholder="عنوان الخيار"
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
                                              placeholder="الحمولة Payload"
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
                              رسالة خاصة تلقائية (Comment-to-DM)
                            </Label>
                            <Textarea
                              id="privateText"
                              value={privateText}
                              onChange={e => setPrivateText(e.target.value)}
                              placeholder="أهلاً! أرسلنا لك التفاصيل هنا على الخاص..."
                              className="min-h-[80px] rounded-xl font-medium"
                            />
                            <p className="text-xs text-muted-foreground font-medium">تُرسل تلقائياً على ماسنجر لصاحب التعليق. اتركها فارغة إذا لا تريد إرسال رسالة خاصة.</p>
                          </div>

                          <div className="grid gap-2">
                            <Label className="font-bold">إرفاق وسائط (صورة/فيديو)</Label>
                            <Select value={mediaType} onValueChange={(val) => setMediaType(val || "NONE")}>
                              <SelectTrigger className="rounded-xl h-11 text-sm font-medium">
                                <SelectValue placeholder="اختر نوع المرفق" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">بدون وسائط</SelectItem>
                                <SelectItem value="IMAGE">صورة (Image)</SelectItem>
                                <SelectItem value="VIDEO">فيديو (Video)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {mediaType !== "NONE" && (
                            <div className="grid gap-2 p-4 border rounded-xl bg-accent/30">
                              <Label htmlFor="mediaUrl" className="font-bold">رابط الـ {mediaType === 'IMAGE' ? 'صورة' : 'فيديو'}</Label>
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
                                    // eslint-disable-next-line @next/next/no-img-element
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
                        معاينة الهاتف المحمول
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
                          آلي
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">مساعد حبقة</p>
                          <p className="text-[9px] text-emerald-400 font-medium">نشط الآن</p>
                        </div>
                      </div>

                      {/* Chat Messages Area */}
                      <div className={`flex-1 overflow-y-auto p-3 space-y-3 flex flex-col justify-end text-xs leading-relaxed ${previewPlatform === 'MESSENGER' ? 'bg-[#030303]' : 'bg-[#efeae2]'}`} style={{ backgroundImage: previewPlatform === 'WHATSAPP' ? 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)' : 'none', backgroundSize: 'cover' }}>
                        
                        {/* Public comment reply (Simulated as first message if present) */}
                        {replyText && (
                          <div className="self-stretch bg-accent/20 p-2.5 rounded-lg border border-border/30 text-[10px] text-muted-foreground mb-2 text-right">
                            <span className="font-bold block text-foreground mb-1 text-xs">💬 رد علني على تعليق العميل:</span>
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
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                  <span className="absolute bottom-1.5 left-1.5 text-[8px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded font-medium">فيديو</span>
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
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    <div className="p-2 space-y-1 flex-1">
                                      <p className="font-bold text-white truncate">{card.title || "عنوان الكارت"}</p>
                                      <p className="text-[9px] text-muted-foreground line-clamp-2">{card.subtitle || "وصف الكارت"}</p>
                                    </div>
                                    <div className="border-t border-border/50 flex flex-col shrink-0">
                                      {(card.buttons || []).map((btn: any, bIdx: number) => (
                                        <div key={bIdx} className="p-1.5 text-center text-primary font-bold border-b last:border-b-0 border-border/30 hover:bg-white/5 truncate">
                                          {btn.title || "زر"}
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
                                      {reply.title || "خيار"}
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
                          اكتب رسالة...
                        </div>
                        <Send className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter className="sm:justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl cursor-pointer font-bold">إلغاء</Button>
                <Button type="button" onClick={handleSaveRule} disabled={isSubmitting || !name || (!replyText && !privateText && !isSequentialEnabled) || (ruleType === 'POST' && !selectedPost && !postId)} className="rounded-xl gap-2 shadow-lg shadow-primary/20 cursor-pointer font-bold">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingRuleId ? "تحديث وتفعيل" : "حفظ وتفعيل"}
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
                placeholder="ابحث بالاسم أو الكلمات المفتاحية..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-10 rounded-xl h-10 font-medium"
              />
            </div>

            {/* Filter by Type */}
            <Select value={filterType} onValueChange={(val) => setFilterType(val as typeof filterType)}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[160px] text-xs font-bold">
                <Filter className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">جميع الأنواع</SelectItem>
                <SelectItem value="GLOBAL">عام (GLOBAL)</SelectItem>
                <SelectItem value="POST">مخصص لمنشور (POST)</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by Status */}
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as typeof filterStatus)}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[150px] text-xs font-bold">
                <ToggleRight className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">جميع الحالات</SelectItem>
                <SelectItem value="ACTIVE">مفعلة</SelectItem>
                <SelectItem value="INACTIVE">معطلة</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as typeof sortBy)}>
              <SelectTrigger className="rounded-xl h-10 w-full sm:w-[150px] text-xs font-bold">
                <SelectValue placeholder="ترتيب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">تاريخ الإنشاء</SelectItem>
                <SelectItem value="name">الاسم</SelectItem>
                <SelectItem value="triggers">عدد التفعيلات</SelectItem>
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
              <span className="text-xs font-bold text-muted-foreground">تحديد الكل</span>
              <span className="text-xs text-muted-foreground font-medium">|</span>
              <span className="text-xs font-bold text-muted-foreground">
                عرض {filteredRules.length} من {rules.length} قاعدة
              </span>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedRuleIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-bold">
                  <CheckSquare className="w-3 h-3 ml-1" />
                  {selectedRuleIds.size} محددة
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkActivate}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  تفعيل المحددة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                >
                  تعطيل المحددة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="rounded-lg text-xs font-bold h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  حذف المحددة
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
            <span className="text-sm text-muted-foreground font-medium">جاري تحميل القواعد...</span>
          </div>
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none bg-accent/20">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mb-6 animate-float">
              <MessageSquareText className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-black mb-3">لا توجد قواعد بعد</h3>
            <p className="text-muted-foreground mb-8 max-w-md leading-relaxed font-medium">
              لم تقم بإنشاء أي قواعد للرد الآلي. ابدأ بإنشاء قاعدة للرد على تعليقات عملائك تلقائياً وباحترافية.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl gap-2 h-12 px-8 shadow-lg shadow-primary/20 font-bold cursor-pointer">
              <Plus className="w-5 h-5" />
              إنشاء قاعدتك الأولى
            </Button>
          </CardContent>
        </Card>
      ) : filteredRules.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none bg-accent/20">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-black mb-2">لا توجد نتائج</h3>
            <p className="text-muted-foreground text-sm font-medium">
              لا توجد قواعد تطابق معايير البحث الحالية. حاول تعديل عوامل التصفية.
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
                          مخصص
                        </Badge>
                      )}
                      {rule.replyMessages && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 font-bold">
                          متسلسل
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 font-medium">
                      {rule.triggerType === 'KEYWORD' ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">كلمات:</span>
                          <span className="font-bold text-foreground bg-accent px-2 py-0.5 rounded-md text-xs">{rule.keywords}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Globe2 className="w-3.5 h-3.5 text-muted-foreground" />
                          الرد على أي تعليق
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
                    title="نسخ"
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
                      الرد العلني
                    </div>
                    <p className="line-clamp-2 leading-relaxed font-medium">{rule.replyText || <span className="italic text-muted-foreground">بدون نص</span>}</p>
                  </div>
                  
                  {rule.replyMessages ? (
                    <div>
                      <div className="font-bold mb-1 text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        الردود المتسلسلة
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(() => {
                          const msgs = typeof rule.replyMessages === 'string' ? JSON.parse(rule.replyMessages) : rule.replyMessages
                          return (Array.isArray(msgs) ? msgs : []).map((m: any, mIdx: number) => (
                            <Badge key={mIdx} variant="outline" className="text-[10px] px-2 py-0.5 rounded bg-card text-primary font-bold">
                              {m.type === 'TEXT' ? 'نص' : m.type === 'IMAGE' ? 'صورة' : m.type === 'VIDEO' ? 'فيديو' : m.type === 'CAROUSEL' ? 'كاروسيل' : 'خيارات'}
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
                            مرفق وسائط
                          </Badge>
                        )}
                        {rule.privateText && (
                          <Badge variant="outline" className="gap-1.5 bg-card rounded-lg text-xs text-primary border-primary/30 font-bold">
                            <Send className="w-3 h-3" />
                            رسالة خاصة
                          </Badge>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Rules Analytics Display */}
                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/30 text-xs font-bold text-muted-foreground">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground/75">إجمالي التفعيلات</span>
                    <span className="text-foreground text-sm font-black">{rule.triggerCount || 0}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground/75">آخر تفعيل</span>
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
                      {rule.isActive ? 'مفعل' : 'معطل'}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: "تأكيد حذف القاعدة",
                        message: `هل أنت متأكد من حذف قاعدة "${rule.name}"؟ سيتوقف الرد الآلي المرتبط بها فوراً.`,
                        variant: "destructive",
                        confirmText: "تأكيد الحذف",
                        cancelText: "إلغاء"
                      })
                      if (confirmed) {
                        try {
                          await api.delete(`/rules/${rule.id}`)
                          fetchRules()
                          setBanner({ type: "success", text: "✅ تم حذف القاعدة بنجاح." })
                        } catch (error) {
                          console.error("Failed to delete", error)
                          setBanner({ type: "error", text: "فشل حذف القاعدة. حاول مرة أخرى." })
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
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            مكتبة القوالب الجاهزة
          </DialogTitle>
          <DialogDescription className="font-medium">
            اختر قالباً جاهزاً من المكتبة لتعبئة النموذج وتفعيل قاعدة الرد الآلي في ثوانٍ معدودة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {PREDEFINED_TEMPLATES.map((tpl, tIdx) => (
            <Card key={tIdx} className="hover:border-primary/50 transition-all cursor-pointer bg-accent/15 border" onClick={() => applyTemplate(tpl)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black text-primary">{tpl.name}</CardTitle>
                <CardDescription className="font-medium text-xs text-muted-foreground">{tpl.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-medium">
                <div>
                  <span className="text-muted-foreground">الكلمات المفتاحية: </span>
                  <span className="font-bold text-foreground">{tpl.keywords}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">الرد العلني: </span>
                  <span className="text-foreground line-clamp-1">{tpl.replyText}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-muted-foreground">نوع الرسائل المرفقة: </span>
                  <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-black">
                    متسلسل ({tpl.replyMessages.length} رسائل)
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setIsTemplatesOpen(false)} className="rounded-xl cursor-pointer font-bold">إغلاق</Button>
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
