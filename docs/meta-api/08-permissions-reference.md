# 08 - مرجع الأذونات (Permissions Reference)

> [!NOTE]
> هذا المرجع يوثق جميع الأذونات المطلوبة لمنصات Meta (Facebook، Instagram، WhatsApp) مع شرح كل إذن وعلاقته بمشروع Hubqa.
> آخر تحديث: يوليو 2026 | Graph API v25.0

---

## جدول المحتويات

1. [نظرة عامة على نظام الأذونات](#نظرة-عامة-على-نظام-الأذونات)
2. [أذونات Facebook Pages](#أذونات-facebook-pages)
3. [أذونات Instagram](#أذونات-instagram)
4. [أذونات WhatsApp](#أذونات-whatsapp)
5. [مستويات الوصول (Access Levels)](#مستويات-الوصول-access-levels)
6. [OAuth Scopes لمشروع Hubqa](#oauth-scopes-لمشروع-hubqa)
7. [مصفوفة الأذونات والميزات](#مصفوفة-الأذونات-والميزات)

---

## نظرة عامة على نظام الأذونات

### كيف يعمل نظام الأذونات في Meta

```
المستخدم يمنح الأذونات عبر OAuth Dialog
          ↓
التطبيق يحصل على Access Token يحتوي الأذونات الممنوحة
          ↓
كل API call يتحقق أن الـ Token يحتوي الإذن المطلوب
          ↓
إذا لم يكن الإذن موجوداً → Error Code 10 أو 200
```

### ملاحظات أساسية

| النقطة | التفصيل |
|---|---|
| **Granular Permissions** | المستخدم يمكنه رفض أذونات محددة مع قبول الباقي |
| **Re-request** | يمكنك طلب الأذونات المرفوضة مرة أخرى |
| **Check Permissions** | استخدم `GET /me/permissions` للتحقق |
| **Revoke** | المستخدم يمكنه سحب الأذونات في أي وقت |

### التحقق من الأذونات الممنوحة

```bash
GET https://graph.facebook.com/v25.0/me/permissions
Authorization: Bearer {access_token}
```

```json
{
  "data": [
    {
      "permission": "pages_show_list",
      "status": "granted"
    },
    {
      "permission": "pages_messaging",
      "status": "declined"
    }
  ]
}
```

---

## أذونات Facebook Pages

### جدول الأذونات الكامل

| الإذن | الغرض | مطلوب لـ | مستوى الوصول |
|---|---|---|---|
| `pages_show_list` | عرض قائمة صفحات المستخدم | اختيار الصفحة في OAuth | Standard → Advanced |
| `pages_manage_metadata` | إدارة إعدادات الصفحة وتسجيل Webhooks | إعداد Webhooks | Advanced |
| `pages_read_engagement` | قراءة المنشورات والتعليقات والتفاعلات | معالجة التعليقات | Advanced |
| `pages_read_user_content` | قراءة المحتوى الذي ينشئه المستخدمون | قراءة التعليقات | Advanced |
| `pages_manage_engagement` | الرد على التعليقات، حذفها، إخفاؤها | الرد التلقائي على التعليقات | Advanced |
| `pages_manage_posts` | إنشاء وتعديل وحذف المنشورات | إدارة المنشورات | Advanced |
| `pages_messaging` | إرسال واستقبال رسائل Messenger | أتمتة الرسائل الخاصة | Advanced |

### تفصيل كل إذن

---

#### `pages_show_list`

```
الغرض: يسمح لتطبيقك بعرض قائمة الصفحات التي يديرها المستخدم
يُستخدم مع: GET /me/accounts
```

**ماذا يتيح:**
- `GET /me/accounts` — قائمة الصفحات مع Page Access Tokens
- الحصول على `page_id` و `access_token` و `name` لكل صفحة

**مثال الاستخدام:**
```bash
GET https://graph.facebook.com/v25.0/me/accounts
  ?access_token={user_access_token}
```

```json
{
  "data": [
    {
      "access_token": "PAGE_ACCESS_TOKEN",
      "category": "Software",
      "id": "123456789",
      "name": "My Business Page"
    }
  ]
}
```

**في Hubqa:** يُستخدم في `handleFacebookCallback()` لعرض صفحات المستخدم واختيار الصفحة للربط.

---

#### `pages_manage_metadata`

```
الغرض: إدارة إعدادات الصفحة وتسجيل/إلغاء تسجيل Webhooks
يُستخدم مع: POST /{page-id}/subscribed_apps, DELETE /{page-id}/subscribed_apps
```

**ماذا يتيح:**
- `POST /{page-id}/subscribed_apps` — تسجيل Webhook subscriptions
- `DELETE /{page-id}/subscribed_apps` — إلغاء تسجيل Webhooks
- `GET /{page-id}/subscribed_apps` — عرض التسجيلات الحالية

**مثال تسجيل Webhook:**
```bash
POST https://graph.facebook.com/v25.0/{page-id}/subscribed_apps
  ?subscribed_fields=feed,messages,messaging_postbacks
  &access_token={page_access_token}
```

**في Hubqa:** يُستخدم في `subscribeWebhook()` لتفعيل استقبال الأحداث للصفحة.

---

#### `pages_read_engagement`

```
الغرض: قراءة المنشورات والتعليقات والتفاعلات (likes, reactions)
يُستخدم مع: GET /{page-id}/posts, GET /{post-id}/comments
```

**ماذا يتيح:**
- `GET /{page-id}/posts` — قائمة منشورات الصفحة
- `GET /{post-id}/comments` — تعليقات منشور
- `GET /{post-id}/reactions` — تفاعلات منشور
- `GET /{comment-id}` — تفاصيل تعليق

**في Hubqa:** يُستخدم في `getChannelPosts()` لعرض المنشورات و `processComment()` لقراءة بيانات التعليق.

---

#### `pages_read_user_content`

```
الغرض: قراءة المحتوى المنشور من المستخدمين (visitor posts, tagged content)
يُستخدم مع: GET /{page-id}/feed (includes visitor posts)
```

**ماذا يتيح:**
- قراءة المنشورات التي ينشئها الزوار على الصفحة
- قراءة المحتوى الموسوم (tagged content)
- الوصول لتعليقات المستخدمين

**ملاحظة:** هذا الإذن يكمل `pages_read_engagement` — بدونه لن تتمكن من رؤية بعض التعليقات.

---

#### `pages_manage_engagement`

```
الغرض: الرد على التعليقات، حذفها، إخفاؤها
يُستخدم مع: POST /{comment-id}/comments, DELETE /{comment-id}
```

**ماذا يتيح:**
- `POST /{comment-id}/comments` — الرد على تعليق
- `DELETE /{comment-id}` — حذف تعليق
- `POST /{comment-id}?is_hidden=true` — إخفاء تعليق

**مثال الرد على تعليق:**
```bash
POST https://graph.facebook.com/v25.0/{comment-id}/comments
  ?message=Thank+you+for+your+comment!
  &access_token={page_access_token}
```

**في Hubqa:** يُستخدم في `executeRule()` للرد التلقائي على التعليقات.

---

#### `pages_manage_posts`

```
الغرض: إنشاء وتعديل وحذف المنشورات
يُستخدم مع: POST /{page-id}/feed, DELETE /{post-id}
```

**ماذا يتيح:**
- `POST /{page-id}/feed` — إنشاء منشور جديد
- `POST /{page-id}/photos` — نشر صورة
- `POST /{page-id}/videos` — نشر فيديو
- `DELETE /{post-id}` — حذف منشور

**في Hubqa:** غير مُستخدم حالياً — مخطط للإصدارات القادمة (نشر المنشورات وجدولتها).

---

#### `pages_messaging`

```
الغرض: إرسال واستقبال رسائل Messenger عبر الصفحة
يُستخدم مع: POST /me/messages
```

**ماذا يتيح:**
- `POST /me/messages` — إرسال رسالة Messenger
- استقبال أحداث الرسائل عبر Webhooks
- إرسال أنواع مختلفة (نص، صور، templates)

**مثال إرسال رسالة:**
```bash
POST https://graph.facebook.com/v25.0/me/messages
Content-Type: application/json

{
  "recipient": { "id": "USER_PSID" },
  "message": { "text": "Hello! How can I help you?" },
  "access_token": "{page_access_token}"
}
```

**في Hubqa:** يُستخدم في `executeRule()` لإرسال الرسائل الخاصة التلقائية.

> [!IMPORTANT]
> **قاعدة الـ 24 ساعة:** بعد مرور 24 ساعة من آخر رسالة من المستخدم، لا يمكن إرسال رسائل إلا باستخدام **Message Tags** المعتمدة أو **One-Time Notification** requests.

---

## أذونات Instagram

### جدول الأذونات الكامل

| الإذن | الغرض | مطلوب لـ | مستوى الوصول |
|---|---|---|---|
| `instagram_basic` | معلومات الحساب والوسائط | إعداد الحساب | Standard → Advanced |
| `instagram_manage_comments` | قراءة التعليقات والرد عليها | أتمتة التعليقات | Advanced |
| `instagram_manage_messages` | إرسال واستقبال DMs | أتمتة الرسائل، Story mentions | Advanced |
| `instagram_content_publish` | نشر المحتوى (stories, posts) | نشر Stories/Posts | Advanced |

### تفصيل كل إذن

---

#### `instagram_basic`

```
الغرض: الوصول لمعلومات حساب Instagram الأساسية
يُستخدم مع: GET /{ig-user-id}, GET /{ig-user-id}/media
```

**ماذا يتيح:**
- `GET /{ig-user-id}` — معلومات الحساب (username, name, profile_picture_url)
- `GET /{ig-user-id}/media` — قائمة الوسائط المنشورة
- `GET /{media-id}` — تفاصيل وسيط محدد

**مثال:**
```bash
GET https://graph.facebook.com/v25.0/{ig-user-id}
  ?fields=id,username,name,profile_picture_url,followers_count,media_count
  &access_token={access_token}
```

```json
{
  "id": "17841400000000000",
  "username": "mybusiness",
  "name": "My Business",
  "profile_picture_url": "https://...",
  "followers_count": 5000,
  "media_count": 120
}
```

---

#### `instagram_manage_comments`

```
الغرض: قراءة التعليقات والرد عليها وحذفها
يُستخدم مع: GET /{media-id}/comments, POST /{comment-id}/replies
```

**ماذا يتيح:**
- `GET /{media-id}/comments` — قراءة تعليقات على منشور
- `POST /{comment-id}/replies` — الرد على تعليق
- `DELETE /{comment-id}` — حذف تعليق
- `POST /{comment-id}?hide=true` — إخفاء تعليق

**مثال الرد على تعليق Instagram:**
```bash
POST https://graph.facebook.com/v25.0/{comment-id}/replies
  ?message=Thanks+for+your+comment!
  &access_token={access_token}
```

> [!WARNING]
> **فرق مهم عن Facebook:**
> - Facebook: `POST /{comment-id}/comments` (endpoint: **comments**)
> - Instagram: `POST /{comment-id}/replies` (endpoint: **replies**)
> 
> استخدام الـ endpoint الخاطئ سيعطي خطأ!

---

#### `instagram_manage_messages`

```
الغرض: إرسال واستقبال رسائل Instagram Direct
يُستخدم مع: POST /{ig-user-id}/messages, Webhooks messaging
```

**ماذا يتيح:**
- إرسال رسائل DM عبر Instagram
- استقبال رسائل DM عبر Webhooks
- استقبال Story mentions و Story replies عبر Webhooks
- Generic template messages

**مثال إرسال DM:**
```bash
POST https://graph.facebook.com/v25.0/{ig-user-id}/messages
Content-Type: application/json

{
  "recipient": { "id": "IG_SCOPED_USER_ID" },
  "message": { "text": "Hello from Instagram DM!" },
  "access_token": "{access_token}"
}
```

**في Hubqa:** يُستخدم في `processPrivateDM()` لاستقبال الرسائل و `handleStoryEvent()` لاكتشاف Story mentions.

---

#### `instagram_content_publish`

```
الغرض: نشر محتوى (صور، فيديوهات، Stories، Reels)
يُستخدم مع: POST /{ig-user-id}/media, POST /{ig-user-id}/media_publish
```

**ماذا يتيح:**
- نشر صور ومقاطع فيديو
- نشر Stories
- نشر Reels
- نشر Carousel posts

**مثال نشر صورة (عملية من خطوتين):**

```bash
# الخطوة 1: إنشاء Container
POST https://graph.facebook.com/v25.0/{ig-user-id}/media
  ?image_url=https://example.com/photo.jpg
  &caption=Check+this+out!
  &access_token={access_token}

# Response: { "id": "CONTAINER_ID" }

# الخطوة 2: النشر
POST https://graph.facebook.com/v25.0/{ig-user-id}/media_publish
  ?creation_id={CONTAINER_ID}
  &access_token={access_token}
```

**في Hubqa:** غير مُستخدم حالياً — مخطط للإصدارات القادمة.

---

## أذونات WhatsApp

### جدول الأذونات الكامل

| الإذن | الغرض | مطلوب لـ | ملاحظات |
|---|---|---|---|
| `whatsapp_business_messaging` | إرسال واستقبال رسائل WhatsApp | جميع عمليات المراسلة | أساسي لأي تكامل |
| `whatsapp_business_management` | إدارة إعدادات WABA وقوالب الرسائل | إدارة القوالب، إعدادات الحساب | إداري |

### تفصيل كل إذن

---

#### `whatsapp_business_messaging`

```
الغرض: إرسال واستقبال رسائل WhatsApp عبر Cloud API
يُستخدم مع: POST /{phone-number-id}/messages
```

**ماذا يتيح:**
- إرسال رسائل نصية
- إرسال رسائل وسائط (صور، فيديو، مستندات)
- إرسال Template messages
- إرسال Interactive messages (buttons, lists)
- استقبال الرسائل عبر Webhooks
- تحديثات حالة التوصيل

**مثال إرسال رسالة نصية:**
```bash
POST https://graph.facebook.com/v25.0/{phone-number-id}/messages
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "text",
  "text": {
    "body": "Hello from WhatsApp Business!"
  }
}
```

**مثال إرسال Template message:**
```bash
POST https://graph.facebook.com/v25.0/{phone-number-id}/messages
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Customer Name" }
        ]
      }
    ]
  }
}
```

---

#### `whatsapp_business_management`

```
الغرض: إدارة WhatsApp Business Account (WABA) وقوالب الرسائل
يُستخدم مع: GET/POST /{waba-id}/message_templates
```

**ماذا يتيح:**
- `GET /{waba-id}/message_templates` — عرض القوالب
- `POST /{waba-id}/message_templates` — إنشاء قالب جديد
- `DELETE /{waba-id}/message_templates` — حذف قالب
- إدارة إعدادات WABA
- إدارة أرقام الهاتف

**مثال إنشاء قالب:**
```bash
POST https://graph.facebook.com/v25.0/{waba-id}/message_templates
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "name": "order_confirmation",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Order Confirmed ✅"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, your order #{{2}} has been confirmed!"
    },
    {
      "type": "FOOTER",
      "text": "Thank you for shopping with us"
    }
  ]
}
```

---

## مستويات الوصول (Access Levels)

### الفرق بين Standard Access و Advanced Access

| الخاصية | Standard Access | Advanced Access |
|---|---|---|
| **المتطلبات** | تلقائي عند إنشاء التطبيق | App Review + Business Verification |
| **من يستخدم** | مستخدمو أدوار التطبيق فقط (مطورون، مختبرون) | أي مستخدم Facebook |
| **الحدود** | حتى 5 مستخدمين | بلا حدود |
| **الغرض** | التطوير والاختبار | الإنتاج |
| **البيانات** | بيانات اختبارية محدودة | بيانات حقيقية كاملة |

### مخطط الوصول

```
Standard Access (تلقائي)
    │
    ├── يكفي لـ: التطوير، الاختبار، بناء MVP
    ├── المستخدمون: فقط من لديهم دور في التطبيق
    └── القيود: لا يمكن الإطلاق للعامة
    │
    ▼
Advanced Access (يتطلب مراجعة)
    │
    ├── يتطلب: App Review submission
    ├── يتطلب: Business Verification (لمعظم الأذونات)
    ├── المدة: ~20 يوم عمل
    └── النتيجة: يمكن لأي مستخدم استخدام تطبيقك
```

### حالات خاصة

> [!TIP]
> **المطورون المباشرون (Direct Developers):**
> إذا كان تطبيقك لاستخدام شركتك فقط (وليس SaaS):
> - قد لا تحتاج App Review لبعض أذونات WhatsApp
> - لكن **لا يزال** يتطلب Business Verification
> - هذا **لا ينطبق** على Hubqa لأنه منصة SaaS

> [!WARNING]
> **Hubqa كمنصة SaaS يحتاج App Review لجميع الأذونات** لأن مستخدمين خارجيين سيربطون حساباتهم.

---

## OAuth Scopes لمشروع Hubqa

### الأذونات المطلوبة في OAuth Dialog

#### Facebook OAuth

```typescript
// الأذونات المطلوبة في Facebook Login Dialog
const FACEBOOK_SCOPES = [
  'pages_show_list',          // عرض الصفحات
  'pages_manage_metadata',    // Webhook setup
  'pages_read_engagement',    // قراءة التعليقات
  'pages_manage_engagement',  // الرد على التعليقات
  'pages_manage_posts',       // إدارة المنشورات
  'pages_messaging',          // Messenger
].join(',');

// رابط OAuth Dialog
const oauthUrl = `https://www.facebook.com/v25.0/dialog/oauth?`
  + `client_id=${FACEBOOK_APP_ID}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  + `&scope=${FACEBOOK_SCOPES}`
  + `&state=${CSRF_STATE}`
  + `&response_type=code`;
```

#### Instagram OAuth

```typescript
// الأذونات المطلوبة في Instagram Login Dialog
const INSTAGRAM_SCOPES = [
  'instagram_basic',              // معلومات الحساب
  'instagram_manage_comments',    // إدارة التعليقات
  'instagram_manage_messages',    // إدارة الرسائل
].join(',');

// رابط OAuth Dialog
const oauthUrl = `https://www.facebook.com/v25.0/dialog/oauth?`
  + `client_id=${INSTAGRAM_APP_ID}`
  + `&redirect_uri=${encodeURIComponent(INSTAGRAM_REDIRECT_URI)}`
  + `&scope=${INSTAGRAM_SCOPES}`
  + `&state=${CSRF_STATE}`
  + `&response_type=code`;
```

### قائمة الأذونات الكاملة (Comma-Separated)

```
pages_show_list,pages_manage_metadata,pages_read_engagement,pages_manage_engagement,pages_manage_posts,pages_messaging,instagram_basic,instagram_manage_comments,instagram_manage_messages
```

---

## مصفوفة الأذونات والميزات

### ما يحتاجه كل ميزة في Hubqa

| ميزة Hubqa | الأذونات المطلوبة | المنصة |
|---|---|---|
| **ربط صفحة Facebook** | `pages_show_list` | Facebook |
| **تفعيل Webhooks** | `pages_manage_metadata` | Facebook |
| **قراءة التعليقات** | `pages_read_engagement`, `pages_read_user_content` | Facebook |
| **الرد على التعليقات** | `pages_manage_engagement` | Facebook |
| **إرسال DM من تعليق** | `pages_messaging` | Facebook |
| **رسائل Messenger التلقائية** | `pages_messaging` | Facebook |
| **ربط حساب Instagram** | `instagram_basic` | Instagram |
| **الرد على تعليقات IG** | `instagram_manage_comments` | Instagram |
| **رسائل Instagram DM** | `instagram_manage_messages` | Instagram |
| **اكتشاف Story Mentions** | `instagram_manage_messages` | Instagram |
| **رسائل WhatsApp** | `whatsapp_business_messaging` | WhatsApp |
| **قوالب WhatsApp** | `whatsapp_business_management` | WhatsApp |

### التحقق من الأذونات برمجياً

```typescript
async function checkPermissions(accessToken: string): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v25.0/me/permissions?access_token=${accessToken}`
  );
  const data = await response.json();

  const requiredPermissions = [
    'pages_show_list',
    'pages_manage_metadata',
    'pages_read_engagement',
    'pages_manage_engagement',
    'pages_messaging',
  ];

  const granted = data.data
    .filter((p: any) => p.status === 'granted')
    .map((p: any) => p.permission);

  const missing = requiredPermissions.filter(p => !granted.includes(p));

  if (missing.length > 0) {
    console.warn('⚠️ Missing permissions:', missing);
    // يمكن عرض رسالة للمستخدم لإعادة طلب الأذونات
  }
}
```

### إعادة طلب أذونات مرفوضة

```typescript
// إعادة طلب الأذونات المرفوضة
const reAuthUrl = `https://www.facebook.com/v25.0/dialog/oauth?`
  + `client_id=${APP_ID}`
  + `&redirect_uri=${REDIRECT_URI}`
  + `&scope=${MISSING_PERMISSIONS.join(',')}`
  + `&auth_type=rerequest`   // مهم: يفرض إعادة عرض الأذونات
  + `&state=${CSRF_STATE}`;
```

> [!CAUTION]
> بدون `auth_type=rerequest`، لن يُعرض Dialog الأذونات إذا سبق للمستخدم رفضها. سيحصل تطبيقك على token بدون الأذونات المرفوضة بصمت.

---

> [!NOTE]
> لمزيد من المعلومات حول عملية App Review والحصول على Advanced Access، راجع [11-app-review.md](./11-app-review.md).
> لقائمة أكواد الأخطاء المتعلقة بالأذونات (Code 10, 200)، راجع [10-error-codes.md](./10-error-codes.md).
