"use client"

import { LegalPage } from "@/components/legal-page"
import { useLanguage } from "@/lib/i18n/language-context"

const arContent = {
  title: "سياسة الخصوصية",
  lastUpdated: "12 يوليو 2026",
  intro: "خصوصيتك أولوية لدينا. توضح هذه السياسة ما البيانات التي نجمعها عند استخدامك منصة حبقة (Hubqa)، وكيف نستخدمها ونحميها، وما حقوقك عليها. تنطبق هذه السياسة على الموقع والمنصة وجميع الخدمات المرتبطة بها.",
  sections: [
    {
      title: "البيانات التي نجمعها",
      paragraphs: ["نجمع الحد الأدنى من البيانات اللازم لتقديم الخدمة:"],
      bullets: [
        "بيانات الحساب: الاسم، البريد الإلكتروني، كلمة المرور (مشفرة بخوارزمية bcrypt ولا يمكن لأحد الاطلاع عليها).",
        "بيانات الربط: معرفات الصفحات والحسابات المرتبطة ورموز الوصول الخاصة بها (مشفرة بمعيار AES-256).",
        "بيانات التفاعل: التعليقات والرسائل الواردة إلى صفحاتك المرتبطة، وأسماء ومعرفات المتفاعلين معها، وذلك حصراً لتشغيل الردود الآلية وصندوق الوارد.",
        "بيانات الاستخدام: سجلات النشاط داخل المنصة (إنشاء القواعد، تنفيذ الردود) لأغراض الأمان وفرض حدود الاشتراك.",
      ],
    },
    {
      title: "كيف نستخدم بياناتك",
      paragraphs: [],
      bullets: [
        "تشغيل الردود الآلية والرسائل الخاصة التي تعدّها أنت.",
        "عرض المحادثات والإحصائيات في لوحة التحكم الخاصة بك.",
        "إرسال رسائل بريدية تشغيلية (استعادة كلمة المرور، دعوات الفريق، إشعارات مهمة).",
        "تحسين الخدمة ومنع إساءة الاستخدام وفرض حدود الخطط.",
      ],
    },
    {
      title: "ما لا نفعله أبداً",
      paragraphs: [],
      bullets: [
        "لا نبيع بياناتك أو بيانات عملائك لأي طرف ثالث.",
        "لا نستخدم محتوى محادثاتك لأغراض إعلانية.",
        "لا نطلع على رموز الوصول الخاصة بصفحاتك — فهي مشفرة ولا تُستخدم إلا آلياً عبر خوادمنا للتواصل مع واجهات ميتا الرسمية.",
        "لا نشارك بياناتك مع جهات خارجية إلا إذا ألزمنا القانون بذلك.",
      ],
    },
    {
      title: "بيانات منصات التواصل (ميتا)",
      paragraphs: [
        "عند ربط صفحاتك، نصل إلى بيانات محدودة عبر واجهات ميتا الرسمية (Graph API) وفق الصلاحيات التي توافق عليها صراحة أثناء الربط. تُستخدم هذه البيانات حصراً لتقديم ميزات المنصة (قراءة التعليقات والرد عليها وإرسال الرسائل)، وتخضع معالجتها لسياسات ميتا للمطورين إضافة إلى هذه السياسة.",
        "يمكنك في أي وقت إلغاء ربط أي قناة من داخل المنصة، أو سحب صلاحيات التطبيق من إعدادات حسابك على فيسبوك، وسيتوقف وصولنا لبيانات تلك الصفحة فوراً.",
      ],
    },
    {
      title: "حماية البيانات",
      paragraphs: [],
      bullets: [
        "تشفير كلمات المرور بخوارزمية bcrypt أحادية الاتجاه.",
        "تشفير رموز الوصول الحساسة بمعيار AES-256.",
        "التحقق من توقيع جميع الإشعارات الواردة من ميتا (HMAC SHA-256).",
        "جلسات محمية برموز JWT قابلة للإبطال، وتقييد الوصول حسب الأدوار.",
        "سجلات تدقيق (Audit Logs) لجميع العمليات الحساسة.",
      ],
    },
    {
      title: "الاحتفاظ بالبيانات وحذفها",
      paragraphs: [
        "نحتفظ ببياناتك طوال فترة نشاط حسابك. عند حذف الحساب، تُحذف جميع بياناتك — بما فيها القنوات المرتبطة والقواعد والمحادثات وبيانات المشتركين — نهائياً من قواعد بياناتنا. راجع صفحة \"حذف البيانات\" للتفاصيل والخطوات.",
      ],
    },
    {
      title: "ملفات تعريف الارتباط (Cookies)",
      paragraphs: [
        "نستخدم التخزين المحلي في متصفحك للاحتفاظ بجلسة الدخول فقط. لا نستخدم ملفات تتبع إعلانية أو أدوات تحليل من أطراف ثالثة تتعقب نشاطك خارج منصتنا.",
      ],
    },
    {
      title: "حقوقك",
      paragraphs: ["يحق لك في أي وقت:"],
      bullets: [
        "طلب نسخة من بياناتك المخزنة لدينا.",
        "تصحيح أي بيانات غير دقيقة.",
        "حذف حسابك وجميع بياناتك نهائياً.",
        "الاعتراض على أي معالجة تراها غير مبررة.",
      ],
    },
    {
      title: "التغييرات على هذه السياسة",
      paragraphs: [
        "سنخطرك بأي تغيير جوهري على هذه السياسة عبر البريد الإلكتروني أو إشعار بارز داخل المنصة قبل سريانه بـ 14 يوماً على الأقل.",
      ],
    },
  ],
}

const enContent: typeof arContent = {
  title: "Privacy Policy",
  lastUpdated: "July 12, 2026",
  intro: "Your privacy is our priority. This policy explains what data we collect when you use the Hubqa platform, how we use and protect it, and what rights you have over it. This policy applies to the website, the platform, and all related services.",
  sections: [
    {
      title: "Data We Collect",
      paragraphs: ["We collect the minimum data necessary to provide the service:"],
      bullets: [
        "Account data: name, email address, and password (hashed with bcrypt; no one can view it).",
        "Connection data: identifiers of connected pages and accounts, and their access tokens (encrypted with the AES-256 standard).",
        "Interaction data: comments and messages received on your connected pages, and the names and identifiers of the people interacting with them, used solely to run automated replies and the inbox.",
        "Usage data: activity logs within the platform (creating rules, executing replies) for security purposes and to enforce subscription limits.",
      ],
    },
    {
      title: "How We Use Your Data",
      paragraphs: [],
      bullets: [
        "To run the automated replies and private messages you configure.",
        "To display conversations and statistics in your dashboard.",
        "To send operational emails (password recovery, team invitations, important notifications).",
        "To improve the service, prevent abuse, and enforce plan limits.",
      ],
    },
    {
      title: "What We Never Do",
      paragraphs: [],
      bullets: [
        "We never sell your data or your customers' data to any third party.",
        "We never use the content of your conversations for advertising purposes.",
        "We never view your pages' access tokens — they are encrypted and used only automatically by our servers to communicate with Meta's official APIs.",
        "We never share your data with outside parties unless required to do so by law.",
      ],
    },
    {
      title: "Social Media Platform Data (Meta)",
      paragraphs: [
        "When you connect your pages, we access limited data through Meta's official APIs (Graph API), according to the permissions you explicitly approve during connection. This data is used solely to provide the platform's features (reading and replying to comments, sending messages), and its processing is subject to Meta's developer policies in addition to this policy.",
        "You may disconnect any channel from within the platform at any time, or revoke the app's permissions from your Facebook account settings, and our access to that page's data will stop immediately.",
      ],
    },
    {
      title: "Data Protection",
      paragraphs: [],
      bullets: [
        "One-way hashing of passwords using bcrypt.",
        "Encryption of sensitive access tokens with the AES-256 standard.",
        "Signature verification of all incoming notifications from Meta (HMAC SHA-256).",
        "Sessions protected by revocable JWT tokens, with role-based access restrictions.",
        "Audit logs for all sensitive operations.",
      ],
    },
    {
      title: "Data Retention & Deletion",
      paragraphs: [
        "We retain your data for as long as your account is active. When you delete your account, all your data — including connected channels, rules, conversations, and subscriber data — is permanently deleted from our databases. See the \"Data Deletion\" page for details and steps.",
      ],
    },
    {
      title: "Cookies",
      paragraphs: [
        "We use local storage in your browser solely to maintain your login session. We do not use advertising trackers or third-party analytics tools that track your activity outside our platform.",
      ],
    },
    {
      title: "Your Rights",
      paragraphs: ["You have the right, at any time, to:"],
      bullets: [
        "Request a copy of the data we store about you.",
        "Correct any inaccurate data.",
        "Permanently delete your account and all your data.",
        "Object to any processing you consider unjustified.",
      ],
    },
    {
      title: "Changes to This Policy",
      paragraphs: [
        "We will notify you of any material change to this policy by email or a prominent in-platform notice at least 14 days before it takes effect.",
      ],
    },
  ],
}

export function PrivacyContent() {
  const { locale } = useLanguage()
  const content = locale === "ar" ? arContent : enContent
  return <LegalPage {...content} />
}
