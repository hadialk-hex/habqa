"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquareText, Reply, Users, Zap, TrendingUp, TrendingDown, Globe, MessageCircle, Camera, ArrowUpLeft, Activity, BarChart3, Megaphone } from "lucide-react"
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [range, setRange] = useState<'today' | '7days' | '30days' | 'custom'>('7days')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    const fetchStats = async () => {
      setIsLoading(true)
      try {
        const params: any = { range }
        if (range === 'custom') {
          if (startDate) params.startDate = startDate
          if (endDate) params.endDate = endDate
        }
        const res = await api.get('/dashboard/stats', { params })
        setStats(res.data)
      } catch (err) {
        console.error("Error fetching stats:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [range, startDate, endDate])

  const getPlatformDetails = (platform: string) => {
    switch (platform) {
      case 'WHATSAPP':
        return { name: 'واتساب', icon: MessageCircle, color: 'text-[#25D366]', bgColor: 'bg-[#25D366]/10' };
      case 'FACEBOOK_PAGE':
        return { name: 'فيسبوك', icon: Globe, color: 'text-secondary', bgColor: 'bg-secondary/10' };
      case 'INSTAGRAM':
        return { name: 'انستغرام', icon: Camera, color: 'text-primary', bgColor: 'bg-primary/10' };
      default:
        return { name: platform, icon: MessageSquareText, color: 'text-primary', bgColor: 'bg-primary/10' };
    }
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    return new Date(dateStr).toLocaleDateString('ar-EG');
  }

  const totalSubscribersVal = stats?.totalSubscribers ?? 0;
  const totalAutoRepliesVal = stats?.totalAutoReplies ?? 0;
  const activeConversationsVal = stats?.activeConversations ?? 0;
  const totalRulesVal = stats?.totalRules ?? 0;

  const kpiCards = [
    {
      title: "إجمالي المشتركين",
      value: totalSubscribersVal.toLocaleString('ar-EG'),
      change: stats?.subscribersTrend !== undefined 
        ? `${stats.subscribersTrend > 0 ? '+' : ''}${stats.subscribersTrend}%` 
        : "مشترك مسجل",
      changeLabel: stats?.subscribersTrend !== undefined ? "مقارنة بالفترة السابقة" : "",
      trend: stats?.subscribersTrend > 0 ? "up" : stats?.subscribersTrend < 0 ? "down" : "neutral",
      icon: Users,
      gradient: "from-[#4d9fff] to-[#22d3ee]",
      bgGlow: "from-[#4d9fff]/15 to-transparent",
    },
    {
      title: "الردود الآلية",
      value: totalAutoRepliesVal.toLocaleString('ar-EG'),
      change: stats?.autoRepliesTrend !== undefined 
        ? `${stats.autoRepliesTrend > 0 ? '+' : ''}${stats.autoRepliesTrend}%` 
        : "رد مرسل",
      changeLabel: stats?.autoRepliesTrend !== undefined ? "مقارنة بالفترة السابقة" : "",
      trend: stats?.autoRepliesTrend > 0 ? "up" : stats?.autoRepliesTrend < 0 ? "down" : "neutral",
      icon: Reply,
      gradient: "from-[#22d3ee] to-[#4d9fff]",
      bgGlow: "from-[#22d3ee]/15 to-transparent",
    },
    {
      title: "المحادثات النشطة",
      value: activeConversationsVal.toLocaleString('ar-EG'),
      change: stats?.conversationsTrend !== undefined 
        ? `${stats.conversationsTrend > 0 ? '+' : ''}${stats.conversationsTrend}%` 
        : "نشطة حالياً",
      changeLabel: stats?.conversationsTrend !== undefined ? "مقارنة بالفترة السابقة" : "",
      trend: stats?.conversationsTrend > 0 ? "up" : stats?.conversationsTrend < 0 ? "down" : "neutral",
      icon: MessageSquareText,
      gradient: "from-[#4d9fff] to-[#22d3ee]",
      bgGlow: "from-[#4d9fff]/15 to-transparent",
    },
    {
      title: "القواعد النشطة",
      value: totalRulesVal.toLocaleString('ar-EG'),
      change: stats?.rulesTrend !== undefined 
        ? `${stats.rulesTrend > 0 ? '+' : ''}${stats.rulesTrend}%` 
        : "مفعلة",
      changeLabel: stats?.rulesTrend !== undefined ? "مقارنة بالفترة السابقة" : "",
      trend: stats?.rulesTrend > 0 ? "up" : stats?.rulesTrend < 0 ? "down" : "neutral",
      icon: Zap,
      gradient: "from-[#22d3ee] to-[#4d9fff]",
      bgGlow: "from-[#22d3ee]/15 to-transparent",
    },
  ]

  const totalConns = (stats?.platformStats?.WHATSAPP ?? 0) + (stats?.platformStats?.FACEBOOK_PAGE ?? 0) + (stats?.platformStats?.INSTAGRAM ?? 0) || 1;
  const platformData = [
    { 
      name: "واتساب", 
      count: (stats?.platformStats?.WHATSAPP ?? 0).toLocaleString('ar-EG'), 
      label: "قناة", 
      percent: Math.round(((stats?.platformStats?.WHATSAPP ?? 0) / totalConns) * 100) || 0, 
      color: "bg-[#25D366]",
      icon: MessageCircle,
      iconColor: "text-[#25D366]",
      bgColor: "bg-[#25D366]/10",
    },
    { 
      name: "فيسبوك", 
      count: (stats?.platformStats?.FACEBOOK_PAGE ?? 0).toLocaleString('ar-EG'), 
      label: "صفحة", 
      percent: Math.round(((stats?.platformStats?.FACEBOOK_PAGE ?? 0) / totalConns) * 100) || 0, 
      color: "bg-secondary",
      icon: Globe,
      iconColor: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    { 
      name: "انستغرام", 
      count: (stats?.platformStats?.INSTAGRAM ?? 0).toLocaleString('ar-EG'), 
      label: "حساب", 
      percent: Math.round(((stats?.platformStats?.INSTAGRAM ?? 0) / totalConns) * 100) || 0, 
      color: "bg-gradient-to-r from-primary to-secondary",
      icon: Camera,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
  ]

  const recentChats = stats?.recentConversations ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h1 className="text-3xl font-black tracking-tight">
            مرحباً، <span className="gradient-text">{user?.name || "المستخدم"}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-base">إليك ملخص أداء حبقة للتحليلات وبث الرسائل</p>
        </div>

        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-card/30 p-1.5 rounded-2xl border border-border/50">
          <button 
            onClick={() => setRange('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${range === 'today' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
          >
            اليوم
          </button>
          <button 
            onClick={() => setRange('7days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${range === '7days' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
          >
            آخر 7 أيام
          </button>
          <button 
            onClick={() => setRange('30days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${range === '30days' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
          >
            آخر 30 يوم
          </button>
          <button 
            onClick={() => setRange('custom')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${range === 'custom' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
          >
            مخصص
          </button>

          {range === 'custom' && (
            <div className="flex items-center gap-2 border-r border-border/50 pr-3 mr-1 animate-fade-in">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-accent/50 border border-border/50 rounded-lg text-xs px-2.5 py-1 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-muted-foreground text-xs font-bold">إلى</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-accent/50 border border-border/50 rounded-lg text-xs px-2.5 py-1 text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <Card 
            key={kpi.title} 
            className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group cursor-default ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <CardHeader className="flex flex-row items-center justify-between pb-2 z-10 relative">
              <CardTitle className="text-sm font-bold text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`bg-gradient-to-br ${kpi.gradient} p-2.5 rounded-xl shadow-lg`}>
                <kpi.icon className="h-5 w-5 text-[#0a0a0f]" />
              </div>
            </CardHeader>
            <CardContent className="z-10 relative">
              <div className="text-3xl font-black tracking-tight">
                {isLoading ? "..." : kpi.value}
              </div>
              <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${
                kpi.trend === 'up' 
                  ? 'text-[#4d9fff] drop-shadow-[0_0_4px_rgba(15,245,212,0.4)]' 
                  : kpi.trend === 'down' 
                    ? 'text-red-500 font-semibold' 
                    : 'text-muted-foreground'
              }`}>
                {kpi.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                {kpi.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                {kpi.trend === 'neutral' && <Activity className="w-3.5 h-3.5" />}
                <span>{kpi.change}</span>
                <span className="text-muted-foreground font-medium">{kpi.changeLabel}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recharts Activity Timeline */}
      <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                نشاط تفاعلات الحملات والرسائل
              </CardTitle>
              <CardDescription className="mt-1">الرسائل الواردة والردود المرسلة خلال الفترة المحددة.</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
                ردود مرسلة
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-secondary inline-block" />
                رسائل واردة
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {(() => {
            const timelineData = stats?.timeline || []
            const totalActivity = timelineData.reduce((acc: number, t: any) => acc + t.sent + t.received, 0)
            if (!isLoading && totalActivity === 0) {
              return (
                <div className="text-center py-10 text-muted-foreground text-sm font-medium">
                  لا يوجد نشاط مسجل في هذه الفترة.
                </div>
              )
            }
            return (
              <div className="w-full h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4d9fff" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4d9fff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a" 
                      fontSize={10}
                      tickFormatter={(tick) => {
                        const d = new Date(tick);
                        return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });
                      }}
                    />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0c0c12', border: '1px solid #333', borderRadius: '8px', direction: 'rtl' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                    />
                    <Area type="monotone" dataKey="sent" name="ردود مرسلة" stroke="#4d9fff" fillOpacity={1} fill="url(#colorSent)" strokeWidth={2} />
                    <Area type="monotone" dataKey="received" name="رسائل واردة" stroke="#22d3ee" fillOpacity={1} fill="url(#colorReceived)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Platform Stats */}
        <Card className={`lg:col-span-4 border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-500' : 'opacity-0'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  نشاط المنصات
                </CardTitle>
                <CardDescription className="mt-1">إحصائيات تفاعل البوت عبر فيسبوك وانستغرام وواتساب.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-6">
              {platformData.map((platform) => (
                <div key={platform.name} className="group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${platform.bgColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <platform.icon className={`w-5 h-5 ${platform.iconColor}`} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">{platform.name}</span>
                        <span className="text-muted-foreground font-medium">{isLoading ? "..." : `${platform.count} ${platform.label}`}</span>
                      </div>
                      <div className="h-3 bg-muted/70 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${platform.color} rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: mounted && !isLoading ? `${platform.percent}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className={`lg:col-span-3 border-none shadow-lg hover:shadow-xl transition-all duration-300 ${mounted ? 'animate-fade-in-up delay-600' : 'opacity-0'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  أحدث المحادثات
                </CardTitle>
                <CardDescription className="mt-1">آخر الرسائل الواردة والردود الآلية.</CardDescription>
              </div>
              <a href="/dashboard/inbox" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                عرض الكل
                <ArrowUpLeft className="w-3 h-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-1">
              {recentChats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                  لا توجد محادثات أخيرة حالياً
                </div>
              ) : (
                recentChats.map((chat: any, i: number) => {
                  const platDetails = getPlatformDetails(chat.connection?.platform)
                  const lastMsg = chat.messages?.[0]?.content || "لا توجد رسائل"
                  return (
                    <div 
                      key={chat.id || i} 
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-all duration-200 cursor-pointer group"
                    >
                      <div className="relative">
                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                          <span className="text-primary font-bold text-sm">{(chat.customerName || "م").substring(0, 2)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold truncate">{chat.customerName}</p>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {formatTime(chat.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs truncate text-muted-foreground">
                          {lastMsg}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <div className={`${platDetails.bgColor} p-0.5 rounded`}>
                            <platDetails.icon className={`w-3 h-3 ${platDetails.color}`} />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">{platDetails.name}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
