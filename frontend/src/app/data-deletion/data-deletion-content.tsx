"use client"

import { LegalPage } from "@/components/legal-page"
import { useLanguage } from "@/lib/i18n/language-context"

const arContent = {
  title: "تعليمات حذف البيانات",
  lastUpdated: "12 يوليو 2026",
  intro: "نحترم حقك الكامل في حذف بياناتك. توضح هذه الصفحة الطرق المتاحة لحذف بياناتك نهائياً من منصة حبقة (Hubqa)، سواء كنت مستخدماً مسجلاً أو متفاعلاً مع صفحة تستخدم خدماتنا. هذه الصفحة تلبي أيضاً متطلبات ميتا (Data Deletion Instructions URL).",
  sections: [
    {
      title: "حذف حسابك بالكامل (للمستخدمين المسجلين)",
      paragraphs: ["يمكنك حذف حسابك وجميع بياناتك بإحدى الطريقتين:"],
      bullets: [
        "من داخل المنصة: الإعدادات ← الحساب ← حذف الحساب نهائياً.",
        "عبر البريد الإلكتروني: أرسل طلباً من بريدك المسجل إلى bwmcmedia@gmail.com بعنوان \"طلب حذف بيانات\"، وسنعالجه خلال 30 يوماً كحد أقصى ونؤكد لك الحذف.",
      ],
    },
    {
      title: "ما الذي يُحذف؟",
      paragraphs: ["عند حذف الحساب تُحذف نهائياً وبشكل غير قابل للاسترجاع:"],
      bullets: [
        "بيانات حسابك الشخصية (الاسم، البريد الإلكتروني، كلمة المرور المشفرة).",
        "جميع القنوات المرتبطة ورموز الوصول الخاصة بها.",
        "جميع قواعد الرد الآلي والحملات.",
        "جميع المحادثات والرسائل المخزنة.",
        "بيانات المشتركين والوسوم والملاحظات.",
        "سجلات النشاط المرتبطة بحسابك.",
      ],
    },
    {
      title: "حذف بيانات التفاعل (لمن تفاعل مع صفحة تستخدم حبقة)",
      paragraphs: [
        "إذا علّقت أو راسلت صفحة تستخدم منصتنا وتريد حذف بياناتك (اسمك، معرفك، محتوى رسائلك) من أنظمتنا، أرسل طلباً إلى bwmcmedia@gmail.com متضمناً اسم الصفحة التي تفاعلت معها، وسنحذف بياناتك خلال 30 يوماً ونرسل لك تأكيداً.",
      ],
    },
    {
      title: "إلغاء ربط فيسبوك دون حذف الحساب",
      paragraphs: [
        "إذا أردت فقط إيقاف وصول المنصة لصفحاتك دون حذف حسابك:",
      ],
      bullets: [
        "من داخل المنصة: قنوات التواصل ← حذف القناة المطلوبة.",
        "من فيسبوك: الإعدادات والخصوصية ← الإعدادات ← عمليات دمج الأعمال ← إزالة تطبيق Hubqa. سيتوقف وصولنا فوراً وتُعطل الردود الآلية لصفحاتك.",
      ],
    },
    {
      title: "المدة الزمنية",
      paragraphs: [
        "طلبات الحذف من داخل المنصة تُنفذ فوراً. الطلبات عبر البريد الإلكتروني تُعالج خلال مدة أقصاها 30 يوماً من استلام الطلب، وغالباً خلال أيام عمل قليلة. النسخ الاحتياطية التقنية تُحذف تلقائياً خلال 30 يوماً إضافية كحد أقصى.",
      ],
    },
  ],
}

const enContent: typeof arContent = {
  title: "Data Deletion Instructions",
  lastUpdated: "July 12, 2026",
  intro: "We respect your full right to delete your data. This page explains the available ways to permanently delete your data from the Hubqa platform, whether you are a registered user or someone who interacted with a page using our services. This page also satisfies Meta's Data Deletion Instructions URL requirement.",
  sections: [
    {
      title: "Deleting Your Account Entirely (Registered Users)",
      paragraphs: ["You can delete your account and all your data in one of two ways:"],
      bullets: [
        "From within the platform: Settings → Account → Permanently Delete Account.",
        "By email: send a request from your registered email to bwmcmedia@gmail.com with the subject \"Data Deletion Request\"; we will process it within 30 days at most and confirm the deletion to you.",
      ],
    },
    {
      title: "What Gets Deleted?",
      paragraphs: ["When your account is deleted, the following is permanently and irrecoverably erased:"],
      bullets: [
        "Your personal account data (name, email, encrypted password).",
        "All connected channels and their access tokens.",
        "All auto-reply rules and campaigns.",
        "All stored conversations and messages.",
        "Subscriber data, tags, and notes.",
        "Activity logs associated with your account.",
      ],
    },
    {
      title: "Deleting Interaction Data (For Those Who Interacted With a Page Using Hubqa)",
      paragraphs: [
        "If you commented on or messaged a page that uses our platform and want your data (your name, identifier, and message content) deleted from our systems, send a request to bwmcmedia@gmail.com including the name of the page you interacted with, and we will delete your data within 30 days and send you a confirmation.",
      ],
    },
    {
      title: "Disconnecting Facebook Without Deleting Your Account",
      paragraphs: [
        "If you only want to stop the platform's access to your pages without deleting your account:",
      ],
      bullets: [
        "From within the platform: Channels → Remove the desired channel.",
        "From Facebook: Settings & Privacy → Settings → Business Integrations → Remove the Hubqa app. Our access will stop immediately and automated replies for your pages will be disabled.",
      ],
    },
    {
      title: "Timeframe",
      paragraphs: [
        "Deletion requests made within the platform are executed immediately. Requests made by email are processed within a maximum of 30 days of receipt, usually within a few business days. Technical backups are automatically purged within an additional 30 days at most.",
      ],
    },
  ],
}

export function DataDeletionContent() {
  const { locale } = useLanguage()
  const content = locale === "ar" ? arContent : enContent
  return <LegalPage {...content} />
}
