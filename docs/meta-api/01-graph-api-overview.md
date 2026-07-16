# 📘 نظرة عامة على Graph API

> مرجع شامل لـ Facebook Graph API — الإصدارات، دورة الحياة، التغييرات العاجلة، وأفضل الممارسات لمشروع Hubqa.

---

## جدول المحتويات

- [ما هو Graph API؟](#ما-هو-graph-api)
- [الإصدار الحالي](#الإصدار-الحالي)
- [دورة حياة الإصدارات](#دورة-حياة-الإصدارات)
- [تحديث مشروعنا من v21.0 إلى v25.0](#تحديث-مشروعنا-من-v210-إلى-v250)
- [التغييرات العاجلة الأخيرة](#التغييرات-العاجلة-الأخيرة)
- [عنوان URL الأساسي والبنية](#عنوان-url-الأساسي-والبنية)
- [أفضل الممارسات](#أفضل-الممارسات)
- [المصادقة والتوكنات](#المصادقة-والتوكنات)
- [التعامل مع الأخطاء](#التعامل-مع-الأخطاء)
- [حدود الاستخدام (Rate Limiting)](#حدود-الاستخدام-rate-limiting)

---

## ما هو Graph API؟

Graph API هو الطريقة الأساسية لإدخال البيانات وإخراجها من منصة Facebook. إنه واجهة برمجة تطبيقات مبنية على HTTP وتعمل بنظام RESTful تتيح لك:

- قراءة ونشر البيانات على Facebook وInstagram وMessenger وWhatsApp
- إدارة الصفحات والتعليقات والرسائل
- الاشتراك في Webhooks للحصول على تحديثات فورية
- إدارة الإعلانات والحملات

```
GET  https://graph.facebook.com/v25.0/{node-id}
POST https://graph.facebook.com/v25.0/{node-id}/{edge}
```

كل عنصر في Facebook (مستخدم، صفحة، منشور، تعليق، صورة) هو **Node** وله معرّف فريد (ID).
العلاقات بين العناصر تُسمى **Edges** (مثل: `/{page-id}/posts`).
خصائص كل عنصر تُسمى **Fields** (مثل: `name`, `id`, `picture`).

---

## الإصدار الحالي

| المعلومة | القيمة |
|---|---|
| **أحدث إصدار** | `v25.0` |
| **تاريخ الإصدار** | 18 فبراير 2026 |
| **Base URL** | `https://graph.facebook.com/v25.0` |

```
https://graph.facebook.com/v25.0/me?fields=id,name&access_token=TOKEN
```

---

## دورة حياة الإصدارات

> [!IMPORTANT]
> كل إصدار من Graph API يبقى فعّالاً لمدة **سنتين** تقريباً من تاريخ إصداره. بعد انتهاء صلاحيته، تُوجَّه جميع الاستدعاءات تلقائياً إلى أقدم إصدار فعّال.

| الإصدار | الحالة | تاريخ الإصدار | تاريخ الانتهاء | ملاحظات |
|---------|--------|---------------|----------------|---------|
| **v25.0** | ✅ حالي (Current) | 18 فبراير 2026 | ~ فبراير 2028 | الإصدار الموصى به |
| **v24.0** | ✅ فعّال (Active) | — | — | لا يزال مدعوماً |
| **v23.0** | ⚠️ منتهي | — | يونيو 2026 | انتهت صلاحيته |
| **v22.0** | ❌ منتهي (Expired) | — | — | غير مدعوم |
| **v21.0** | ❌ منتهي (Expired) | — | — | **⚠️ إصدار مشروعنا الحالي!** |

### ماذا يحدث عند استخدام إصدار منتهي؟

```
// ❌ استدعاء بإصدار منتهٍ
GET https://graph.facebook.com/v21.0/me/accounts

// ⚠️ Meta تعيد توجيهه تلقائياً إلى أقدم إصدار فعّال
// لكن قد تختفي بعض الحقول أو تتغير الاستجابة بدون تحذير!
```

> [!CAUTION]
> استخدام إصدار منتهٍ يعني أن سلوك API قد يتغير بدون سابق إنذار. **يجب التحديث فوراً!**

---

## تحديث مشروعنا من v21.0 إلى v25.0

### 🚨 المشكلة

مشروع Hubqa يستخدم حالياً `v21.0` وهو إصدار **منتهي الصلاحية**. يجب التحديث إلى `v25.0` فوراً.

### في مشروعنا (Hubqa)

**الملف:** `backend/src/common/graph-api.ts`

```diff
// backend/src/common/graph-api.ts

- const GRAPH_API_VERSION = 'v21.0';
+ const GRAPH_API_VERSION = 'v25.0';
```

### خطوات التحديث الكاملة

1. **تحديث ثابت الإصدار:**
   ```typescript
   // backend/src/common/graph-api.ts
   export const GRAPH_API_VERSION = 'v25.0';
   export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
   ```

2. **مراجعة Breaking Changes** بين v21.0 و v25.0 (انظر القسم التالي)

3. **اختبار جميع Endpoints المستخدمة:**
   - `/me/accounts` — الحصول على قائمة الصفحات
   - `/{page-id}/subscribed_apps` — الاشتراك بالـ Webhooks
   - `/me/messages` — إرسال رسائل Messenger/Instagram
   - `/{page-id}/feed` — قراءة المنشورات
   - `/{comment-id}/comments` — الرد على التعليقات

4. **تحديث بيئة الاختبار** ثم الإنتاج

> [!WARNING]
> لا تنسَ اختبار **جميع** التدفقات بعد التحديث: OAuth، Webhooks، الرد التلقائي، الرسائل الخاصة.

---

## التغييرات العاجلة الأخيرة

### 1. إزالة `metadata=1` — مايو 2026

```
// ❌ لم يعد يعمل
GET /v25.0/{node-id}?metadata=1

// ✅ البديل: استخدم الحقول المحددة
GET /v25.0/{node-id}?fields=id,name,type
```

تم إزالة معامل `metadata=1` الذي كان يُرجع معلومات وصفية عن الـ Node (مثل نوعه والحقول المتاحة).

### 2. حظر حملات Advantage+ معينة

بعض أنواع حملات Advantage+ الإعلانية أصبحت محظورة عبر API. هذا **لا يؤثر على مشروع Hubqa** لأننا لا نتعامل مع الإعلانات.

### 3. تقاعد مقاييس (Metrics) — يونيو 2026

بعض مقاييس الإعلانات والإحصائيات تمت إزالتها. لا يؤثر على مشروعنا مباشرة.

### 4. شهادة mTLS CA جديدة — مارس 2026

```
// إذا كنت تستخدم Webhook مع mTLS:
// يجب تحديث شهادة CA إلى الشهادة الجديدة الصادرة في مارس 2026
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#mtls
```

> [!NOTE]
> مشروع Hubqa لا يستخدم mTLS حالياً، لكن يجب مراقبة هذا في حال إضافته مستقبلاً.

---

## عنوان URL الأساسي والبنية

### البنية العامة

```
https://graph.facebook.com/{version}/{node-or-edge}?{params}&access_token={token}
```

### أمثلة عملية

```bash
# قراءة بيانات صفحة
GET https://graph.facebook.com/v25.0/123456789?fields=name,fan_count&access_token=TOKEN

# قراءة منشورات صفحة
GET https://graph.facebook.com/v25.0/123456789/posts?fields=message,created_time&access_token=TOKEN

# نشر تعليق
POST https://graph.facebook.com/v25.0/POST_ID/comments
Content-Type: application/json
{
  "message": "شكراً لك!",
  "access_token": "TOKEN"
}
```

### رؤوس الطلبات (Headers)

```http
GET /v25.0/me HTTP/1.1
Host: graph.facebook.com
Authorization: Bearer {access-token}
Accept: application/json
```

> [!TIP]
> يمكنك إرسال `access_token` إما كمعامل في URL أو في رأس `Authorization: Bearer`. الطريقة الثانية أكثر أماناً.

---

## أفضل الممارسات

### 1. دائماً حدد الإصدار بشكل صريح (Hardcode)

```typescript
// ✅ صحيح — إصدار محدد
const url = `https://graph.facebook.com/v25.0/${pageId}/feed`;

// ❌ خطأ — بدون إصدار
const url = `https://graph.facebook.com/${pageId}/feed`;
// ⚠️ سيستخدم أقدم إصدار فعّال — سلوك غير متوقع!
```

### 2. استخدم Field Selection

```bash
# ❌ يجلب كل الحقول الافتراضية (أبطأ، بيانات أكثر)
GET /v25.0/me

# ✅ يجلب فقط ما تحتاجه (أسرع، بيانات أقل)
GET /v25.0/me?fields=id,name,email
```

### 3. تعامل مع Pagination

```json
{
  "data": [ ... ],
  "paging": {
    "cursors": {
      "before": "CURSOR_BEFORE",
      "after": "CURSOR_AFTER"
    },
    "next": "https://graph.facebook.com/v25.0/.../posts?after=CURSOR_AFTER",
    "previous": "https://graph.facebook.com/v25.0/.../posts?before=CURSOR_BEFORE"
  }
}
```

```typescript
// مثال على التعامل مع Pagination في مشروعنا
async function getAllPosts(pageId: string, token: string) {
  let url = `${GRAPH_API_BASE}/${pageId}/posts?fields=message,created_time&limit=100`;
  const allPosts = [];
  
  while (url) {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    allPosts.push(...response.data.data);
    url = response.data.paging?.next || null;
  }
  
  return allPosts;
}
```

### 4. استخدم Batch Requests لتقليل الاستدعاءات

```bash
POST https://graph.facebook.com/v25.0/
Content-Type: application/json

{
  "access_token": "TOKEN",
  "batch": [
    { "method": "GET", "relative_url": "me/accounts" },
    { "method": "GET", "relative_url": "PAGE_ID?fields=name,fan_count" }
  ]
}
```

---

## المصادقة والتوكنات

### أنواع التوكنات

| النوع | المدة | الاستخدام |
|-------|-------|-----------|
| **User Access Token** (قصير) | ~1-2 ساعة | اختبار فقط |
| **User Access Token** (طويل) | ~60 يوم | عمليات المستخدم |
| **Page Access Token** | لا تنتهي* | إدارة الصفحة والرسائل |
| **App Access Token** | لا تنتهي | عمليات التطبيق |
| **System User Token** | لا تنتهي | Business Manager |

> \* Page tokens المستخرجة من long-lived user token لا تنتهي **طالما** user token الأصلي صالح.

### التحقق من صلاحية التوكن

```bash
GET https://graph.facebook.com/v25.0/debug_token?input_token=TOKEN&access_token=APP_ID|APP_SECRET
```

```json
{
  "data": {
    "app_id": "123456",
    "type": "PAGE",
    "application": "Hubqa",
    "is_valid": true,
    "expires_at": 0,
    "scopes": [
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging"
    ]
  }
}
```

> [!TIP]
> راجع ملف [03-oauth-login.md](./03-oauth-login.md) للتفاصيل الكاملة عن تدفق OAuth والتوكنات.

---

## التعامل مع الأخطاء

### بنية الخطأ القياسية

```json
{
  "error": {
    "message": "Invalid OAuth access token - Cannot parse access token",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463,
    "fbtrace_id": "AbC123xYz"
  }
}
```

### أكواد الأخطاء الشائعة

| Code | Subcode | المعنى | الحل |
|------|---------|--------|------|
| **190** | 463 | Token منتهي الصلاحية | تجديد التوكن |
| **190** | 467 | Token غير صالح | إعادة المصادقة |
| **10** | — | صلاحيات ناقصة | طلب الصلاحيات المطلوبة |
| **100** | — | معامل غير صالح | التحقق من المعاملات |
| **4** | — | تجاوز حد الاستخدام | الانتظار وإعادة المحاولة |
| **368** | — | حظر مؤقت بسبب الأمان | الانتظار ومراجعة السياسات |
| **506** | — | منشور مكرر | تغيير المحتوى |
| **803** | — | فشل Webhook | التحقق من إعدادات الخادم |

### في مشروعنا — التعامل مع الأخطاء

```typescript
// مثال على معالجة أخطاء Graph API
async function callGraphAPI(url: string, token: string) {
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    const graphError = error.response?.data?.error;
    
    if (graphError?.code === 190) {
      // Token expired — trigger refresh
      await refreshToken();
      // Retry the request
      return callGraphAPI(url, newToken);
    }
    
    if (graphError?.code === 4) {
      // Rate limited — wait and retry
      await delay(60000);
      return callGraphAPI(url, token);
    }
    
    throw new Error(`Graph API Error: ${graphError?.message}`);
  }
}
```

---

## حدود الاستخدام (Rate Limiting)

### أنواع الحدود

| النوع | الحد | التطبيق |
|-------|------|---------|
| **App-Level** | 200 × عدد المستخدمين / ساعة | جميع استدعاءات التطبيق |
| **Page-Level** | 4800 استدعاء / ساعة | كل صفحة على حدة |
| **User-Level** | 200 استدعاء / ساعة | لكل مستخدم |
| **Instagram** | 200 استدعاء / ساعة | لكل مستخدم Instagram |

### رؤوس Rate Limit في الاستجابة

```http
X-App-Usage: {"call_count":28,"total_cputime":10,"total_time":15}
X-Page-Usage: {"call_count":50,"total_cputime":25,"total_time":30}
```

```typescript
// التحقق من Rate Limit headers
function checkRateLimit(headers: any) {
  const appUsage = JSON.parse(headers['x-app-usage'] || '{}');
  if (appUsage.call_count > 80) {
    console.warn('⚠️ Approaching rate limit:', appUsage.call_count + '%');
    // تقليل سرعة الاستدعاءات
  }
}
```

---

## مراجع مفيدة

| الرابط | الوصف |
|--------|-------|
| [Graph API Explorer](https://developers.facebook.com/tools/explorer/) | أداة تفاعلية لاختبار الاستدعاءات |
| [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) | فحص صلاحية التوكنات |
| [Graph API Changelog](https://developers.facebook.com/docs/graph-api/changelog) | سجل التغييرات لكل إصدار |
| [API Status](https://metastatus.com/) | حالة خدمات Meta |

---

> **آخر تحديث:** يوليو 2026  
> **الإصدار المُوثّق:** v25.0  
> **المشروع:** Hubqa — منصة الرد التلقائي SaaS
