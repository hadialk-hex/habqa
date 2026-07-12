"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, MessageCircle, ImageOff, CheckCircle2, AlertTriangle, Newspaper } from "lucide-react"
import api from "@/lib/api"

export interface PickedPost {
  id: string
  message: string
  picture: string | null
  createdTime: string
  permalink: string | null
  commentsCount: number
  channelId: string
  channelName: string
}

interface Channel {
  id: string
  platform: string
  platformId: string
  name: string
  isActive: boolean
}

interface PostPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (post: PickedPost) => void
}

interface PostItem {
  id: string
  message: string
  picture: string | null
  createdTime: string
  permalink: string | null
  commentsCount: number
}

export function PostPicker({ open, onOpenChange, onSelect }: PostPickerProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState<string>("")
  const [posts, setPosts] = useState<PostItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    api.get("/channels")
      .then(res => {
        const supported = res.data.filter((c: Channel) =>
          c.platform === "FACEBOOK_PAGE" || c.platform === "INSTAGRAM"
        )
        setChannels(supported)
        if (supported.length > 0 && !channelId) {
          setChannelId(supported[0].id)
        }
      })
      .catch(() => setError("فشل تحميل القنوات"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchPosts = useCallback(async (chId: string, cursor?: string) => {
    if (!chId) return
    try {
      cursor ? setIsLoadingMore(true) : setIsLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: "12" })
      if (cursor) params.set("after", cursor)
      const res = await api.get(`/channels/${chId}/posts?${params.toString()}`)
      setPosts(prev => cursor ? [...prev, ...res.data.posts] : res.data.posts)
      setNextCursor(res.data.hasMore ? res.data.nextCursor : null)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || "فشل جلب المنشورات. تأكد من ربط القناة عبر فيسبوك بتوكن صالح.")
      if (!cursor) setPosts([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (open && channelId) {
      setPosts([])
      setNextCursor(null)
      fetchPosts(channelId)
    }
  }, [open, channelId, fetchPosts])

  const handlePick = (post: PostItem) => {
    const channel = channels.find(c => c.id === channelId)
    onSelect({
      ...post,
      channelId,
      channelName: channel?.name || "",
    })
    onOpenChange(false)
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" })
    } catch {
      return iso
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            اختر منشوراً من صفحتك
          </DialogTitle>
          <DialogDescription>
            اضغط على المنشور الذي تريد ربط القاعدة به — بدون نسخ روابط أو معرفات.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {channels.length > 1 && (
            <Select value={channelId} onValueChange={(val) => val && setChannelId(val)}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="اختر الصفحة" />
              </SelectTrigger>
              <SelectContent>
                {channels.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {channels.length === 0 && !error && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              لا توجد قنوات فيسبوك أو انستغرام مرتبطة. اربط قناة أولاً من صفحة &quot;قنوات التواصل&quot;.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-medium">جاري تحميل المنشورات...</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {posts.map(post => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => handlePick(post)}
                  className="text-right group border rounded-xl overflow-hidden hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all bg-card relative"
                >
                  <div className="h-32 bg-muted/40 flex items-center justify-center overflow-hidden">
                    {post.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.picture} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <ImageOff className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs leading-relaxed line-clamp-2 min-h-[2rem] font-medium">
                      {post.message || <span className="italic text-muted-foreground">بدون نص</span>}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{formatDate(post.createdTime)}</span>
                      <Badge variant="outline" className="gap-1 text-[10px] h-5 rounded-md">
                        <MessageCircle className="w-3 h-3" />
                        {post.commentsCount}
                      </Badge>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg scale-75 group-hover:scale-100 transition-transform">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && posts.length === 0 && !error && channels.length > 0 && (
            <div className="text-center p-8 text-muted-foreground text-sm">
              لا توجد منشورات منشورة على هذه الصفحة.
            </div>
          )}

          {nextCursor && !isLoading && (
            <Button
              variant="outline"
              className="rounded-xl w-full"
              disabled={isLoadingMore}
              onClick={() => fetchPosts(channelId, nextCursor)}
            >
              {isLoadingMore ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : null}
              تحميل المزيد من المنشورات
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
