"use client"

import { LegalPage } from "@/components/legal-page"
import { useLanguage } from "@/lib/i18n/language-context"

const arContent = {
  title: "الشروط والأحكام",
  lastUpdated: "12 يوليو 2026",
  intro: "مرحباً بك في منصة حبقة (Hubqa). باستخدامك للمنصة أو إنشاء حساب فيها، فأنت توافق على الالتزام بهذه الشروط والأحكام كاملة. يرجى قراءتها بعناية قبل استخدام خدماتنا. إذا كنت لا توافق على أي بند منها، يرجى عدم استخدام المنصة.",
  sections: [
    {
      title: "تعريف الخدمة",
      paragraphs: [
        "حبقة هي منصة سحابية (SaaS) تتيح لأصحاب الأعمال أتمتة الردود على التعليقات والرسائل الواردة عبر منصات التواصل الاجتماعي (فيسبوك، انستغرام، واتساب)، وإدارة المحادثات من صندوق وارد موحد، وإنشاء قواعد رد آلي، وإرسال رسائل خاصة تلقائية للمعلقين.",
      ],
    },
    {
      title: "الحسابات والتسجيل",
      paragraphs: [
        "يجب أن تكون المعلومات المقدمة عند التسجيل صحيحة ودقيقة ومحدثة. أنت المسؤول الوحيد عن الحفاظ على سرية بيانات الدخول الخاصة بك وعن جميع الأنشطة التي تتم عبر حسابك.",
      ],
      bullets: [
        "يجب أن يكون عمرك 18 عاماً على الأقل لإنشاء حساب.",
        "لا يجوز مشاركة الحساب مع أطراف خارجية دون استخدام ميزة إدارة الفريق الرسمية.",
        "يحق لنا تعليق أو إنهاء أي حساب يخالف هذه الشروط دون إشعار مسبق.",
      ],
    },
    {
      title: "الاستخدام المقبول",
      paragraphs: [
        "توافق على استخدام المنصة بشكل قانوني وأخلاقي، وبما يتوافق مع سياسات منصات التواصل الاجتماعي المرتبطة (بما فيها سياسات ميتا للمطورين). يُحظر تماماً:",
      ],
      bullets: [
        "إرسال رسائل مزعجة (سبام) أو محتوى مضلل أو احتيالي.",
        "استخدام المنصة لنشر محتوى مخالف للقانون أو محرض على الكراهية أو العنف.",
        "محاولة اختراق المنصة أو الوصول غير المصرح به لحسابات الآخرين.",
        "ربط صفحات أو حسابات لا تملك صلاحية إدارتها.",
        "إعادة بيع الخدمة أو تأجيرها دون اتفاق كتابي مسبق معنا.",
      ],
    },
    {
      title: "الاشتراكات والدفع",
      paragraphs: [
        "تقدم المنصة خططاً متعددة: مجانية (بحدود استخدام محددة)، واحترافية، ومؤسسات. تُفرض حدود كل خطة تلقائياً (عدد القنوات المرتبطة وعدد الردود الشهرية).",
      ],
      bullets: [
        "تتجدد الاشتراكات المدفوعة تلقائياً ما لم يتم إلغاؤها قبل تاريخ التجديد.",
        "عند تجاوز حدود خطتك، تتوقف الردود الآلية حتى بداية الشهر التالي أو حتى ترقية الخطة.",
        "يحق لنا تعديل الأسعار مع إشعار مسبق لا يقل عن 30 يوماً.",
        "لا تُسترد المبالغ المدفوعة عن الفترات المستخدمة جزئياً إلا وفق ما يقتضيه القانون المعمول به.",
      ],
    },
    {
      title: "ربط حسابات التواصل الاجتماعي",
      paragraphs: [
        "عند ربط صفحاتك عبر فيسبوك، فأنت تمنح المنصة صلاحيات محدودة (قراءة التعليقات، الرد عليها، إرسال الرسائل) عبر واجهات ميتا الرسمية. تُخزن رموز الوصول مشفرة بمعيار AES-256 ولا تُشارك مع أي طرف ثالث.",
        "أنت تقر بأن استخدامك لميزات الأتمتة يخضع أيضاً لشروط وسياسات منصة ميتا، وأن حبقة غير مسؤولة عن أي إجراء تتخذه ميتا بحق صفحاتك نتيجة مخالفتك لسياساتها.",
      ],
    },
    {
      title: "الملكية الفكرية",
      paragraphs: [
        "جميع حقوق المنصة وتصميمها وشيفرتها البرمجية وعلامتها التجارية مملوكة لحبقة. يحتفظ المستخدم بملكية المحتوى الذي ينشئه (نصوص الردود، القواعد، بيانات العملاء)، ويمنحنا ترخيصاً محدوداً لمعالجته حصراً بغرض تقديم الخدمة.",
      ],
    },
    {
      title: "إخلاء الضمانات وحدود المسؤولية",
      paragraphs: [
        "تُقدم الخدمة \"كما هي\" و\"كما هي متاحة\" دون أي ضمانات صريحة أو ضمنية، بما في ذلك على سبيل المثال لا الحصر ضمانات الملاءمة لغرض معين أو عدم الانتهاك أو الدقة. لا نضمن عمل الخدمة دون انقطاع أو خلوها من الأخطاء، خاصة فيما يتعلق بالأعطال أو التغييرات الناتجة عن منصات الطرف الثالث (ميتا وغيرها).",
        "لا نتحمل بأي حال المسؤولية عن أي أضرار غير مباشرة أو عرضية أو تبعية أو تأديبية، بما في ذلك خسارة الأرباح أو الإيرادات أو البيانات أو السمعة التجارية أو فرص العمل، حتى لو أُخطرنا مسبقاً باحتمال وقوعها. لا تتجاوز مسؤوليتنا الإجمالية في أي حال قيمة ما دفعته فعلياً خلال الأشهر الثلاثة السابقة للمطالبة، أو (100) دولار أمريكي إذا كنت على الخطة المجانية، أيهما أقل.",
      ],
    },
    {
      title: "مسؤوليتك عن المحتوى والبيانات",
      paragraphs: [
        "أنت المسؤول الوحيد والكامل عن محتوى الردود والرسائل التي تنشئها عبر المنصة، وعن قانونية جمعك ومعالجتك لبيانات عملائك، وعن حصولك على الموافقات اللازمة منهم وفق قوانين حماية البيانات المعمول بها في بلدك. تعمل حبقة كمعالج تقني للبيانات نيابة عنك، وتبقى أنت المتحكم بالبيانات ومالكها القانوني.",
      ],
    },
    {
      title: "التعويض",
      paragraphs: [
        "توافق على تعويض حبقة ومالكيها وموظفيها ووكلائها والدفاع عنهم وإبراء ذمتهم من أي مطالبات أو دعاوى أو خسائر أو أضرار أو مصاريف (بما فيها أتعاب المحاماة المعقولة) تنشأ عن أو تتعلق بـ: (أ) استخدامك للمنصة بشكل مخالف لهذه الشروط؛ (ب) انتهاكك لأي قانون أو للوائح منصات الطرف الثالث؛ (ج) المحتوى الذي ترسله عبر المنصة؛ (د) انتهاكك لحقوق أي طرف ثالث بما فيها حقوق الخصوصية والملكية الفكرية.",
      ],
    },
    {
      title: "القوة القاهرة",
      paragraphs: [
        "لا نتحمل المسؤولية عن أي تأخير أو إخفاق في تنفيذ التزاماتنا نتيجة أسباب خارجة عن سيطرتنا المعقولة، بما في ذلك الكوارث الطبيعية، انقطاع الإنترنت أو الكهرباء، الحروب، الأوبئة، قرارات الجهات الحكومية، الهجمات السيبرانية، أو تغييرات وتعطيلات واجهات برمجة التطبيقات لدى منصات الطرف الثالث.",
      ],
    },
    {
      title: "القانون الحاكم وتسوية النزاعات",
      paragraphs: [
        "تخضع هذه الشروط وتُفسر وفقاً للقوانين المعمول بها في بلد تسجيل مالك المنصة، دون اعتبار لقواعد تنازع القوانين. تُحل أي نزاعات تنشأ عن هذه الشروط ودياً أولاً خلال 30 يوماً من الإخطار الكتابي، وإذا تعذر ذلك تُحال للمحكمة المختصة في نفس الاختصاص القضائي. توافق على رفع أي مطالبة بصفتك الفردية فقط، وليس ضمن دعوى جماعية.",
      ],
    },
    {
      title: "استقلالية البنود",
      paragraphs: [
        "إذا قضت محكمة مختصة ببطلان أي بند من هذه الشروط أو عدم قابليته للتنفيذ، يبقى هذا البند نافذاً إلى الحد الأقصى الذي يسمح به القانون، وتبقى بقية البنود سارية المفعول بالكامل. تنازلنا عن أي حق في مناسبة ما لا يعني التنازل عنه في المناسبات اللاحقة.",
      ],
    },
    {
      title: "إنهاء الخدمة",
      paragraphs: [
        "يمكنك إلغاء حسابك في أي وقت من إعدادات الحساب أو بالتواصل معنا. عند الإلغاء، تُحذف بياناتك وفق سياسة حذف البيانات المنشورة على المنصة.",
      ],
    },
    {
      title: "التعديلات على الشروط",
      paragraphs: [
        "قد نحدّث هذه الشروط من وقت لآخر. سنخطرك بالتغييرات الجوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة قبل 14 يوماً من سريانها. استمرارك في استخدام المنصة بعد سريان التعديلات يعد موافقة عليها.",
      ],
    },
  ],
}

const enContent: typeof arContent = {
  title: "Terms & Conditions",
  lastUpdated: "July 12, 2026",
  intro: "Welcome to Hubqa (حبقة). By using the platform or creating an account, you agree to be bound by these Terms & Conditions in full. Please read them carefully before using our services. If you do not agree to any provision, please do not use the platform.",
  sections: [
    {
      title: "Definition of the Service",
      paragraphs: [
        "Hubqa is a cloud (SaaS) platform that lets business owners automate replies to comments and messages received on social media platforms (Facebook, Instagram, WhatsApp), manage conversations from a unified inbox, create auto-reply rules, and send automatic private messages to commenters.",
      ],
    },
    {
      title: "Accounts & Registration",
      paragraphs: [
        "Information provided at registration must be true, accurate, and up to date. You are solely responsible for keeping your login credentials confidential and for all activity that occurs under your account.",
      ],
      bullets: [
        "You must be at least 18 years old to create an account.",
        "Accounts may not be shared with outside parties except through the official team-management feature.",
        "We may suspend or terminate any account that violates these terms without prior notice.",
      ],
    },
    {
      title: "Acceptable Use",
      paragraphs: [
        "You agree to use the platform lawfully and ethically, and in a manner consistent with the policies of connected social media platforms (including Meta's developer policies). The following are strictly prohibited:",
      ],
      bullets: [
        "Sending spam, misleading content, or fraudulent messages.",
        "Using the platform to publish content that is unlawful or incites hatred or violence.",
        "Attempting to breach the platform or gain unauthorized access to other users' accounts.",
        "Connecting pages or accounts you do not have authority to manage.",
        "Reselling or renting out the service without a prior written agreement with us.",
      ],
    },
    {
      title: "Subscriptions & Payment",
      paragraphs: [
        "The platform offers multiple plans: Free (with defined usage limits), Pro, and Enterprise. Each plan's limits (number of connected channels and monthly replies) are enforced automatically.",
      ],
      bullets: [
        "Paid subscriptions renew automatically unless cancelled before the renewal date.",
        "If you exceed your plan's limits, automatic replies pause until the start of the next month or until you upgrade your plan.",
        "We may adjust pricing with at least 30 days' prior notice.",
        "Amounts paid for partially used periods are non-refundable except as required by applicable law.",
      ],
    },
    {
      title: "Connecting Social Media Accounts",
      paragraphs: [
        "When you connect your pages via Facebook, you grant the platform limited permissions (reading comments, replying to them, sending messages) through Meta's official APIs. Access tokens are stored encrypted with the AES-256 standard and are never shared with any third party.",
        "You acknowledge that your use of automation features is also subject to Meta's own terms and policies, and that Hubqa is not responsible for any action Meta takes against your pages as a result of your violation of Meta's policies.",
      ],
    },
    {
      title: "Intellectual Property",
      paragraphs: [
        "All rights to the platform, its design, source code, and trademark are owned by Hubqa. Users retain ownership of the content they create (reply text, rules, customer data), and grant us a limited license to process it solely for the purpose of providing the service.",
      ],
    },
    {
      title: "Disclaimer of Warranties & Limitation of Liability",
      paragraphs: [
        "The service is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including but not limited to warranties of fitness for a particular purpose, non-infringement, or accuracy. We do not guarantee uninterrupted or error-free operation of the service, particularly with respect to outages or changes originating from third-party platforms (Meta and others).",
        "Under no circumstances shall we be liable for any indirect, incidental, consequential, or punitive damages, including loss of profits, revenue, data, goodwill, or business opportunities, even if advised of the possibility of such damages in advance. Our total liability in any case shall not exceed the amount you actually paid during the three months preceding the claim, or (100) US dollars if you are on the Free plan, whichever is less.",
      ],
    },
    {
      title: "Your Responsibility for Content & Data",
      paragraphs: [
        "You are solely and fully responsible for the content of the replies and messages you create through the platform, for the lawfulness of your collection and processing of your customers' data, and for obtaining any consents required from them under the data-protection laws applicable in your country. Hubqa acts as a technical data processor on your behalf; you remain the data controller and its legal owner.",
      ],
    },
    {
      title: "Indemnification",
      paragraphs: [
        "You agree to indemnify, defend, and hold harmless Hubqa, its owners, employees, and agents from any claims, lawsuits, losses, damages, or expenses (including reasonable attorney's fees) arising out of or related to: (a) your use of the platform in violation of these terms; (b) your violation of any law or third-party platform regulations; (c) content you submit through the platform; (d) your violation of any third party's rights, including privacy and intellectual-property rights.",
      ],
    },
    {
      title: "Force Majeure",
      paragraphs: [
        "We are not liable for any delay or failure to perform our obligations resulting from causes beyond our reasonable control, including natural disasters, internet or power outages, wars, epidemics, government decisions, cyberattacks, or changes or disruptions to third-party platforms' APIs.",
      ],
    },
    {
      title: "Governing Law & Dispute Resolution",
      paragraphs: [
        "These terms are governed by and construed in accordance with the laws applicable in the platform owner's country of registration, without regard to conflict-of-law rules. Any disputes arising from these terms shall first be resolved amicably within 30 days of written notice; failing that, they shall be referred to the competent court in the same jurisdiction. You agree to bring any claim only in your individual capacity, and not as part of a class action.",
      ],
    },
    {
      title: "Severability",
      paragraphs: [
        "If a competent court rules any provision of these terms invalid or unenforceable, that provision shall remain in effect to the maximum extent permitted by law, and the remaining provisions shall remain in full force. Our failure to enforce any right on one occasion does not waive that right on any subsequent occasion.",
      ],
    },
    {
      title: "Termination of Service",
      paragraphs: [
        "You may cancel your account at any time from your account settings or by contacting us. Upon cancellation, your data is deleted in accordance with the data-deletion policy published on the platform.",
      ],
    },
    {
      title: "Changes to These Terms",
      paragraphs: [
        "We may update these terms from time to time. We will notify you of material changes by email or an in-platform notice at least 14 days before they take effect. Your continued use of the platform after changes take effect constitutes your acceptance of them.",
      ],
    },
  ],
}

export function TermsContent() {
  const { locale } = useLanguage()
  const content = locale === "ar" ? arContent : enContent
  return <LegalPage {...content} />
}
