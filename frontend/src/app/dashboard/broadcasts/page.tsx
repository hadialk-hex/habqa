"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import api from "@/lib/api"
import { 
  Megaphone, Users, Calendar, AlertTriangle, Eye, Send, Ban, 
  CheckCircle2, RefreshCw, BarChart2, Plus, Search, 
  MessageCircle, Globe, Camera, ChevronLeft, ChevronRight, X 
} from "lucide-react"

export default function BroadcastsPage() {
  const [mounted, setMounted] = useState(false)
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [targetType, setTargetType] = useState<"all" | "tag">("all")
  const [customTag, setCustomTag] = useState("")
  const [selectedChannelId, setSelectedChannelId] = useState("")
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Details State
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)

  const itemsPerPage = 6

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true)
      const res = await api.get("/broadcasts")
      setCampaigns(res.data)
    } catch (err) {
      console.error("Error fetching campaigns:", err)
      showToast("فشل في تحميل الحملات الإعلانية", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchChannels = async () => {
    try {
      const res = await api.get("/channels")
      setChannels(res.data)
      if (res.data.length > 0) {
        setSelectedChannelId(res.data[0].id)
      }
    } catch (err) {
      console.error("Error fetching channels:", err)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchCampaigns()
    fetchChannels()
  }, [])

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast("يرجى إدخال اسم الحملة", "error")
      return
    }
    if (!content.trim()) {
      showToast("يرجى إدخال محتوى الرسالة", "error")
      return
    }

    const segmentTarget = targetType === "all" ? "all" : customTag.trim()
    if (targetType === "tag" && !segmentTarget) {
      showToast("يرجى تحديد الوسم المستهدف", "error")
      return
    }

    let scheduledTimeStr: string | undefined = undefined
    if (isScheduled) {
      if (!scheduledAt) {
        showToast("يرجى تحديد وقت الجدولة", "error")
        return
      }
      const date = new Date(scheduledAt)
      if (isNaN(date.getTime()) || date.getTime() < Date.now()) {
        showToast("يجب أن يكون وقت الجدولة في المستقبل", "error")
        return
      }
      scheduledTimeStr = date.toISOString()
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name,
        content,
        segmentTarget,
        scheduledAt: scheduledTimeStr,
      }
      const res = await api.post("/broadcasts", payload)
      showToast(isScheduled ? "تمت جدولة الحملة بنجاح" : "تم إنشاء الحملة بنجاح كمسودة", "success")
      setIsCreateOpen(false)
      // reset form
      setName("")
      setContent("")
      setTargetType("all")
      setCustomTag("")
      setIsScheduled(false)
      setScheduledAt("")
      fetchCampaigns()
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "فشل إنشاء الحملة"
      showToast(errMsg, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExecute = async (id: string) => {
    const confirmed = await confirm({
      title: "بدء بث الحملة الإعلانية",
      message: "هل أنت متأكد من رغبتك في إرسال هذه الحملة فوراً للمشتركين المستهدفين؟",
      confirmText: "نعم، أرسل الآن",
      cancelText: "تراجع",
      variant: "primary"
    })
    if (!confirmed) return

    try {
      await api.post(`/broadcasts/${id}/execute`)
      showToast("تم إرسال الحملة بنجاح", "success")
      fetchCampaigns()
    } catch (err) {
      showToast("فشل إرسال الحملة", "error")
    }
  }

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: "إلغاء جدولة الحملة",
      message: "هل أنت متأكد من رغبتك في إلغاء هذه الحملة المجدولة؟",
      confirmText: "نعم، إلغاء",
      cancelText: "تراجع",
      variant: "destructive"
    })
    if (!confirmed) return

    try {
      await api.post(`/broadcasts/${id}/cancel`)
      showToast("تم إلغاء جدولة الحملة", "success")
      fetchCampaigns()
    } catch (err) {
      showToast("فشل إلغاء الحملة", "error")
    }
  }

  const viewDetails = (campaign: any) => {
    setSelectedCampaign(campaign)
    setIsDetailsOpen(true)
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "WHATSAPP":
        return <MessageCircle className="w-4 h-4 text-[#25D366]" />
      case "INSTAGRAM":
        return <Camera className="w-4 h-4 text-primary" />
      default:
        return <Globe className="w-4 h-4 text-secondary" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">مكتملة</Badge>
      case "SCHEDULED":
        return <Badge className="bg-secondary/15 text-secondary border border-secondary/20 rounded-lg">مجدولة</Badge>
      case "CANCELLED":
        return <Badge className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">ملغاة</Badge>
      default:
        return <Badge className="bg-muted text-muted-foreground border border-border rounded-lg">مسودة</Badge>
    }
  }

  // Filters
  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.content && c.content.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (activeTab === "all") return matchesSearch
    return c.status === activeTab && matchesSearch
  })

  // Pagination
  const pageCount = Math.ceil(filteredCampaigns.length / itemsPerPage)
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Welcome & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" />
            الحملات الإعلانية وبث الرسائل
          </h1>
          <p className="text-muted-foreground mt-1 text-base">إدارة حملات البث الموجهة والمجدولة للمشتركين</p>
        </div>

        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          حملة جديدة
        </Button>
      </div>

      {/* Tabs and Search Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 p-4 rounded-2xl border border-border/50">
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setCurrentPage(1); }} className="w-full md:w-auto">
          <TabsList className="bg-accent/40 rounded-xl p-1 flex gap-1">
            <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-4 py-2 cursor-pointer">الكل</TabsTrigger>
            <TabsTrigger value="DRAFT" className="rounded-lg text-xs font-bold px-4 py-2 cursor-pointer">مسودات</TabsTrigger>
            <TabsTrigger value="SCHEDULED" className="rounded-lg text-xs font-bold px-4 py-2 cursor-pointer">المجدولة</TabsTrigger>
            <TabsTrigger value="SENT" className="rounded-lg text-xs font-bold px-4 py-2 cursor-pointer">المرسلة</TabsTrigger>
            <TabsTrigger value="CANCELLED" className="rounded-lg text-xs font-bold px-4 py-2 cursor-pointer">الملغاة</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="بحث في محتوى الحملة..." 
            className="pr-10 bg-accent/30 border-border/50 rounded-xl text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <span className="text-muted-foreground text-sm font-medium">جاري تحميل الحملات...</span>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="border-none shadow-md bg-card/20 py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="p-4 bg-accent/20 rounded-full">
              <Megaphone className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg">لا توجد حملات إعلانية</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              لم نجد أي حملات مطابقة لبحثك. يمكنك بدء إنشاء حملتك الإعلانية الأولى الآن ببث رسائل للمشتركين.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="rounded-xl mt-2 cursor-pointer">
              إنشاء حملتك الأولى
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedCampaigns.map((c, index) => (
              <Card 
                key={c.id} 
                className="border-none shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden bg-card/30 flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                        {getPlatformIcon(channels.find(ch => ch.id === c.connectionId)?.platform || "FACEBOOK_PAGE")}
                        <span>{channels.find(ch => ch.id === c.connectionId)?.name || "صفحة البث"}</span>
                      </div>
                      {getStatusBadge(c.status)}
                    </div>
                    <CardTitle className="text-lg font-black truncate">{c.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed mt-1 text-muted-foreground">
                      {c.content}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pb-4 pt-1 space-y-3.5 border-t border-border/30 mt-1">
                    <div className="flex justify-between text-xs font-bold text-muted-foreground">
                      <span>الجمهور المستهدف:</span>
                      <Badge variant="outline" className="text-[10px] font-semibold border-border/80 text-foreground">
                        {c.segmentTarget === "all" ? "جميع المشتركين" : `@${c.segmentTarget}`}
                      </Badge>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-muted-foreground">
                      <span>تاريخ الإنشاء:</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}</span>
                    </div>

                    {c.status === "SCHEDULED" && c.scheduledAt && (
                      <div className="flex justify-between text-xs font-bold text-[#22d3ee] bg-secondary/5 p-2 rounded-lg border border-secondary/15">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> وقت البث:</span>
                        <span>{new Date(c.scheduledAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    )}

                    {c.status === "SENT" && (
                      <div className="grid grid-cols-2 gap-2 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                        <div className="text-center">
                          <p className="text-sm font-black text-emerald-400">{c.sentCount}</p>
                          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">مرسلة</p>
                        </div>
                        <div className="text-center border-r border-border/30">
                          <p className="text-sm font-black text-emerald-400">{c.deliveredCount}</p>
                          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">مستلمة</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-4 pt-0 flex gap-2 border-t border-border/20 mt-auto">
                  <Button 
                    onClick={() => viewDetails(c)} 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 rounded-xl text-xs font-bold hover:bg-accent/40 cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    عرض التفاصيل
                  </Button>

                  {c.status === "DRAFT" && (
                    <Button 
                      onClick={() => handleExecute(c.id)} 
                      size="sm" 
                      className="flex-1 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5 text-[#0a0a0f]" />
                      إرسال الآن
                    </Button>
                  )}

                  {c.status === "SCHEDULED" && (
                    <Button 
                      onClick={() => handleCancel(c.id)} 
                      variant="destructive"
                      size="sm" 
                      className="flex-1 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      إلغاء الجدولة
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button 
                variant="outline"
                size="icon" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-xl cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold text-muted-foreground">
                صفحة {currentPage} من {pageCount}
              </span>
              <Button 
                variant="outline"
                size="icon" 
                onClick={() => setCurrentPage(prev => Math.min(pageCount, prev + 1))}
                disabled={currentPage === pageCount}
                className="rounded-xl cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal Wizard */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px] border-none bg-card/95 backdrop-blur shadow-2xl p-6 rounded-2xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black">إنشاء حملة بث جديدة</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              املأ البيانات لبدء إرسال رسائل جماعية للشرائح المستهدفة.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCampaign} className="space-y-4.5 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">اسم الحملة الإعلانية</Label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: خصومات نهاية الأسبوع للعملاء المميزين"
                className="bg-accent/40 border-border/50 rounded-xl text-xs placeholder:text-muted-foreground/50 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">قناة البث</Label>
              {channels.length === 0 ? (
                <div className="text-xs text-destructive bg-destructive/5 p-3 rounded-xl border border-destructive/10 font-bold">
                  لم تقم بربط أي قنوات تواصل بعد! يرجى ربط قناة من صفحة "قنوات التواصل" أولاً لتتمكن من البث.
                </div>
              ) : (
                <Select value={selectedChannelId} onValueChange={(val) => setSelectedChannelId(val || "")}>
                  <SelectTrigger className="bg-accent/40 border-border/50 rounded-xl text-xs text-right">
                    <SelectValue placeholder="اختر قناة التواصل" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    {channels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id} className="text-xs font-semibold cursor-pointer">
                        {ch.name} ({ch.platform === "WHATSAPP" ? "واتساب" : ch.platform === "INSTAGRAM" ? "انستغرام" : "فيسبوك"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">محتوى رسالة البث</Label>
              <Textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب رسالتك هنا... تدعم حبقة الردود الآلية المتنوعة."
                rows={4}
                className="bg-accent/40 border-border/50 rounded-xl text-xs placeholder:text-muted-foreground/50 focus:border-primary leading-relaxed resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">الشريحة المستهدفة</Label>
                <Select value={targetType} onValueChange={(val: any) => setTargetType(val)}>
                  <SelectTrigger className="bg-accent/40 border-border/50 rounded-xl text-xs text-right">
                    <SelectValue placeholder="شريحة الجمهور" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50 rounded-xl">
                    <SelectItem value="all" className="text-xs font-semibold cursor-pointer">جميع المشتركين</SelectItem>
                    <SelectItem value="tag" className="text-xs font-semibold cursor-pointer">حسب وسام محدد</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === "tag" && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-xs font-bold text-foreground">الوسم المستهدف</Label>
                  <Input 
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    placeholder="اكتب الوسم مثل: vip"
                    className="bg-accent/40 border-border/50 rounded-xl text-xs focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-border/30 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs font-bold text-foreground">جدولة البث</Label>
                  <span className="text-[10px] text-muted-foreground font-semibold">تفعيل جدولة البث لوقت لاحق بدلاً من الإرسال الفوري</span>
                </div>
                <input 
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-4.5 h-4.5 accent-primary cursor-pointer rounded-lg"
                />
              </div>

              {isScheduled && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-xs font-bold text-foreground">تاريخ ووقت البث المجدول</Label>
                  <Input 
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="bg-accent/40 border-border/50 rounded-xl text-xs focus:border-primary text-right"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-4 border-t border-border/20">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || channels.length === 0}
                className="bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? "جاري الإنشاء..." : isScheduled ? "جدولة البث" : "حفظ كمسودة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Panel Drawer */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md border-none bg-card/95 backdrop-blur shadow-2xl p-6 flex flex-col justify-between" dir="rtl">
          <div>
            <SheetHeader className="text-right p-0 mb-4 flex flex-row items-center justify-between border-b border-border/30 pb-4">
              <div>
                <SheetTitle className="text-2xl font-black">تفاصيل الحملة الإعلانية</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs mt-0.5">
                  تفاصيل إعدادات الحملة ومؤشرات الأداء.
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsDetailsOpen(false)} className="rounded-xl cursor-pointer">
                <X className="w-5 h-5 text-muted-foreground" />
              </Button>
            </SheetHeader>

            {selectedCampaign && (
              <div className="space-y-6">
                {/* Details Section */}
                <div className="space-y-3 bg-accent/10 p-4.5 rounded-2xl border border-border/40">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold">الحالة:</span>
                    {getStatusBadge(selectedCampaign.status)}
                  </div>
                  <div className="flex justify-between items-center border-t border-border/20 pt-2.5">
                    <span className="text-xs text-muted-foreground font-bold">اسم الحملة:</span>
                    <span className="text-xs font-black">{selectedCampaign.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/20 pt-2.5">
                    <span className="text-xs text-muted-foreground font-bold">الجمهور المستهدف:</span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {selectedCampaign.segmentTarget === "all" ? "جميع المشتركين" : `@${selectedCampaign.segmentTarget}`}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/20 pt-2.5">
                    <span className="text-xs text-muted-foreground font-bold">تاريخ البث:</span>
                    <span className="text-xs font-semibold">
                      {selectedCampaign.scheduledAt 
                        ? new Date(selectedCampaign.scheduledAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date(selectedCampaign.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                    </span>
                  </div>
                </div>

                {/* Message Content */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground">نص رسالة البث</h4>
                  <div className="bg-accent/25 p-4 rounded-2xl text-xs leading-relaxed border border-border/30 max-h-36 overflow-y-auto">
                    {selectedCampaign.content}
                  </div>
                </div>

                {/* Simulated Delivery Chart */}
                {selectedCampaign.status === "SENT" && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-primary" />
                      إحصائيات إنجاز وتوصيل الرسائل
                    </h4>

                    {(() => {
                      const sent = selectedCampaign.sentCount || 0
                      const delivered = selectedCampaign.deliveredCount || 0
                      // simulate metrics
                      const read = Math.floor(delivered * 0.85)
                      const clicked = Math.floor(read * 0.45)
                      
                      const percentDelivered = sent > 0 ? Math.round((delivered / sent) * 100) : 0
                      const percentRead = delivered > 0 ? Math.round((read / delivered) * 100) : 0
                      const percentClicked = read > 0 ? Math.round((clicked / read) * 100) : 0

                      return (
                        <div className="space-y-4 bg-[#0a0a0f]/60 p-4.5 rounded-2xl border border-border/40">
                          {/* Sent -> Delivered */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span>رسائل مستلمة ({delivered} / {sent})</span>
                              <span className="text-[#4d9fff]">{percentDelivered}%</span>
                            </div>
                            <div className="h-2.5 bg-accent/40 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-l from-[#4d9fff] to-[#22d3ee] rounded-full" style={{ width: `${percentDelivered}%` }} />
                            </div>
                          </div>

                          {/* Delivered -> Read */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span>تمت قراءتها ({read} / {delivered})</span>
                              <span className="text-[#22d3ee]">{percentRead}%</span>
                            </div>
                            <div className="h-2.5 bg-accent/40 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-l from-[#22d3ee] to-[#4d9fff] rounded-full" style={{ width: `${percentRead}%` }} />
                            </div>
                          </div>

                          {/* Read -> Clicked */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span>تم النقر على روابطها ({clicked} / {read})</span>
                              <span className="text-primary">{percentClicked}%</span>
                            </div>
                            <div className="h-2.5 bg-accent/40 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${percentClicked}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/20 pt-4 flex gap-2">
            {selectedCampaign && selectedCampaign.status === "DRAFT" && (
              <Button 
                onClick={() => { setIsDetailsOpen(false); handleExecute(selectedCampaign.id); }}
                className="flex-1 bg-primary text-primary-foreground font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-[#0a0a0f]" />
                بث الحملة الآن
              </Button>
            )}

            {selectedCampaign && selectedCampaign.status === "SCHEDULED" && (
              <Button 
                onClick={() => { setIsDetailsOpen(false); handleCancel(selectedCampaign.id); }}
                variant="destructive"
                className="flex-1 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                إلغاء جدولة الحملة
              </Button>
            )}

            <Button 
              variant="outline" 
              onClick={() => setIsDetailsOpen(false)}
              className="flex-1 rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق النافذة
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
