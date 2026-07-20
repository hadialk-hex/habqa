"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, MessageCircle, ImageOff, CheckCircle2, AlertTriangle, Newspaper } from "lucide-react"
import api from "@/lib/api"

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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

// Renders the right brand icon for a channel's platform
function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "INSTAGRAM") return <InstagramIcon className={className} />
  return <FacebookIcon className={className} />
}

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
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
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
          // Default to a Facebook page when present — it's the most common
          // choice and avoids silently landing on Instagram when both exist.
          const fbFirst = supported.find((c: Channel) => c.platform === "FACEBOOK_PAGE")
          setChannelId((fbFirst || supported[0]).id)
        }
      })
      .catch(() => setError("فشل تحميل القنوات"))
     
  }, [open])

  const fetchPosts = useCallback(async (chId: string, cursor?: string) => {
    if (!chId) return
    try {
      if (cursor) setIsLoadingMore(true)
      else setIsLoading(true)
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
                {/* Render the selected channel's name explicitly — Base UI's
                    default label extraction breaks on the icon+badge markup
                    and falls back to showing the raw connection id. */}
                <SelectValue>
                  {(value: string) => {
                    const c = channels.find(ch => ch.id === value)
                    if (!c) return "اختر الصفحة"
                    return (
                      <span className="flex items-center gap-2">
                        <PlatformIcon
                          platform={c.platform}
                          className={`w-4 h-4 shrink-0 ${c.platform === "INSTAGRAM" ? "text-[#DD2A7B]" : "text-[#1877F2]"}`}
                        />
                        <span>{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.platform === "INSTAGRAM" ? "انستغرام" : "فيسبوك"}
                        </span>
                      </span>
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {channels.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <PlatformIcon
                        platform={c.platform}
                        className={`w-4 h-4 shrink-0 ${c.platform === "INSTAGRAM" ? "text-[#DD2A7B]" : "text-[#1877F2]"}`}
                      />
                      <span>{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.platform === "INSTAGRAM" ? "انستغرام" : "فيسبوك"}
                      </span>
                    </span>
                  </SelectItem>
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
                    {post.picture && !failedImages.has(post.id) ? (

                      <img
                        src={post.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages(prev => new Set(prev).add(post.id))}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
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
