"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building, User, Lock, CreditCard, Bell, Globe, Save, Camera, Shield, Key, Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/toast"
import api from "@/lib/api"
import { useLanguage, type Locale } from "@/lib/i18n/language-context"

export default function SettingsPage() {
  const { t, locale, setLocale } = useLanguage()

  const settingsNav = [
    { id: 'profile', name: t('settingsPage.navProfile'), icon: User },
    { id: 'company', name: t('settingsPage.navCompany'), icon: Building },
    { id: 'ai', name: t('settingsPage.navAi'), icon: Sparkles },
    { id: 'security', name: t('settingsPage.navSecurity'), icon: Lock },
    { id: 'billing', name: t('settingsPage.navBilling'), icon: CreditCard },
    { id: 'notifications', name: t('settingsPage.navNotifications'), icon: Bell },
  ]

  const planLabels: Record<string, { name: string; sub: string }> = {
    STARTER: { name: t('settingsPage.planStarterName'), sub: t('settingsPage.planStarterSub') },
    PRO: { name: t('settingsPage.planProName'), sub: t('settingsPage.planProSub') },
    ENTERPRISE: { name: t('settingsPage.planEnterpriseName'), sub: t('settingsPage.planEnterpriseSub') },
  }

  const [activeTab, setActiveTab] = useState('profile')
  const { user, updateUser } = useAuth()
  const { showToast } = useToast()
  
  // Profile states
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Company states
  const [workspaceName, setWorkspaceName] = useState("")
  const [isSavingCompany, setIsSavingCompany] = useState(false)

  // Password states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // AI settings states
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiContext, setAiContext] = useState("")
  const [aiPlatformConfigured, setAiPlatformConfigured] = useState(true)
  const [isSavingAi, setIsSavingAi] = useState(false)

  // Real plan from profile
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  useEffect(() => {
    api.get('/dashboard/ai-settings')
      .then(res => {
        setAiEnabled(res.data.aiEnabled)
        setAiContext(res.data.aiContext || "")
        setAiPlatformConfigured(res.data.platformConfigured)
      })
      .catch(() => {})

    api.get('/auth/profile')
      .then(res => {
        const plan = res.data?.memberships?.[0]?.tenant?.plan
        if (plan) setCurrentPlan(plan)
      })
      .catch(() => {})
  }, [])

  const handleSaveAi = async () => {
    try {
      setIsSavingAi(true)
      await api.put('/dashboard/ai-settings', { aiEnabled, aiContext })
      showToast(t('settingsPage.aiSavedSuccess'), "success")
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      showToast(axiosErr.response?.data?.message || t('settingsPage.aiSaveFailed'), "error")
    } finally {
      setIsSavingAi(false)
    }
  }

  useEffect(() => {
    if (user) {
      const parts = (user.name || "").split(" ")
      setFirstName(parts[0] || "")
      setLastName(parts.slice(1).join(" ") || "")
      setEmail(user.email || "")
      setWorkspaceName(user.tenantName || "")
    }
  }, [user])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    try {
      await api.patch('/auth/profile', { name: fullName })
      updateUser({ name: fullName })
      showToast(t('settingsPage.profileUpdatedSuccess'), "success")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || t('settingsPage.profileUpdateFailed'), "error")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveCompany = async () => {
    if (!user?.tenantId) return
    setIsSavingCompany(true)
    try {
      await api.put(`/tenants/${user.tenantId}`, { name: workspaceName.trim() })
      updateUser({ tenantName: workspaceName.trim() })
      showToast(t('settingsPage.workspaceUpdatedSuccess'), "success")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || t('settingsPage.workspaceUpdateFailed'), "error")
    } finally {
      setIsSavingCompany(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword.trim()) {
      showToast(t('settingsPage.currentPasswordRequired') || 'أدخل كلمة المرور الحالية', "error")
      return
    }
    if (!newPassword.trim()) {
      showToast(t('settingsPage.passwordRequired'), "error")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast(t('settingsPage.passwordMismatch'), "error")
      return
    }
    setIsUpdatingPassword(true)
    try {
      await api.patch('/auth/profile', { password: newPassword, currentPassword })
      showToast(t('settingsPage.passwordUpdatedSuccess'), "success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || t('settingsPage.passwordUpdateFailed'), "error")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-2.5 rounded-xl shadow-lg shadow-primary/25">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {t('settingsPage.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('settingsPage.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Settings Navigation — horizontal top tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/70 backdrop-blur-sm border border-border/40 overflow-x-auto no-scrollbar w-full sm:w-fit">
          {settingsNav.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-bold whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'bg-card text-primary shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="space-y-6 max-w-3xl">
          {activeTab === 'profile' && (
            <>
              <Card className="border-none shadow-lg animate-fade-in-up">
                <CardHeader>
                  <CardTitle className="font-black text-xl">{t('settingsPage.personalInfoTitle')}</CardTitle>
                  <CardDescription>{t('settingsPage.personalInfoSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-0.5 shadow-lg shadow-primary/25">
                        <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                          <span className="text-3xl font-black gradient-text">{(firstName || t('nav.user')).substring(0, 1)}</span>
                        </div>
                      </div>
                      <button className="absolute -bottom-2 -left-2 bg-primary text-primary-foreground p-2 rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button className="rounded-xl shadow-md shadow-primary/20 font-bold">{t('settingsPage.changePhoto')}</Button>
                        <Button variant="outline" className="rounded-xl">{t('settingsPage.deletePhoto')}</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('settingsPage.photoHint')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('settingsPage.firstName')}</label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('settingsPage.lastName')}</label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold">{t('settingsPage.email')}</label>
                      <Input type="email" value={email} disabled className="rounded-xl h-11 bg-muted cursor-not-allowed" />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border/50 pt-6">
                    <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                      <Save className="w-4 h-4" />
                      {isSavingProfile ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg animate-fade-in-up delay-200">
                <CardHeader>
                  <CardTitle className="font-black text-xl">{t('settingsPage.regionalTitle')}</CardTitle>
                  <CardDescription>{t('settingsPage.regionalSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('settingsPage.language')}</label>
                      <Select
                        items={{ ar: t('settingsPage.languageArabic'), en: t('settingsPage.languageEnglish') }}
                        value={locale}
                        onValueChange={(val) => val && setLocale(val as Locale)}
                      >
                        <SelectTrigger className="w-full rounded-xl h-11 text-sm font-medium bg-muted/50 border-border/50">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                            <SelectValue placeholder={t('settingsPage.languagePlaceholder')} />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">{t('settingsPage.languageArabic')}</SelectItem>
                          <SelectItem value="en">{t('settingsPage.languageEnglish')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">{t('settingsPage.timezone')}</label>
                      <Select
                        items={{
                          riyadh: t('settingsPage.timezoneRiyadh'),
                          dubai: t('settingsPage.timezoneDubai'),
                          cairo: t('settingsPage.timezoneCairo'),
                        }}
                        defaultValue="riyadh"
                      >
                        <SelectTrigger className="w-full rounded-xl h-11 text-sm font-medium bg-muted/50 border-border/50">
                          <SelectValue placeholder={t('settingsPage.timezonePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="riyadh">{t('settingsPage.timezoneRiyadh')}</SelectItem>
                          <SelectItem value="dubai">{t('settingsPage.timezoneDubai')}</SelectItem>
                          <SelectItem value="cairo">{t('settingsPage.timezoneCairo')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border/50 pt-6">
                    <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                      <Save className="w-4 h-4" />
                      {t('settingsPage.saveChanges')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'security' && (
            <Card className="border-none shadow-lg animate-fade-in-up">
              <CardHeader>
                <CardTitle className="font-black text-xl flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  {t('settingsPage.changePasswordTitle')}
                </CardTitle>
                <CardDescription>{t('settingsPage.changePasswordSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.currentPassword') || 'كلمة المرور الحالية'}</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.newPassword')}</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.confirmNewPassword')}</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="flex justify-end border-t border-border/50 pt-6">
                  <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                    <Save className="w-4 h-4" />
                    {isUpdatingPassword ? t('settingsPage.updating') : t('settingsPage.updatePassword')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'company' && (
            <Card className="border-none shadow-lg animate-fade-in-up">
              <CardHeader>
                <CardTitle className="font-black text-xl flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  {t('settingsPage.companyInfoTitle')}
                </CardTitle>
                <CardDescription>{t('settingsPage.companyInfoSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.companyName')}</label>
                  <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.currentPlan')}</label>
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="font-black text-primary">
                        {currentPlan ? (planLabels[currentPlan]?.name || currentPlan) : "..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentPlan ? (planLabels[currentPlan]?.sub || "") : t('settingsPage.loading')}
                      </p>
                    </div>
                    {currentPlan && currentPlan !== 'ENTERPRISE' && (
                      <Button variant="outline" className="rounded-xl">{t('settingsPage.upgrade')}</Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end border-t border-border/50 pt-6">
                  <Button onClick={handleSaveCompany} disabled={isSavingCompany} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                    <Save className="w-4 h-4" />
                    {isSavingCompany ? t('settingsPage.saving') : t('settingsPage.saveChanges')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'ai' && (
            <Card className="border-none shadow-lg animate-fade-in-up">
              <CardHeader>
                <CardTitle className="font-black text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {t('settingsPage.aiTitle')}
                </CardTitle>
                <CardDescription>
                  {t('settingsPage.aiSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!aiPlatformConfigured && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-medium">
                    {t('settingsPage.aiNotConfigured')}
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-xl border bg-accent/20">
                  <div>
                    <p className="font-bold">{t('settingsPage.aiEnableTitle')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settingsPage.aiEnableSubtitle')}
                    </p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">{t('settingsPage.aiContextLabel')}</label>
                  <Textarea
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
                    placeholder={t('settingsPage.aiContextPlaceholder')}
                    className="min-h-[220px] rounded-xl leading-relaxed"
                    maxLength={4000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settingsPage.aiContextHint', { count: aiContext.length })}
                  </p>
                </div>

                <div className="flex justify-end border-t border-border/50 pt-6">
                  <Button onClick={handleSaveAi} disabled={isSavingAi || (aiEnabled && !aiContext.trim())} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                    <Save className="w-4 h-4" />
                    {isSavingAi ? t('settingsPage.saving') : t('settingsPage.saveAi')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <Card className="border-none shadow-lg animate-fade-in-up">
              <CardHeader>
                <CardTitle className="font-black text-xl flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  {t('settingsPage.billingTitle')}
                </CardTitle>
                <CardDescription>{t('settingsPage.billingSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-black text-lg gradient-text">{t('settingsPage.planProName')}</p>
                      <p className="text-sm text-muted-foreground mt-1" dir="ltr">$29 / month</p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold">{t('settingsPage.active')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center border-t border-border/30 pt-4">
                    <div>
                      <p className="font-black text-lg">5</p>
                      <p className="text-xs text-muted-foreground">{t('settingsPage.connectedPages')}</p>
                    </div>
                    <div>
                      <p className="font-black text-lg">∞</p>
                      <p className="text-xs text-muted-foreground">{t('settingsPage.monthlyReplies')}</p>
                    </div>
                    <div>
                      <p className="font-black text-lg">{t('settingsPage.supportPriority')}</p>
                      <p className="text-xs text-muted-foreground">{t('settingsPage.technicalSupport')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="border-none shadow-lg animate-fade-in-up">
              <CardHeader>
                <CardTitle className="font-black text-xl flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  {t('settingsPage.notificationsTitle')}
                </CardTitle>
                <CardDescription>{t('settingsPage.notificationsSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: t('settingsPage.notifNewMessages'), desc: t('settingsPage.notifNewMessagesDesc'), checked: true },
                  { label: t('settingsPage.notifAutoReplies'), desc: t('settingsPage.notifAutoRepliesDesc'), checked: false },
                  { label: t('settingsPage.notifErrors'), desc: t('settingsPage.notifErrorsDesc'), checked: true },
                  { label: t('settingsPage.notifWeeklyReports'), desc: t('settingsPage.notifWeeklyReportsDesc'), checked: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="font-bold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:right-[2px] peer-checked:after:translate-x-[-20px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm" />
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
