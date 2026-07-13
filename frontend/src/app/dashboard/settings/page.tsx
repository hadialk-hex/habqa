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

const settingsNav = [
  { id: 'profile', name: "الملف الشخصي", icon: User },
  { id: 'company', name: "الشركة / المنظمة", icon: Building },
  { id: 'ai', name: "الردود الذكية (AI)", icon: Sparkles },
  { id: 'security', name: "الأمان", icon: Lock },
  { id: 'billing', name: "الفوترة والاشتراك", icon: CreditCard },
  { id: 'notifications', name: "الإشعارات", icon: Bell },
]

const planLabels: Record<string, { name: string; sub: string }> = {
  STARTER: { name: "الخطة المجانية", sub: "قناة واحدة • 100 رد شهرياً" },
  PRO: { name: "الخطة الاحترافية", sub: "5 قنوات • ردود لا محدودة" },
  ENTERPRISE: { name: "خطة المؤسسات", sub: "قنوات وردود لا محدودة" },
}

export default function SettingsPage() {
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
      showToast("تم حفظ إعدادات الردود الذكية بنجاح", "success")
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      showToast(axiosErr.response?.data?.message || "فشل حفظ الإعدادات", "error")
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
      showToast("تم تحديث الملف الشخصي بنجاح", "success")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || "فشل تحديث الملف الشخصي", "error")
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
      showToast("تم تحديث اسم مساحة العمل بنجاح", "success")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || "فشل تحديث مساحة العمل", "error")
    } finally {
      setIsSavingCompany(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      showToast("الرجاء إدخال كلمة المرور الجديدة", "error")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("كلمتا المرور غير متطابقتين", "error")
      return
    }
    setIsUpdatingPassword(true)
    try {
      await api.patch('/auth/profile', { password: newPassword })
      showToast("تم تحديث كلمة المرور بنجاح", "success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      console.error(err)
      showToast(err.response?.data?.message || "فشل تحديث كلمة المرور", "error")
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
          الإعدادات
        </h1>
        <p className="text-muted-foreground mt-2">إدارة تفضيلات الحساب، الأمان، والفوترة.</p>
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
                  <CardTitle className="font-black text-xl">المعلومات الشخصية</CardTitle>
                  <CardDescription>قم بتحديث صورتك ومعلوماتك الشخصية.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.62_0.15_230)] p-0.5 shadow-lg shadow-primary/25">
                        <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                          <span className="text-3xl font-black gradient-text">{(firstName || "م").substring(0, 1)}</span>
                        </div>
                      </div>
                      <button className="absolute -bottom-2 -left-2 bg-primary text-primary-foreground p-2 rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button className="rounded-xl shadow-md shadow-primary/20 font-bold">تغيير الصورة</Button>
                        <Button variant="outline" className="rounded-xl">حذف</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">صيغ JPG، GIF، أو PNG بحد أقصى 2 ميجابايت.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">الاسم الأول</label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">اسم العائلة</label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold">البريد الإلكتروني</label>
                      <Input type="email" value={email} disabled className="rounded-xl h-11 bg-muted cursor-not-allowed" />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border/50 pt-6">
                    <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                      <Save className="w-4 h-4" />
                      {isSavingProfile ? "جاري الحفظ..." : "حفظ التغييرات"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg animate-fade-in-up delay-200">
                <CardHeader>
                  <CardTitle className="font-black text-xl">التفضيلات الإقليمية</CardTitle>
                  <CardDescription>تعيين اللغة والمنطقة الزمنية الخاصة بك.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">اللغة</label>
                      <Select defaultValue="ar">
                        <SelectTrigger className="w-full rounded-xl h-11 text-sm font-medium bg-muted/50 border-border/50">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                            <SelectValue placeholder="اختر اللغة" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">العربية (المملكة العربية السعودية)</SelectItem>
                          <SelectItem value="en">English (United States)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">المنطقة الزمنية</label>
                      <Select defaultValue="riyadh">
                        <SelectTrigger className="w-full rounded-xl h-11 text-sm font-medium bg-muted/50 border-border/50">
                          <SelectValue placeholder="اختر المنطقة الزمنية" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="riyadh">(GMT+03:00) الرياض</SelectItem>
                          <SelectItem value="dubai">(GMT+04:00) أبو ظبي، مسقط</SelectItem>
                          <SelectItem value="cairo">(GMT+02:00) القاهرة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border/50 pt-6">
                    <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                      <Save className="w-4 h-4" />
                      حفظ التغييرات
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
                  تغيير كلمة المرور
                </CardTitle>
                <CardDescription>تأكد من استخدام كلمة مرور قوية لحماية حسابك.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold">كلمة المرور الجديدة</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl h-11" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">تأكيد كلمة المرور الجديدة</label>
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
                    {isUpdatingPassword ? "جاري التحديث..." : "تحديث كلمة المرور"}
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
                  معلومات الشركة
                </CardTitle>
                <CardDescription>تفاصيل مساحة العمل والمنظمة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold">اسم الشركة / مساحة العمل</label>
                  <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">الخطة الحالية</label>
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="font-black text-primary">
                        {currentPlan ? (planLabels[currentPlan]?.name || currentPlan) : "..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentPlan ? (planLabels[currentPlan]?.sub || "") : "جاري التحميل"}
                      </p>
                    </div>
                    {currentPlan && currentPlan !== 'ENTERPRISE' && (
                      <Button variant="outline" className="rounded-xl">ترقية</Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end border-t border-border/50 pt-6">
                  <Button onClick={handleSaveCompany} disabled={isSavingCompany} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                    <Save className="w-4 h-4" />
                    {isSavingCompany ? "جاري الحفظ..." : "حفظ التغييرات"}
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
                  الردود الذكية (AI)
                </CardTitle>
                <CardDescription>
                  عندما لا يطابق التعليق أي قاعدة رد، يرد الذكاء الاصطناعي تلقائياً بناءً على وصف نشاطك التجاري.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!aiPlatformConfigured && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-medium">
                    ميزة الردود الذكية غير مفعّلة على مستوى المنصة بعد (مفتاح ANTHROPIC_API_KEY غير مضبوط). يمكنك حفظ إعداداتك وستعمل فور التفعيل.
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-xl border bg-accent/20">
                  <div>
                    <p className="font-bold">تفعيل الردود الذكية</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      تُحتسب ردود الذكاء الاصطناعي ضمن حصة الردود الشهرية لخطتك.
                    </p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold">وصف نشاطك التجاري (المعرفة التي يعتمد عليها الرد)</label>
                  <Textarea
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
                    placeholder={"مثال:\nنحن متجر \"حبق\" للعطور في الرياض.\n- عطر الياسمين: 120 ريال\n- عطر العود الملكي: 250 ريال\n- التوصيل داخل الرياض مجاني للطلبات فوق 200 ريال، خلال 24-48 ساعة.\n- الدفع: مدى، فيزا، أبل باي، أو عند الاستلام.\n- ساعات العمل: 9 صباحاً - 11 مساءً."}
                    className="min-h-[220px] rounded-xl leading-relaxed"
                    maxLength={4000}
                  />
                  <p className="text-xs text-muted-foreground">
                    كلما كان الوصف أدق (المنتجات، الأسعار، التوصيل، ساعات العمل) كانت الردود أفضل. الذكاء الاصطناعي لن يخترع معلومات غير موجودة هنا — وسيوجّه العميل للرسائل الخاصة عند السؤال عن شيء غير مذكور. ({aiContext.length}/4000)
                  </p>
                </div>

                <div className="flex justify-end border-t border-border/50 pt-6">
                  <Button onClick={handleSaveAi} disabled={isSavingAi || (aiEnabled && !aiContext.trim())} className="rounded-xl gap-2 shadow-lg shadow-primary/20 font-bold px-6 h-11">
                    <Save className="w-4 h-4" />
                    {isSavingAi ? "جاري الحفظ..." : "حفظ إعدادات الذكاء"}
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
                  الفوترة والاشتراك
                </CardTitle>
                <CardDescription>إدارة طريقة الدفع والاشتراك الحالي.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-black text-lg gradient-text">الخطة الاحترافية</p>
                      <p className="text-sm text-muted-foreground mt-1" dir="ltr">$29 / month</p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold">نشط</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center border-t border-border/30 pt-4">
                    <div>
                      <p className="font-black text-lg">5</p>
                      <p className="text-xs text-muted-foreground">صفحات متصلة</p>
                    </div>
                    <div>
                      <p className="font-black text-lg">∞</p>
                      <p className="text-xs text-muted-foreground">ردود شهرية</p>
                    </div>
                    <div>
                      <p className="font-black text-lg">أولوية</p>
                      <p className="text-xs text-muted-foreground">دعم فني</p>
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
                  إعدادات الإشعارات
                </CardTitle>
                <CardDescription>تحكم في الإشعارات التي تريد استلامها.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "إشعارات الرسائل الجديدة", desc: "عند وصول رسالة جديدة من العملاء", checked: true },
                  { label: "إشعارات الردود الآلية", desc: "عند تنفيذ رد آلي بنجاح", checked: false },
                  { label: "إشعارات الأخطاء", desc: "عند حدوث خطأ في الربط أو الرد", checked: true },
                  { label: "التقارير الأسبوعية", desc: "ملخص أداء البوت كل أسبوع عبر البريد", checked: true },
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
