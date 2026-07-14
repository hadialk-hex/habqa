"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, User, MessageCircle, Globe, Camera, Users, ChevronRight, ChevronLeft } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"

export default function SubscribersPage() {
  const { t, locale, dir } = useLanguage()
  const localeCode = locale === "ar" ? "ar-EG" : "en-US"
  const [searchQuery, setSearchQuery] = useState("")
  const [subscribersList, setSubscribersList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Profile Drawer States
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedSubscriber, setSelectedSubscriber] = useState<any | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Paginated and Filter States
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [platform, setPlatform] = useState("ALL")
  const [selectedTag, setSelectedTag] = useState("ALL")

  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isAddingTag, setIsAddingTag] = useState<string | null>(null)

  const [stats, setStats] = useState({
    total: 0,
    activeThisWeek: 0,
    fromFacebook: 0,
    fromWhatsapp: 0,
    fromInstagram: 0,
  })

  const handleOpenProfile = async (subscriber: any) => {
    setSelectedSubscriber(subscriber)
    setIsProfileOpen(true)
    setIsLoadingHistory(true)
    setConversationHistory(null)
    try {
      const res = await api.get(`/subscribers/${subscriber.id}/conversation`)
      setConversationHistory(res.data)
    } catch (err) {
      console.error("Error fetching conversation history:", err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const params: any = {
        search: searchQuery || undefined,
        platform: platform !== 'ALL' ? platform : undefined,
        tags: selectedTag !== 'ALL' ? selectedTag : undefined,
      }
      const res = await api.get('/subscribers', { params })
      const allSubscribers = res.data.data || res.data || []
      
      const headers = ["ID", "Name", "Phone", "Email", "Platform", "Tags", "Notes", "Joined At"]
      const rows = allSubscribers.map((sub: any) => [
        sub.id,
        sub.name || "",
        sub.phone || "",
        sub.email || "",
        sub.platform || "",
        (sub.tags || []).join("; "),
        sub.notes || "",
        sub.createdAt
      ])
      
      const csvContent = "\uFEFF" + [
        headers.join(","),
        ...rows.map((row: any) => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `subscribers_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("Error exporting CSV:", err)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/subscribers/stats')
      setStats(res.data)
    } catch (err) {
      console.error("Error fetching stats:", err)
    }
  }

  const fetchTags = async () => {
    try {
      const res = await api.get('/subscribers/tags')
      setAvailableTags(res.data)
    } catch (err) {
      console.error("Error fetching tags:", err)
    }
  }

  const fetchSubscribers = async () => {
    setIsLoading(true)
    try {
      const params: any = {
        page,
        limit,
        search: searchQuery || undefined,
        platform: platform !== 'ALL' ? platform : undefined,
        tags: selectedTag !== 'ALL' ? selectedTag : undefined,
      }

      const res = await api.get('/subscribers', { params })
      if (res.data && res.data.data) {
        setSubscribersList(res.data.data)
        setTotalCount(res.data.total)
        setTotalPages(res.data.totalPages)
      } else if (Array.isArray(res.data)) {
        setSubscribersList(res.data)
        setTotalCount(res.data.length)
        setTotalPages(1)
      }
    } catch (err) {
      console.error("Error fetching subscribers:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchTags()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSubscribers()
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, page, limit, platform, selectedTag])

  const handleAddTag = async (subscriberId: string, newTag: string, currentTags: string[]) => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    if (currentTags.includes(trimmed)) return
    const updatedTags = [...currentTags, trimmed]
    try {
      await api.patch(`/subscribers/${subscriberId}`, { tags: updatedTags })
      fetchSubscribers()
      fetchTags()
    } catch (err) {
      console.error("Error adding tag:", err)
    }
  }

  const handleRemoveTag = async (subscriberId: string, tagToRemove: string, currentTags: string[]) => {
    const updatedTags = currentTags.filter(t => t !== tagToRemove)
    try {
      await api.patch(`/subscribers/${subscriberId}`, { tags: updatedTags })
      fetchSubscribers()
      fetchTags()
    } catch (err) {
      console.error("Error removing tag:", err)
    }
  }

  const getPlatformDetails = (sub: any) => {
    if (sub.platform === 'WHATSAPP') {
      return { name: t("subscribersPage.platformWhatsapp"), icon: MessageCircle, color: "text-[#25D366]", bgColor: "bg-[#25D366]/10" }
    } else if (sub.platform === 'FACEBOOK_PAGE') {
      return { name: t("subscribersPage.platformFacebook"), icon: Globe, color: "text-[#1877F2]", bgColor: "bg-[#1877F2]/10" }
    } else if (sub.platform === 'INSTAGRAM') {
      return { name: t("subscribersPage.platformInstagram"), icon: Camera, color: "text-[#E1306C]", bgColor: "bg-[#E1306C]/10" }
    }

    if (sub.phone) {
      return { name: t("subscribersPage.platformWhatsapp"), icon: MessageCircle, color: "text-[#25D366]", bgColor: "bg-[#25D366]/10" }
    } else if (sub.email) {
      return { name: t("subscribersPage.platformFacebook"), icon: Globe, color: "text-[#1877F2]", bgColor: "bg-[#1877F2]/10" }
    } else {
      return { name: t("subscribersPage.platformInstagram"), icon: Camera, color: "text-[#E1306C]", bgColor: "bg-[#E1306C]/10" }
    }
  }

  const formatJoinDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(localeCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
              <Users className="w-6 h-6 text-white" />
            </div>
            {t("subscribersPage.title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("subscribersPage.subtitle")}</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="rounded-xl gap-2 font-bold h-11">
          <Download className="w-4 h-4" />
          {t("subscribersPage.exportData")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("subscribersPage.statTotal"), value: stats.total.toLocaleString(localeCode), color: "from-blue-500 to-cyan-600" },
          { label: t("subscribersPage.statActiveWeek"), value: stats.activeThisWeek.toLocaleString(localeCode), color: "from-emerald-500 to-green-500" },
          { label: t("subscribersPage.statFromFacebook"), value: stats.fromFacebook.toLocaleString(localeCode), color: "from-[#1877F2] to-[#0d5cbf]" },
          { label: t("subscribersPage.statFromWhatsapp"), value: stats.fromWhatsapp.toLocaleString(localeCode), color: "from-[#25D366] to-[#128C7E]" },
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg animate-fade-in-up`} style={{ animationDelay: `${i * 100}ms` }}>
            <p className="text-white/80 text-xs font-bold">{stat.label}</p>
            <p className="text-2xl font-black mt-1">{isLoading ? "..." : stat.value}</p>
          </div>
        ))}
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("subscribersPage.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-4 pr-10 rounded-xl h-11"
                />
              </div>

              {/* Platform Filter */}
              <Select
                value={platform}
                onValueChange={(val) => { if (val) { setPlatform(val); setPage(1); } }}
                items={{ ALL: t("subscribersPage.allPlatforms"), FACEBOOK_PAGE: t("subscribersPage.platformFacebook"), INSTAGRAM: t("subscribersPage.platformInstagram"), WHATSAPP: t("subscribersPage.platformWhatsapp") }}
              >
                <SelectTrigger className="w-[140px] rounded-xl h-11 border-border/50 text-xs">
                  <SelectValue placeholder={t("subscribersPage.platformPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("subscribersPage.allPlatforms")}</SelectItem>
                  <SelectItem value="FACEBOOK_PAGE">{t("subscribersPage.platformFacebook")}</SelectItem>
                  <SelectItem value="INSTAGRAM">{t("subscribersPage.platformInstagram")}</SelectItem>
                  <SelectItem value="WHATSAPP">{t("subscribersPage.platformWhatsapp")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Tag Filter */}
              <Select
                value={selectedTag}
                onValueChange={(val) => { if (val) { setSelectedTag(val); setPage(1); } }}
                items={{ ALL: t("subscribersPage.allTags"), ...Object.fromEntries(availableTags.map(tag => [tag, tag])) }}
              >
                <SelectTrigger className="w-[160px] rounded-xl h-11 border-border/50 text-xs">
                  <SelectValue placeholder={t("subscribersPage.tagsPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("subscribersPage.allTags")}</SelectItem>
                  {availableTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="rounded-xl gap-2 font-bold h-11">
              <Filter className="w-4 h-4" /> {t("subscribersPage.filterBtn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-medium">
              {t("subscribersPage.loadingSubscribers")}
            </div>
          ) : subscribersList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-medium">
              {t("subscribersPage.noMatchingSubscribers")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-muted-foreground bg-muted/30 uppercase font-bold">
                  <tr>
                    <th className="px-6 py-4">{t("subscribersPage.colCustomer")}</th>
                    <th className="px-6 py-4">{t("subscribersPage.colPlatform")}</th>
                    <th className="px-6 py-4">{t("subscribersPage.colJoinedDate")}</th>
                    <th className="px-6 py-4">{t("subscribersPage.colTags")}</th>
                    <th className="px-6 py-4">{t("subscribersPage.colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {subscribersList.map((user, i) => {
                    const platform = getPlatformDetails(user)
                    return (
                      <tr key={user.id} onClick={() => handleOpenProfile(user)} className="hover:bg-accent/30 transition-all duration-200 cursor-pointer group animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10 group-hover:scale-110 transition-transform duration-300">
                              <User className="w-5 h-5 text-primary/70" />
                            </div>
                            <div>
                              <p className="font-black">{user.name || t("subscribersPage.noNameSubscriber")}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{user.phone || user.email || user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1.5 ${platform.bgColor} w-fit px-3 py-1.5 rounded-lg`}>
                            <platform.icon className={`w-4 h-4 ${platform.color}`} />
                            <span className="text-xs font-bold">{platform.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-medium">{formatJoinDate(user.createdAt)}</td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {user.tags && user.tags.length > 0 ? (
                              user.tags.map((tag: string, index: number) => (
                                <Badge key={index} variant="secondary" className="font-bold rounded-lg text-xs flex items-center gap-1 bg-[#4d9fff]/10 text-[#4d9fff] border border-[#4d9fff]/20">
                                  {tag}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveTag(user.id, tag, user.tags)
                                    }}
                                    className="hover:text-destructive transition-colors text-[10px] ml-1 text-[#4d9fff]/70 hover:text-red-400"
                                  >
                                    &times;
                                  </button>
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                            
                            {/* Inline Plus Button / Input to add Tag */}
                            {isAddingTag === user.id ? (
                              <Input
                                autoFocus
                                className="w-24 h-7 px-2 text-xs rounded-lg border-primary/50 bg-[#0a0a0f] text-white"
                                placeholder={t("subscribersPage.newTagPlaceholder")}
                                onBlur={() => setIsAddingTag(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddTag(user.id, e.currentTarget.value, user.tags)
                                    setIsAddingTag(null)
                                  } else if (e.key === 'Escape') {
                                    setIsAddingTag(null)
                                  }
                                }}
                              />
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 hover:border-[#4d9fff]/50 text-muted-foreground hover:text-[#4d9fff]"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setIsAddingTag(user.id)
                                }}
                              >
                                +
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 bg-emerald-500" />
                            {t("subscribersPage.activeStatus")}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          <div className="p-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="font-medium">
                {t("subscribersPage.showingOf", { shown: subscribersList.length.toLocaleString(localeCode), total: totalCount.toLocaleString(localeCode) })}
              </div>

              {/* Page Size Select */}
              <div className="flex items-center gap-2">
                <span className="text-xs">{t("subscribersPage.pageSizeLabel")}</span>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => { if (val) { setLimit(Number(val)); setPage(1); } }}
                  items={{ "5": (5).toLocaleString(localeCode), "10": (10).toLocaleString(localeCode), "20": (20).toLocaleString(localeCode), "50": (50).toLocaleString(localeCode) }}
                >
                  <SelectTrigger className="w-[80px] rounded-xl h-8 border-border/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">{(5).toLocaleString(localeCode)}</SelectItem>
                    <SelectItem value="10">{(10).toLocaleString(localeCode)}</SelectItem>
                    <SelectItem value="20">{(20).toLocaleString(localeCode)}</SelectItem>
                    <SelectItem value="50">{(50).toLocaleString(localeCode)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Previous Page (RTL Next - ChevronRight going backwards) */}
              <button 
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-accent hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-4 h-4 text-[#4d9fff]" />
              </button>
              
              {/* Page Numbers */}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    page === p
                      ? "bg-[#4d9fff] text-[#0a0a0f] shadow-lg shadow-[#4d9fff]/20"
                      : "hover:bg-accent text-muted-foreground hover:text-white"
                  }`}
                >
                  {p.toLocaleString(localeCode)}
                </button>
              ))}
              
              {/* Next Page (RTL Prev - ChevronLeft going forwards) */}
              <button 
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-accent hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4 text-[#4d9fff]" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="left" className="w-[400px] sm:w-[540px] overflow-y-auto bg-card border-r border-border p-6 text-right" dir={dir}>
          {selectedSubscriber && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle className="text-xl font-black text-white">{selectedSubscriber.name || t("subscribersPage.noNameSubscriber")}</SheetTitle>
                <SheetDescription className="text-muted-foreground">{t("subscribersPage.profileSubtitle")}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Details Section */}
                <div className="space-y-3 border-b border-border/50 pb-4">
                  <h3 className="font-bold text-sm text-[#4d9fff]">{t("subscribersPage.customerDataTitle")}</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t("subscribersPage.platformLabel")}</p>
                      <p className="font-medium mt-1">{getPlatformDetails(selectedSubscriber).name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("subscribersPage.emailLabel")}</p>
                      <p className="font-medium mt-1">{selectedSubscriber.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("subscribersPage.phoneLabel")}</p>
                      <p className="font-medium mt-1">{selectedSubscriber.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("subscribersPage.joinedLabel")}</p>
                      <p className="font-medium mt-1">{formatJoinDate(selectedSubscriber.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="space-y-2 border-b border-border/50 pb-4">
                  <h3 className="font-bold text-sm text-[#4d9fff]">{t("subscribersPage.tagsTitle")}</h3>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {selectedSubscriber.tags && selectedSubscriber.tags.length > 0 ? (
                      selectedSubscriber.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="font-bold rounded-lg text-xs flex items-center gap-1 bg-[#4d9fff]/10 text-[#4d9fff] border border-[#4d9fff]/20">
                          {tag}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              const updatedTags = selectedSubscriber.tags.filter((t: string) => t !== tag)
                              try {
                                await api.patch(`/subscribers/${selectedSubscriber.id}`, { tags: updatedTags })
                                setSelectedSubscriber({ ...selectedSubscriber, tags: updatedTags })
                                fetchSubscribers()
                                fetchTags()
                              } catch (err) {
                                console.error("Error removing tag in drawer:", err)
                              }
                            }}
                            className="hover:text-destructive transition-colors text-[10px] ml-1 text-[#4d9fff]/70 hover:text-red-400"
                          >
                            &times;
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    
                    {isAddingTag === selectedSubscriber.id ? (
                      <Input
                        autoFocus
                        className="w-24 h-7 px-2 text-xs rounded-lg border-primary/50 bg-[#0a0a0f] text-white"
                        placeholder={t("subscribersPage.newTagPlaceholder")}
                        onBlur={() => setIsAddingTag(null)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const trimmed = e.currentTarget.value.trim()
                            if (trimmed && !selectedSubscriber.tags.includes(trimmed)) {
                              const updatedTags = [...selectedSubscriber.tags, trimmed]
                              try {
                                await api.patch(`/subscribers/${selectedSubscriber.id}`, { tags: updatedTags })
                                setSelectedSubscriber({ ...selectedSubscriber, tags: updatedTags })
                                fetchSubscribers()
                                fetchTags()
                              } catch (err) {
                                console.error("Error adding tag in drawer:", err)
                              }
                            }
                            setIsAddingTag(null)
                          } else if (e.key === 'Escape') {
                            setIsAddingTag(null)
                          }
                        }}
                      />
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 hover:border-[#4d9fff]/50 text-muted-foreground hover:text-[#4d9fff]"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsAddingTag(selectedSubscriber.id)
                        }}
                      >
                        +
                      </Button>
                    )}
                  </div>
                </div>

                {/* Conversation History */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-[#4d9fff]">{t("subscribersPage.fullConversationTitle")}</h3>
                  {isLoadingHistory ? (
                    <p className="text-xs text-muted-foreground">{t("subscribersPage.loadingConversationHistory")}</p>
                  ) : !conversationHistory || !conversationHistory.messages || conversationHistory.messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("subscribersPage.noConversationHistory")}</p>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto p-3 border border-border/50 rounded-xl bg-muted/10">
                      {conversationHistory.messages.map((msg: any) => {
                        const isInbound = msg.direction === 'INBOUND'
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] ${
                              isInbound ? 'self-start items-start text-right' : 'self-end items-end text-left'
                            }`}
                          >
                            <div
                              className={`px-3 py-2 rounded-xl text-xs ${
                                isInbound
                                  ? 'bg-[#181824] text-foreground border border-border/50 rounded-tr-none'
                                  : 'bg-primary text-primary-foreground rounded-tl-none'
                              }`}
                            >
                              {msg.content}
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-1">
                              {msg.sentByName ? `${msg.sentByName} • ` : ''}
                              {new Date(msg.createdAt).toLocaleTimeString(localeCode, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
