"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, UserPlus, Trash2, Mail, Clock, RefreshCw, Crown, ShieldCheck, Headset, Eye, CheckCircle2, AlertTriangle, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useConfirm } from "@/components/ui/confirm-dialog"
import api from "@/lib/api"
import { useLanguage } from "@/lib/i18n/language-context"

interface Member {
  id: string
  role: string
  user: { id: string; email: string; name: string | null }
}

interface Invitation {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

export default function TeamPage() {
  const { t, locale } = useLanguage()
  const localeCode = locale === "ar" ? "ar" : "en-US"

  const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    OWNER: { label: t('teamPage.roleOwner'), icon: Crown, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    ADMIN: { label: t('teamPage.roleAdmin'), icon: ShieldCheck, className: "bg-primary/10 text-primary border-primary/30" },
    MEMBER: { label: t('teamPage.roleMember'), icon: Users, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    AGENT: { label: t('teamPage.roleAgent'), icon: Headset, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    VIEWER: { label: t('teamPage.roleViewer'), icon: Eye, className: "bg-muted text-muted-foreground border-border" },
  }

  const { user } = useAuth()
  const confirm = useConfirm()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("AGENT")
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const canManage = user?.role === "OWNER" || user?.role === "ADMIN"

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [membersRes, invitesRes] = await Promise.all([
        api.get("/team/members"),
        api.get("/team/invitations").catch(() => ({ data: [] })),
      ])
      setMembers(membersRes.data)
      setInvitations(invitesRes.data)
    } catch (error) {
      console.error("Failed to fetch team", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleInvite = async () => {
    try {
      setIsSubmitting(true)
      const res = await api.post("/team/invitations", { email: inviteEmail.trim(), role: inviteRole })
      const link = `${window.location.origin}/accept-invite?token=${res.data.token}`
      setInviteLink(link)
      setBanner({ type: "success", text: t('teamPage.inviteSuccess', { email: inviteEmail }) })
      setInviteEmail("")
      fetchData()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBanner({ type: "error", text: axiosErr.response?.data?.message || t('teamPage.inviteFailed') })
      setIsDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRoleChange = async (member: Member, role: string) => {
    try {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role } : m))
      await api.patch(`/team/members/${member.id}`, { role })
      setBanner({ type: "success", text: t('teamPage.roleChangedSuccess', { name: member.user.name || member.user.email, role: roleConfig[role]?.label || role }) })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setBanner({ type: "error", text: axiosErr.response?.data?.message || t('teamPage.roleChangeFailed') })
      fetchData()
    }
  }

  // Deleted handleRemove in favor of promise-based confirm dialog

  const handleCancelInvite = async (inv: Invitation) => {
    try {
      await api.delete(`/team/invitations/${inv.id}`)
      setInvitations(prev => prev.filter(i => i.id !== inv.id))
      setBanner({ type: "success", text: t('teamPage.inviteCancelledSuccess', { email: inv.email }) })
    } catch {
      setBanner({ type: "error", text: t('teamPage.inviteCancelFailed') })
    }
  }

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      setBanner({ type: "success", text: t('teamPage.linkCopied') })
    }
  }

  return (
    <>
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
              <Users className="w-6 h-6 text-white" />
            </div>
            {t('teamPage.title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('teamPage.subtitle')}</p>
        </div>

        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) { setInviteLink(null); setInviteEmail("") }
          }}>
            <DialogTrigger render={<Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl px-6 h-11 font-bold" />}>
              <UserPlus className="w-4 h-4" />
              {t('teamPage.inviteMember')}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">{t('teamPage.inviteDialogTitle')}</DialogTitle>
                <DialogDescription>
                  {t('teamPage.inviteDialogDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="inviteEmail" className="font-bold">{t('teamPage.emailLabel')}</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="rounded-xl h-11"
                    dir="ltr"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold">{t('teamPage.roleLabel')}</Label>
                  <Select
                    items={{
                      ADMIN: t('teamPage.roleAdminDesc'),
                      MEMBER: t('teamPage.roleMemberDesc'),
                      AGENT: t('teamPage.roleAgentDesc'),
                      VIEWER: t('teamPage.roleViewerDesc'),
                    }}
                    value={inviteRole}
                    onValueChange={(val) => val && setInviteRole(val)}
                  >
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">{t('teamPage.roleAdminDesc')}</SelectItem>
                      <SelectItem value="MEMBER">{t('teamPage.roleMemberDesc')}</SelectItem>
                      <SelectItem value="AGENT">{t('teamPage.roleAgentDesc')}</SelectItem>
                      <SelectItem value="VIEWER">{t('teamPage.roleViewerDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inviteLink && (
                  <div className="grid gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('teamPage.inviteCreatedTitle')}
                    </p>
                    <div className="flex gap-2">
                      <Input value={inviteLink} readOnly className="rounded-lg h-9 text-xs" dir="ltr" />
                      <Button type="button" variant="outline" size="sm" className="rounded-lg shrink-0 h-9" onClick={copyInviteLink}>{t('teamPage.copy')}</Button>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">{t('teamPage.close')}</Button>
                <Button onClick={handleInvite} disabled={isSubmitting || !inviteEmail.includes("@")} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {t('teamPage.sendInvite')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

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

      {/* Members */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-black">{t('teamPage.membersTitle', { count: members.length })}</CardTitle>
          <CardDescription>{t('teamPage.membersSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <div className="grid gap-3">
              {members.map(member => {
                const config = roleConfig[member.role] || roleConfig.MEMBER
                const RoleIcon = config.icon
                const isSelf = member.user.id === user?.id
                const isOwnerRow = member.role === "OWNER"
                return (
                  <div key={member.id} className="border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-card hover:shadow-md transition-shadow">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shrink-0">
                      <span className="text-primary font-bold text-sm">{(member.user.name || member.user.email).substring(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black truncate">
                        {member.user.name || t('teamPage.noName')}
                        {isSelf && <span className="text-xs text-muted-foreground font-medium mr-2">{t('teamPage.you')}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr">{member.user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManage && !isOwnerRow && !isSelf ? (
                        <Select
                          items={{
                            ADMIN: t('teamPage.roleAdmin'),
                            MEMBER: t('teamPage.roleMember'),
                            AGENT: t('teamPage.roleAgent'),
                            VIEWER: t('teamPage.roleViewer'),
                          }}
                          value={member.role}
                          onValueChange={(val) => val && handleRoleChange(member, val)}
                        >
                          <SelectTrigger className="rounded-lg h-9 w-[130px] text-xs font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">{t('teamPage.roleAdmin')}</SelectItem>
                            <SelectItem value="MEMBER">{t('teamPage.roleMember')}</SelectItem>
                            <SelectItem value="AGENT">{t('teamPage.roleAgent')}</SelectItem>
                            <SelectItem value="VIEWER">{t('teamPage.roleViewer')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`gap-1.5 rounded-lg font-bold ${config.className}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          {config.label}
                        </Badge>
                      )}
                      {canManage && !isOwnerRow && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: t('teamPage.removeMemberTitle'),
                              message: t('teamPage.removeMemberMessage', { name: member.user.name || member.user.email }),
                              variant: "destructive",
                              confirmText: t('teamPage.confirmRemove'),
                              cancelText: t('teamPage.cancel')
                            })
                            if (confirmed) {
                              try {
                                await api.delete(`/team/members/${member.id}`)
                                setBanner({ type: "success", text: t('teamPage.memberRemovedSuccess') })
                                fetchData()
                              } catch (err: unknown) {
                                const axiosErr = err as { response?: { data?: { message?: string } } }
                                setBanner({ type: "error", text: axiosErr.response?.data?.message || t('teamPage.memberRemoveFailed') })
                              }
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              {t('teamPage.pendingInvitesTitle', { count: invitations.length })}
            </CardTitle>
            <CardDescription>{t('teamPage.pendingInvitesSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {invitations.map(inv => (
              <div key={inv.id} className="border border-dashed rounded-xl p-4 flex items-center gap-3 bg-accent/20">
                <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" dir="ltr">{inv.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('teamPage.roleColumnLabel')}: {roleConfig[inv.role]?.label || inv.role} · {t('teamPage.expiresLabel')} {new Date(inv.expiresAt).toLocaleString(localeCode)}
                  </p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 rounded-lg text-xs font-bold" onClick={() => handleCancelInvite(inv)}>
                    {t('teamPage.cancelInvite')}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>

      {/* Remove Confirmation Dialog removed in favor of global confirm context */}
  </>
  )
}
