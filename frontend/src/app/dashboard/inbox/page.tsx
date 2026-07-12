"use client"

import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import {
  Search, Filter, MoreVertical, Paperclip, Send, Smile, User, Globe,
  MessageCircle, Camera, Phone, Video, ChevronDown, Check, CheckCheck,
  Zap, ArrowRight, X, Tag, Clock, CalendarDays, StickyNote, Plus, Hash
} from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useToast } from "@/components/ui/toast"
import api from "@/lib/api"
import dynamic from "next/dynamic"

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })

// ─── Helpers ────────────────────────────────────────────────────────────────

const isImage = (content: string) => {
  const trimmed = content.trim()
  return trimmed.startsWith("http") && (
    trimmed.endsWith(".png") ||
    trimmed.endsWith(".jpg") ||
    trimmed.endsWith(".jpeg") ||
    trimmed.endsWith(".gif") ||
    trimmed.includes("images.unsplash.com")
  )
}

const isQuickReply = (content: string) => {
  return content.trim().startsWith("[رد سريع:") && content.trim().endsWith("]")
}

const getQuickReplyText = (content: string) => {
  return content.trim().slice(10, -1)
}

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
]

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffMs = today.getTime() - msgDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "اليوم"
  if (diffDays === 1) return "الأمس"
  if (diffDays < 7) {
    const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    return dayNames[d.getDay()]
  }
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Canned responses (10 total) ────────────────────────────────────────────

// CANNED_RESPONSES removed in favor of API fetching

// ─── Typing Indicator Component ─────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 animate-fade-in" dir="rtl">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
        <span className="text-primary font-bold text-[10px]">...</span>
      </div>
      <div className="bg-[#181824] border border-border/50 rounded-2xl rounded-br-none px-4 py-3 flex items-center gap-1">
        <span className="text-xs text-muted-foreground ml-2">جاري الكتابة</span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4d9fff] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#4d9fff] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#4d9fff] animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      </div>
    </div>
  )
}

// ─── Date Separator Component ───────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[10px] font-bold text-muted-foreground bg-[#0d1117] px-3 py-1 rounded-full border border-border/30 flex items-center gap-1.5">
        <CalendarDays className="w-3 h-3" />
        {label}
      </span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [isLoadingConvs, setIsLoadingConvs] = useState(true)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showChatThread, setShowChatThread] = useState(false)
  const { showToast } = useToast()

  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<any[]>([])

  // ─── New state: advanced filter ───────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [filterPlatform, setFilterPlatform] = useState<string>("ALL")
  const [filterAssignment, setFilterAssignment] = useState<string>("ALL")

  // ─── New state: customer profile sheet ────────────────────────────────
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [customerTags, setCustomerTags] = useState<string[]>(["عميل VIP"])
  const [newTag, setNewTag] = useState("")
  const [customerNotes, setCustomerNotes] = useState<{ text: string; date: string }[]>([
    { text: "العميل يفضل التواصل عبر واتساب", date: new Date().toISOString() }
  ])
  const [newNote, setNewNote] = useState("")

  // ─── New state: canned responses search ───────────────────────────────
  const [cannedSearch, setCannedSearch] = useState("")

  // ─── New state: typing indicator ──────────────────────────────────────
  const [isTyping, setIsTyping] = useState(false)

  // ─── Smart auto-scroll refs ───────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const checkIfNearBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const threshold = 150
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  const scrollToBottom = useCallback(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  // ─── Click outside handlers ──────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showEmojiPicker])

  // ─── API calls (all existing) ─────────────────────────────────────────

  const fetchTeamMembers = async () => {
    try {
      const res = await api.get('/team/members')
      setTeamMembers(res.data)
    } catch (err) {
      console.error("Error fetching team members:", err)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!activeChat) return
    try {
      await api.patch(`/inbox/conversations/${activeChat.id}/read`, { status })
      setActiveChat((prev: any) => ({ ...prev, status }))
      setConversations((prev: any[]) => prev.map(c => {
        if (c.id === activeChat.id) {
          return { ...c, status }
        }
        return c
      }))
      showToast("تم تحديث حالة المحادثة بنجاح", "success")
    } catch (err) {
      console.error(err)
      showToast("فشل تحديث حالة المحادثة", "error")
    }
  }

  const handleAssignConversation = async (userId: string | null) => {
    if (!activeChat) return
    try {
      const res = await api.patch(`/inbox/conversations/${activeChat.id}/assign`, { assignedToId: userId })
      setActiveChat((prev: any) => ({
        ...prev,
        assignedToId: userId,
        assignedTo: res.data.assignedTo
      }))
      setConversations((prev: any[]) => prev.map(c => {
        if (c.id === activeChat.id) {
          return { ...c, assignedToId: userId, assignedTo: res.data.assignedTo }
        }
        return c
      }))
      showToast("تم تعيين المحادثة بنجاح", "success")
    } catch (err) {
      console.error(err)
      showToast("فشل تعيين المحادثة", "error")
    }
  }

  const fetchConversations = async () => {
    try {
      const res = await api.get('/inbox/conversations')
      setConversations(res.data)
    } catch (err) {
      console.error(err)
      setErrorMsg("حدث خطأ أثناء تحميل المحادثات. الرجاء المحاولة مرة أخرى.")
    } finally {
      setIsLoadingConvs(false)
    }
  }

  useEffect(() => {
    fetchConversations()
    fetchTeamMembers()
    fetchCannedResponses()
  }, [searchQuery, filterStatus])

  const fetchCannedResponses = async () => {
    try {
      const res = await api.get('/inbox/canned-responses')
      setCannedResponses(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchMessages = async (convId: string) => {
    setIsLoadingMsgs(true)
    try {
      const res = await api.get(`/inbox/conversations/${convId}/messages`)
      setMessages(res.data)
      isNearBottomRef.current = true // force scroll on new conversation
      await api.patch(`/inbox/conversations/${convId}/read`)
      fetchConversations()
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingMsgs(false)
    }
  }

  const handleSelectChat = (chat: any) => {
    setActiveChat(chat)
    fetchMessages(chat.id)
    setShowChatThread(true)
    // Simulate typing indicator briefly
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 2500)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChat) return

    try {
      const res = await api.post(`/inbox/conversations/${activeChat.id}/messages`, {
        content: newMessage.trim()
      })
      setMessages(prev => [...prev, res.data])
      setNewMessage("")
      isNearBottomRef.current = true // force scroll on send
      setConversations(prev => prev.map(c => {
        if (c.id === activeChat.id) {
          return { ...c, lastMessageAt: new Date().toISOString() }
        }
        return c
      }))
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || "فشل إرسال الرسالة", "error")
    }
  }

  const getPlatformDetails = (platform: string) => {
    switch (platform) {
      case 'WHATSAPP':
        return { name: "واتساب", icon: MessageCircle, color: "text-[#25D366]", bg: "bg-[#25D366]/10" }
      case 'FACEBOOK_PAGE':
        return { name: "فيسبوك", icon: Globe, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" }
      case 'INSTAGRAM':
        return { name: "انستغرام", icon: Camera, color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" }
      default:
        return { name: platform, icon: User, color: "text-primary", bg: "bg-primary/10" }
    }
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `${minutes} د`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} س`
    return new Date(dateStr).toLocaleDateString('ar-EG')
  }

  // ─── Advanced filtering ───────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // Search
      if (searchQuery && !c.customerName.toLowerCase().includes(searchQuery.toLowerCase())) return false
      // Status
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false
      // Platform
      if (filterPlatform !== "ALL" && c.connection?.platform !== filterPlatform) return false
      // Assignment
      if (filterAssignment === "ASSIGNED" && !c.assignedToId) return false
      if (filterAssignment === "UNASSIGNED" && c.assignedToId) return false
      return true
    })
  }, [conversations, searchQuery, filterStatus, filterPlatform, filterAssignment])

  const activeFilterCount = [filterStatus, filterPlatform, filterAssignment].filter(f => f !== "ALL").length

  // ─── Customer notes management ────────────────────────────────────────

  const handleAddNote = () => {
    if (!newNote.trim()) return
    setCustomerNotes(prev => [{ text: newNote.trim(), date: new Date().toISOString() }, ...prev])
    setNewNote("")
    showToast("تم حفظ الملاحظة بنجاح", "success")
  }

  const handleAddTag = () => {
    const t = newTag.trim()
    if (!t || customerTags.includes(t)) return
    setCustomerTags(prev => [...prev, t])
    setNewTag("")
  }

  const handleRemoveTag = (tag: string) => {
    setCustomerTags(prev => prev.filter(t => t !== tag))
  }

  // ─── Canned responses filtered ────────────────────────────────────────

  const filteredCanned = useMemo(() => {
    if (!cannedSearch.trim()) return cannedResponses
    return cannedResponses.filter(r => r.content.includes(cannedSearch.trim()) || r.title.includes(cannedSearch.trim()))
  }, [cannedSearch, cannedResponses])

  // ─── Unread count per conversation ────────────────────────────────────

  const getUnreadCount = (chat: any): number => {
    if (chat.unreadCount !== undefined) return chat.unreadCount
    if (chat.status === 'OPEN') return chat._count?.messages || 1
    return 0
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-8rem)] animate-fade-in relative">

      {/* ══════════════════════════════════════════════════════════════════
          CONVERSATIONS LIST
          ══════════════════════════════════════════════════════════════════ */}
      <Card className={`w-full md:w-80 lg:w-96 flex flex-col border-none shadow-lg overflow-hidden shrink-0 ${
        showChatThread ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">صندوق الوارد</h2>
            <div className="flex items-center gap-1">
              {/* Advanced Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`relative text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-accent transition-all ${activeFilterCount > 0 ? 'text-[#4d9fff]' : ''}`}
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-[#4d9fff] text-[#0a0a0f] text-[9px] font-black flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-64 p-3" dir="rtl">
                  <DropdownMenuLabel className="text-xs font-black text-muted-foreground mb-1">تصفية حسب الحالة</DropdownMenuLabel>
                  <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                    {[
                      { label: "الكل", value: "ALL" },
                      { label: "مفتوحة", value: "OPEN" },
                      { label: "محلولة", value: "RESOLVED" },
                      { label: "مؤجلة", value: "SNOOZED" }
                    ].map(st => (
                      <button
                        key={st.value}
                        onClick={() => setFilterStatus(st.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                          filterStatus === st.value
                            ? "bg-[#4d9fff]/10 text-[#4d9fff] border-[#4d9fff]/30"
                            : "text-muted-foreground border-border/30 hover:text-white hover:border-border/60"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-black text-muted-foreground mb-1 mt-1">تصفية حسب المنصة</DropdownMenuLabel>
                  <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                    {[
                      { label: "الكل", value: "ALL" },
                      { label: "فيسبوك", value: "FACEBOOK_PAGE" },
                      { label: "واتساب", value: "WHATSAPP" },
                      { label: "انستغرام", value: "INSTAGRAM" }
                    ].map(pl => (
                      <button
                        key={pl.value}
                        onClick={() => setFilterPlatform(pl.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                          filterPlatform === pl.value
                            ? "bg-[#4d9fff]/10 text-[#4d9fff] border-[#4d9fff]/30"
                            : "text-muted-foreground border-border/30 hover:text-white hover:border-border/60"
                        }`}
                      >
                        {pl.label}
                      </button>
                    ))}
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-black text-muted-foreground mb-1 mt-1">تصفية حسب التعيين</DropdownMenuLabel>
                  <div className="flex flex-wrap gap-1.5 mb-3 px-1">
                    {[
                      { label: "الكل", value: "ALL" },
                      { label: "معين", value: "ASSIGNED" },
                      { label: "غير معين", value: "UNASSIGNED" }
                    ].map(a => (
                      <button
                        key={a.value}
                        onClick={() => setFilterAssignment(a.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                          filterAssignment === a.value
                            ? "bg-[#4d9fff]/10 text-[#4d9fff] border-[#4d9fff]/30"
                            : "text-muted-foreground border-border/30 hover:text-white hover:border-border/60"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>

                  {activeFilterCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <button
                        onClick={() => { setFilterStatus("ALL"); setFilterPlatform("ALL"); setFilterAssignment("ALL") }}
                        className="w-full text-center text-[11px] font-bold text-red-400 hover:text-red-300 py-1.5 transition-colors"
                      >
                        مسح جميع الفلاتر
                      </button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث في المحادثات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-4 pr-10 rounded-xl bg-muted/50 border border-border/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 text-sm outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingConvs ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-medium">
              جاري تحميل المحادثات...
            </div>
          ) : errorMsg ? (
            <div className="text-center py-8 text-destructive text-sm font-medium px-4">
              {errorMsg}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm font-medium">
              لا توجد محادثات مطابقة
            </div>
          ) : (
            filteredConversations.map((chat) => {
              const pl = getPlatformDetails(chat.connection?.platform)
              const isActive = activeChat?.id === chat.id
              const unreadCount = getUnreadCount(chat)
              const hasUnread = unreadCount > 0
              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-all duration-200 border-b border-border/20 last:border-0 ${
                    isActive
                      ? 'bg-primary/5 border-r-4 border-r-primary'
                      : 'hover:bg-accent/30'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30' : 'bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10'
                    }`}>
                      <span className="text-primary font-bold text-sm">{(chat.customerName || "م").substring(0, 2)}</span>
                    </div>
                    <div className={`absolute -bottom-0.5 -left-0.5 ${pl.bg} rounded-full p-0.5 border-2 border-card`}>
                      <pl.icon className={`w-3 h-3 ${pl.color}`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${hasUnread ? 'font-black' : 'font-bold'}`}>{chat.customerName}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(chat.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs truncate text-muted-foreground">
                        {chat.messages?.[0]?.content || "اضغط لعرض تفاصيل المحادثة"}
                      </p>
                      {hasUnread && (
                        <span className="bg-[#4d9fff] text-[#0a0a0f] text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-sm shadow-[#4d9fff]/30">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          CHAT AREA
          ══════════════════════════════════════════════════════════════════ */}
      <Card className={`flex-1 flex flex-col border-none shadow-lg overflow-hidden relative ${
        showChatThread ? 'flex' : 'hidden md:flex'
      }`}>
        {activeChat ? (
          <>
            {/* ─── Chat Header ─────────────────────────────────────────── */}
            <div className="h-16 border-b border-border/50 flex items-center justify-between px-5 glass-strong z-10 shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setShowChatThread(false)}
                  className="md:hidden p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all shrink-0"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Clickable avatar → opens profile sheet */}
                <button
                  onClick={() => setProfileSheetOpen(true)}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center border border-primary/15 hover:border-[#4d9fff]/40 transition-all hover:shadow-md hover:shadow-[#4d9fff]/20 cursor-pointer"
                >
                  <span className="text-primary font-black text-sm">{(activeChat.customerName || "م").substring(0, 2)}</span>
                </button>
                <div>
                  <h3 className="font-black text-sm">{activeChat.customerName}</h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    {(() => {
                      const pl = getPlatformDetails(activeChat.connection?.platform)
                      return (
                        <>
                          <pl.icon className={`w-3 h-3 ${pl.color}`} />
                          <span>رسالة {pl.name}</span>
                        </>
                      )
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Status Toggles */}
                <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/30 text-xs">
                  {[
                    { label: "مفتوحة", value: "OPEN" },
                    { label: "محلولة", value: "RESOLVED" },
                    { label: "مؤجلة", value: "SNOOZED" }
                  ].map((st) => (
                    <button
                      key={st.value}
                      onClick={() => handleUpdateStatus(st.value)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                        activeChat.status === st.value
                          ? "bg-[#4d9fff]/10 text-[#4d9fff] shadow-sm"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Assignee Dropdown */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">المسؤول:</span>
                  <Select
                    value={activeChat.assignedToId || "__none__"}
                    onValueChange={(val) => handleAssignConversation(val === "__none__" ? null : val)}
                  >
                    <SelectTrigger className="w-[160px] rounded-xl h-8 text-xs font-bold bg-muted/30 border-border/50">
                      <SelectValue placeholder="غير معين" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">غير معين</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.user.id} value={member.user.id}>
                          {member.user.name || member.user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => showToast("جاري الاتصال الصوتي بالعميل... (محاكاة)", "info")}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => showToast("جاري بدء اتصال الفيديو... (محاكاة)", "info")}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Chat Messages with date separators ──────────────────── */}
            <div
              ref={messagesContainerRef}
              onScroll={checkIfNearBottom}
              className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-accent/20 to-transparent"
            >
              {isLoadingMsgs ? (
                <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                  جاري تحميل الرسائل...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                  لا توجد رسائل في هذه المحادثة
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOutbound = msg.direction === 'OUTBOUND'
                  const showDateSep = index === 0 || !isSameDay(messages[index - 1].createdAt, msg.createdAt)
                  return (
                    <div key={msg.id || index}>
                      {showDateSep && <DateSeparator label={getDateLabel(msg.createdAt)} />}
                      <div
                        className={`flex w-full ${isOutbound ? 'justify-start' : 'justify-end'} animate-fade-in-up`}
                      >
                        <div
                          className={`flex items-end gap-2 max-w-[75%] ${isOutbound ? 'flex-row-reverse' : ''}`}
                        >
                          {!isOutbound ? (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                              <span className="text-primary font-bold text-[10px]">{(activeChat.customerName || "م").substring(0, 2)}</span>
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4d9fff] to-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                              <span className="text-[#0a0a0f] font-bold text-[10px]">H</span>
                            </div>
                          )}
                          <div className={`p-4 text-sm rounded-2xl text-right ${
                            isOutbound
                              ? 'bg-gradient-to-br from-[#4d9fff]/10 to-[#4d9fff]/5 border border-[#4d9fff]/20 text-white shadow-lg rounded-bl-none'
                              : 'bg-[#181824] border border-border/50 shadow-sm rounded-br-none text-white'
                          }`}>
                            {isOutbound && msg.sentByName && (
                              <p className="text-[10px] font-bold text-[#4d9fff] mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4d9fff]/60 inline-block" />
                                {msg.sentByName}
                              </p>
                            )}
                            {isImage(msg.content) ? (
                              <div className="space-y-1.5">
                                <img src={msg.content} alt="صورة مرسلة" className="max-w-[240px] max-h-[180px] object-cover rounded-xl border border-border/30 hover:scale-105 transition-transform duration-200" />
                                <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
                              </div>
                            ) : isQuickReply(msg.content) ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-muted-foreground mb-1">الرد السريع المقترح:</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewMessage(getQuickReplyText(msg.content))
                                  }}
                                  className="bg-[#4d9fff]/10 hover:bg-[#4d9fff]/20 text-[#4d9fff] border border-[#4d9fff]/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-fit"
                                >
                                  {getQuickReplyText(msg.content)}
                                </button>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                            <div className="flex items-center justify-between gap-4 mt-2">
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                              {isOutbound && <CheckCheck className="w-3 h-3 text-[#4d9fff]/70" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Typing Indicator */}
              {isTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Chat Input ──────────────────────────────────────────── */}
            <form onSubmit={handleSendMessage} className="border-t border-border/50 px-4 py-3 flex items-center gap-3 glass-strong z-10 shrink-0">
              {/* Emoji Picker (real) */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachmentMenu(false); setShowCannedResponses(false); }}
                  className={`text-muted-foreground hover:text-[#4d9fff] transition-colors p-2 hover:bg-primary/10 rounded-xl ${showEmojiPicker ? 'text-[#4d9fff] bg-[#4d9fff]/10' : ''}`}
                >
                  <Smile className="w-5 h-5" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-14 right-0 z-50 rounded-xl overflow-hidden shadow-2xl border border-border/50">
                    <EmojiPicker
                      onEmojiClick={(emojiData: any) => setNewMessage(prev => prev + emojiData.emoji)}
                      theme={"dark" as any}
                      width={300}
                      height={400}
                    />
                  </div>
                )}
              </div>

              {/* Attachment Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowAttachmentMenu(!showAttachmentMenu); setShowEmojiPicker(false); setShowCannedResponses(false); }}
                  className={`text-muted-foreground hover:text-[#4d9fff] transition-colors p-2 hover:bg-primary/10 rounded-xl ${showAttachmentMenu ? 'text-[#4d9fff] bg-[#4d9fff]/10' : ''}`}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {showAttachmentMenu && (
                  <div className="absolute bottom-14 right-0 bg-[#0c0c14] border border-border/50 rounded-xl p-2.5 shadow-xl flex flex-col gap-1 z-50 w-52 text-right text-xs" dir="rtl">
                    <button
                      type="button"
                      onClick={() => {
                        setNewMessage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500")
                        setShowAttachmentMenu(false)
                        showToast("تم إدراج رابط صورة تجريبية في حقل الإدخال", "success")
                      }}
                      className="px-3 py-2 hover:bg-muted/50 rounded-lg transition-all text-right font-medium text-white"
                    >
                      🖼️ إدراج رابط صورة تجريبية
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMessage("[رد سريع: نعم، بكل سرور!]")
                        setShowAttachmentMenu(false)
                        showToast("تم إدراج قالب رد سريع تجريبي", "success")
                      }}
                      className="px-3 py-2 hover:bg-muted/50 rounded-lg transition-all text-right font-medium text-white"
                    >
                      💬 إدراج رد سريع تجريبي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false)
                        showToast("تم إرفاق ملف تجريبي بنجاح", "success")
                      }}
                      className="px-3 py-2 hover:bg-muted/50 rounded-lg transition-all text-right font-medium text-white"
                    >
                      📎 إرفاق ملف عشوائي
                    </button>
                  </div>
                )}
              </div>

              {/* Canned Responses with Search */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowCannedResponses(!showCannedResponses); setShowEmojiPicker(false); setShowAttachmentMenu(false); setCannedSearch(""); }}
                  className={`text-muted-foreground hover:text-[#4d9fff] transition-colors p-2 hover:bg-primary/10 rounded-xl ${showCannedResponses ? 'text-[#4d9fff] bg-[#4d9fff]/10' : ''}`}
                  title="الردود الجاهزة"
                >
                  <Zap className="w-5 h-5" />
                </button>
                {showCannedResponses && (
                  <div className="absolute bottom-14 right-0 bg-[#0c0c14] border border-border/50 rounded-xl shadow-xl flex flex-col z-50 w-72 text-right text-xs overflow-hidden" dir="rtl">
                    <div className="p-3 border-b border-border/30">
                      <p className="font-black text-muted-foreground text-right mb-2">الردود السريعة</p>
                      <div className="relative">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="بحث في الردود..."
                          value={cannedSearch}
                          onChange={e => setCannedSearch(e.target.value)}
                          className="w-full h-8 pl-3 pr-8 rounded-lg bg-muted/50 border border-border/50 text-[11px] outline-none focus:ring-1 focus:ring-[#4d9fff]/30 transition-all"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                      {filteredCanned.length === 0 ? (
                        <p className="text-center text-muted-foreground py-3 text-[11px]">لا توجد نتائج</p>
                      ) : (
                        filteredCanned.map((response: any) => (
                          <button
                            key={response.id || response.content}
                            type="button"
                            onClick={() => {
                              setNewMessage(prev => prev ? `${prev} ${response.content}` : response.content)
                              setShowCannedResponses(false)
                              setCannedSearch("")
                            }}
                            className="px-3 py-2 hover:bg-[#4d9fff]/5 hover:text-[#4d9fff] rounded-lg transition-all text-right font-medium text-white block w-full"
                          >
                            <div className="font-bold mb-0.5 text-[#4d9fff]">{response.title}</div>
                            <div className="text-muted-foreground">{response.content}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="اكتب رسالة..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-muted/50 h-11 px-5 rounded-2xl border border-border/50 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 outline-none text-sm transition-all"
              />
              <button type="submit" className="bg-gradient-to-br from-[#4d9fff] to-[#0cc0a0] text-[#0a0a0f] p-3 rounded-xl hover:shadow-lg hover:shadow-[#4d9fff]/30 transition-all hover:scale-105 active:scale-95 font-bold">
                <Send className="w-4 h-4 rtl:rotate-180" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm font-medium p-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-2" />
            الرجاء اختيار محادثة من القائمة الجانبية للبدء
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          CUSTOMER PROFILE SHEET (right-side panel)
          ══════════════════════════════════════════════════════════════════ */}
      {activeChat && (
        <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
          <SheetContent side="left" className="w-[380px] sm:max-w-[380px] bg-[#0d1117] border-l border-border/30 p-0 overflow-y-auto" dir="rtl">
            <SheetHeader className="p-5 pb-0">
              <SheetTitle className="text-right text-base font-black text-white">ملف العميل</SheetTitle>
              <SheetDescription className="text-right text-xs text-muted-foreground">معلومات وملاحظات العميل</SheetDescription>
            </SheetHeader>

            <div className="p-5 space-y-6">
              {/* ─── Avatar & Name ─────────────────────────────────── */}
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4d9fff]/25 to-[#4d9fff]/5 flex items-center justify-center border-2 border-[#4d9fff]/20 mb-3 shadow-lg shadow-[#4d9fff]/10">
                  <span className="text-[#4d9fff] font-black text-2xl">{(activeChat.customerName || "م").substring(0, 2)}</span>
                </div>
                <h3 className="font-black text-lg text-white">{activeChat.customerName}</h3>
                {(() => {
                  const pl = getPlatformDetails(activeChat.connection?.platform)
                  return (
                    <span className={`text-xs flex items-center gap-1.5 mt-1 ${pl.color}`}>
                      <pl.icon className="w-3.5 h-3.5" />
                      {pl.name}
                    </span>
                  )
                })()}
              </div>

              {/* ─── Quick Stats ──────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0f] rounded-xl p-3 border border-border/30 text-center">
                  <MessageCircle className="w-4 h-4 text-[#4d9fff] mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{messages.length}</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي الرسائل</p>
                </div>
                <div className="bg-[#0a0a0f] rounded-xl p-3 border border-border/30 text-center">
                  <Clock className="w-4 h-4 text-[#4d9fff] mx-auto mb-1" />
                  <p className="text-sm font-black text-white">{activeChat.lastMessageAt ? formatTime(activeChat.lastMessageAt) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">آخر نشاط</p>
                </div>
              </div>

              {/* ─── Contact Details ──────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  معلومات الاتصال
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-3 py-2 border border-border/20">
                    <span className="text-muted-foreground text-xs">البريد</span>
                    <span className="text-xs text-white font-medium">{activeChat.customerEmail || "غير متوفر"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-3 py-2 border border-border/20">
                    <span className="text-muted-foreground text-xs">الهاتف</span>
                    <span className="text-xs text-white font-medium">{activeChat.customerPhone || "غير متوفر"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-3 py-2 border border-border/20">
                    <span className="text-muted-foreground text-xs">تاريخ الانضمام</span>
                    <span className="text-xs text-white font-medium">
                      {activeChat.createdAt ? new Date(activeChat.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : "غير متوفر"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── Tags ─────────────────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  العلامات
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {customerTags.map(tag => (
                    <span key={tag} className="bg-[#4d9fff]/10 text-[#4d9fff] text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#4d9fff]/20 flex items-center gap-1 group">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="إضافة علامة..."
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                    className="flex-1 h-8 px-3 rounded-lg bg-muted/50 border border-border/50 text-xs outline-none focus:ring-1 focus:ring-[#4d9fff]/30 transition-all"
                  />
                  <button
                    onClick={handleAddTag}
                    className="h-8 w-8 rounded-lg bg-[#4d9fff]/10 text-[#4d9fff] hover:bg-[#4d9fff]/20 flex items-center justify-center transition-all border border-[#4d9fff]/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ─── Internal Notes ───────────────────────────────── */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  الملاحظات الداخلية
                </h4>
                <div className="space-y-2">
                  <textarea
                    placeholder="اكتب ملاحظة داخلية..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-xs outline-none resize-none focus:ring-1 focus:ring-[#4d9fff]/30 transition-all"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="w-full h-8 rounded-lg bg-[#4d9fff]/10 text-[#4d9fff] text-xs font-bold hover:bg-[#4d9fff]/20 transition-all border border-[#4d9fff]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    حفظ الملاحظة
                  </button>
                </div>
                {customerNotes.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerNotes.map((note, i) => (
                      <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-border/20 text-right">
                        <p className="text-xs text-white leading-relaxed">{note.text}</p>
                        <p className="text-[9px] text-muted-foreground mt-1.5">
                          {new Date(note.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
