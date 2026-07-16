# 07 - مرجع Webhooks الشامل

> [!NOTE]
> هذا المرجع يغطي كل ما يتعلق بـ Webhooks في Meta APIs — من التحقق الأولي إلى معالجة الأحداث وإزالة التكرار.
> آخر تحديث: يوليو 2026 | Graph API v25.0

---

## جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [التحقق من Webhook (Verification)](#التحقق-من-webhook-verification)
3. [التحقق من التوقيع (Signature Verification)](#التحقق-من-التوقيع-signature-verification)
4. [توجيه المنصات (Platform Routing)](#توجيه-المنصات-platform-routing)
5. [هيكل Payload لكل منصة](#هيكل-payload-لكل-منصة)
6. [إزالة التكرار (Deduplication)](#إزالة-التكرار-deduplication)
7. [أفضل الممارسات](#أفضل-الممارسات)
8. [ربط المشروع (Hubqa)](#ربط-المشروع-hubqa)

---

## نظرة عامة

Webhooks هي آلية Meta لإرسال الأحداث في الوقت الفعلي إلى تطبيقك. بدلاً من عمل polling مستمر لـ Graph API، يقوم Meta بإرسال HTTP POST requests إلى endpoint محدد في سيرفرك عند حدوث أي حدث (تعليق جديد، رسالة، إلخ).

### المبادئ الأساسية

| المبدأ | التفصيل |
|---|---|
| **Delivery Model** | At-least-once (قد يُرسل الحدث أكثر من مرة) |
| **Timeout** | يجب الرد خلال **20 ثانية** وإلا يُعاد الإرسال |
| **Protocol** | HTTPS مطلوب (شهادة SSL صالحة) |
| **Method** | GET للتحقق، POST للأحداث |
| **Format** | JSON (Content-Type: application/json) |

---

## التحقق من Webhook (Verification)

### كيف يعمل التحقق

عند تسجيل Webhook URL في إعدادات التطبيق، يرسل Meta طلب `GET` للتأكد أنك تملك هذا الـ endpoint.

### طلب التحقق من Meta

```
GET https://your-server.com/webhooks?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=RANDOM_STRING
```

### المعاملات (Query Parameters)

| Parameter | Type | Description |
|---|---|---|
| `hub.mode` | string | دائماً `subscribe` |
| `hub.verify_token` | string | الـ token الذي حددته في إعدادات التطبيق |
| `hub.challenge` | string | سلسلة عشوائية يجب إرجاعها |

### خطوات التحقق في السيرفر

```
1. تحقق أن hub.mode === 'subscribe'
2. تحقق أن hub.verify_token يطابق الـ token المخزن لديك
3. إذا تطابق: أرجع hub.challenge كـ plain text مع status 200
4. إذا لم يتطابق: أرجع 403 Forbidden
```

### مثال عملي (Node.js / Express)

```typescript
// GET /webhooks - Verification endpoint
app.get('/webhooks', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    // يجب إرجاع challenge كـ plain text وليس JSON
    return res.status(200).send(challenge);
  }

  console.error('❌ Webhook verification failed');
  return res.status(403).send('Forbidden');
});
```

> [!IMPORTANT]
> يجب إرجاع `hub.challenge` كـ **plain text** وليس JSON. إذا أرجعته داخل JSON object سيفشل التحقق.

### الرد الصحيح

```
HTTP/1.1 200 OK
Content-Type: text/plain

1234567890
```

### الرد الخاطئ ❌

```json
// لا تفعل هذا!
{ "challenge": "1234567890" }
```

### في مشروع Hubqa

| الملف | الدالة | الوصف |
|---|---|---|
| `webhooks.controller.ts` | `verifyWebhook()` | يستقبل GET request ويمرر للـ service |
| `webhooks.service.ts` | `verifyWebhook()` | يتحقق من token ويرجع challenge |

---

## التحقق من التوقيع (Signature Verification)

### لماذا التحقق من التوقيع؟

للتأكد أن الطلب قادم فعلاً من Meta وليس من طرف ثالث يحاول التلاعب.

### آلية العمل

1. Meta يحسب **HMAC-SHA256** على الـ raw body باستخدام **App Secret**
2. يرسل النتيجة في header: `X-Hub-Signature-256`
3. سيرفرك يحسب نفس الـ hash ويقارن

### Header Format

```
X-Hub-Signature-256: sha256=a1b2c3d4e5f6...
```

### مثال التحقق (Node.js)

```typescript
import * as crypto from 'crypto';

function verifySignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string
): boolean {
  if (!signature) {
    console.error('❌ No signature header found');
    return false;
  }

  // استخراج الـ hash من الـ header
  const expectedSignature = signature;
  
  // حساب الـ HMAC-SHA256
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSignature = 'sha256=' + hmac.digest('hex');

  // مقارنة آمنة ضد timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(calculatedSignature)
  );

  if (!isValid) {
    console.error('❌ Invalid webhook signature');
  }

  return isValid;
}
```

> [!CAUTION]
> **استخدم `crypto.timingSafeEqual()`** بدلاً من `===` للمقارنة. المقارنة العادية عرضة لـ **timing attacks** حيث يمكن للمهاجم معرفة أجزاء من التوقيع بقياس وقت الاستجابة.

### في مشروع Hubqa

| الملف | الأسطر | الوصف |
|---|---|---|
| `webhooks.controller.ts` | `handleIncomingEvent()` lines 60-98 | التحقق من التوقيع قبل معالجة الحدث |

### ملاحظات مهمة

```
⚠️ يجب استخدام RAW BODY (Buffer) وليس parsed JSON
⚠️ إذا استخدمت body-parser قبل التحقق، ستفقد الـ raw body
⚠️ في Express: استخدم express.raw() أو احتفظ بنسخة من raw body
⚠️ في NestJS: استخدم rawBody option في main.ts
```

### إعداد NestJS لاستقبال Raw Body

```typescript
// main.ts
const app = await NestFactory.create(AppModule, {
  rawBody: true, // مهم جداً للتحقق من التوقيع
});
```

---

## توجيه المنصات (Platform Routing)

### حقل `body.object`

كل webhook payload يحتوي حقل `object` في الـ root level يحدد المنصة المصدر:

| قيمة `body.object` | المنصة | أنواع الأحداث |
|---|---|---|
| `'page'` | Facebook Page | Feed (posts/comments)، Messenger messages |
| `'instagram'` | Instagram | Comments، DMs، Story mentions |
| `'whatsapp_business_account'` | WhatsApp Business | Messages، Status updates |

### مثال التوجيه

```typescript
function handleIncomingEvent(body: any): void {
  switch (body.object) {
    case 'page':
      // Facebook: قد يكون تعليق أو رسالة Messenger
      handleFacebookEvent(body);
      break;

    case 'instagram':
      // Instagram: تعليق أو رسالة DM
      handleInstagramEvent(body);
      break;

    case 'whatsapp_business_account':
      // WhatsApp: رسالة أو تحديث حالة
      handleWhatsAppEvent(body);
      break;

    default:
      console.warn(`⚠️ Unknown object type: ${body.object}`);
  }
}
```

> [!WARNING]
> **فرق حاسم في Facebook:**
> - **Messenger** يستخدم `entry[].messaging[]` (مصفوفة messaging)
> - **Feed/Comments** يستخدم `entry[].changes[]` (مصفوفة changes)
> 
> هذا الاختلاف مصدر شائع جداً للأخطاء! كلاهما يأتي مع `body.object = 'page'`.

### التوجيه داخل Facebook (`page`)

```typescript
function handleFacebookEvent(body: any): void {
  for (const entry of body.entry) {
    // 1. تحقق من messaging أولاً (Messenger)
    if (entry.messaging && entry.messaging.length > 0) {
      for (const event of entry.messaging) {
        handleMessengerEvent(event);
      }
    }

    // 2. تحقق من changes (Feed: posts, comments)
    if (entry.changes && entry.changes.length > 0) {
      for (const change of entry.changes) {
        handleFeedChange(change);
      }
    }
  }
}
```

### في مشروع Hubqa

| الملف | الأسطر | الوصف |
|---|---|---|
| `webhooks.service.ts` | `handleIncomingEvent()` lines 63-109 | التوجيه الرئيسي حسب `body.object` |
| `webhooks.service.ts` | lines 70-91 | معالجة `messaging[]` (Messenger) |
| `webhooks.service.ts` | lines 93-98 | معالجة `changes[]` (Feed/Comments) |

---

## هيكل Payload لكل منصة

### 1. Facebook Comment (تعليق فيسبوك)

#### الهيكل الكامل

```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1234567890,
      "changes": [
        {
          "field": "feed",
          "value": {
            "item": "comment",
            "verb": "add",
            "comment_id": "POST_ID_COMMENT_ID",
            "post_id": "PAGE_ID_POST_ID",
            "parent_id": "POST_ID_PARENT_COMMENT_ID",
            "from": {
              "id": "USER_ID",
              "name": "User Name"
            },
            "message": "This is the comment text",
            "created_time": 1234567890
          }
        }
      ]
    }
  ]
}
```

#### الحقول المهمة

| الحقل | النوع | الوصف |
|---|---|---|
| `field` | string | دائماً `"feed"` للتعليقات |
| `value.item` | string | `"comment"` للتعليقات |
| `value.verb` | string | `"add"`, `"edited"`, `"remove"`, `"hide"` |
| `value.comment_id` | string | معرف التعليق الفريد |
| `value.post_id` | string | معرف المنشور الأصلي |
| `value.parent_id` | string | معرف التعليق الأب (للردود على تعليقات) |
| `value.from.id` | string | معرف المعلق |
| `value.from.name` | string | اسم المعلق |
| `value.message` | string | نص التعليق |

> [!IMPORTANT]
> **يجب معالجة `verb: 'add'` فقط!** تجاهل `edited`, `remove`, `hide` لتجنب الردود المكررة أو الأخطاء.
> 
> في مشروع Hubqa: `processComment()` السطر 356 يتحقق `verb !== 'add'` ويتجاهل باقي الأنواع.

#### قيم `verb` الممكنة

| Verb | المعنى | الإجراء |
|---|---|---|
| `add` | تعليق جديد | ✅ **معالجة** |
| `edited` | تعليق معدل | ❌ تجاهل |
| `remove` | تعليق محذوف | ❌ تجاهل |
| `hide` | تعليق مخفي | ❌ تجاهل |

#### قيم `item` الممكنة في Feed

| Item | الوصف |
|---|---|
| `comment` | تعليق على منشور |
| `post` | منشور جديد |
| `status` | تحديث حالة |
| `photo` | صورة جديدة |
| `video` | فيديو جديد |
| `share` | مشاركة |
| `reaction` | تفاعل (like, love, etc.) |

---

### 2. Messenger Message (رسالة ماسنجر)

#### الهيكل الكامل

```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1234567890,
      "messaging": [
        {
          "sender": {
            "id": "USER_PSID"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": 1234567890,
          "message": {
            "mid": "m_UNIQUE_MESSAGE_ID",
            "text": "Hello!",
            "is_echo": false,
            "attachments": [
              {
                "type": "image",
                "payload": {
                  "url": "https://..."
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### الحقول المهمة

| الحقل | النوع | الوصف |
|---|---|---|
| `sender.id` | string | Page-Scoped ID (PSID) للمرسل |
| `recipient.id` | string | معرف الصفحة |
| `message.mid` | string | معرف الرسالة الفريد |
| `message.text` | string | نص الرسالة |
| `message.is_echo` | boolean | `true` إذا كانت رسالة من الصفحة نفسها |
| `message.attachments[]` | array | المرفقات (صور، فيديو، ملفات) |

> [!CAUTION]
> **تحقق دائماً من `is_echo`!** عندما ترسل الصفحة رسالة، يأتي webhook بنفس الحدث مع `is_echo: true`. إذا لم تتحقق ستدخل في **infinite loop** (الصفحة ترد على نفسها!).
> 
> في مشروع Hubqa: السطر 73 يتحقق `!event.message.is_echo`

#### أنواع المرفقات

| Type | الوصف |
|---|---|
| `image` | صورة |
| `video` | فيديو |
| `audio` | ملف صوتي |
| `file` | ملف عام |
| `location` | موقع جغرافي |
| `fallback` | نوع غير مدعوم |

---

### 3. Messenger Postback

#### الهيكل الكامل

```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1234567890,
      "messaging": [
        {
          "sender": {
            "id": "USER_PSID"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": 1234567890,
          "postback": {
            "title": "Get Started",
            "payload": "GET_STARTED_PAYLOAD",
            "referral": {
              "ref": "ad_ref_data",
              "source": "ADS",
              "type": "OPEN_THREAD"
            }
          }
        }
      ]
    }
  ]
}
```

#### الحقول المهمة

| الحقل | النوع | الوصف |
|---|---|---|
| `postback.title` | string | النص الظاهر على الزر |
| `postback.payload` | string | القيمة المخفية للمطور |
| `postback.referral` | object | بيانات الإحالة (اختياري) |

> [!TIP]
> في مشروع Hubqa (الأسطر 75-91)، يتم تحويل الـ postback إلى رسالة عادية لتوحيد المعالجة:
> ```typescript
> // تحويل postback إلى message format
> const syntheticMessage = {
>   sender: event.sender,
>   recipient: event.recipient,
>   timestamp: event.timestamp,
>   message: {
>     mid: `postback_${event.timestamp}`,
>     text: event.postback.payload || event.postback.title
>   }
> };
> ```

---

### 4. Instagram Comment (تعليق إنستغرام)

#### الهيكل الكامل

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_USER_ID",
      "time": 1234567890,
      "changes": [
        {
          "field": "comments",
          "value": {
            "id": "COMMENT_ID",
            "text": "Great post! 🔥",
            "from": {
              "id": "COMMENTER_IG_ID",
              "username": "commenter_username"
            },
            "media": {
              "id": "MEDIA_ID",
              "media_product_type": "FEED"
            },
            "parent_id": "PARENT_COMMENT_ID",
            "timestamp": "2026-07-16T09:35:26+0000"
          }
        }
      ]
    }
  ]
}
```

#### ملاحظات Instagram

| الحقل | الفرق عن Facebook |
|---|---|
| `from.username` | Instagram يعطي username بدلاً من name |
| `media.id` | بدلاً من `post_id` |
| `field` | `"comments"` بدلاً من `"feed"` |
| `object` | `"instagram"` بدلاً من `"page"` |

---

### 5. Instagram DM (رسالة إنستغرام)

#### الهيكل الكامل

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_USER_ID",
      "time": 1234567890,
      "messaging": [
        {
          "sender": {
            "id": "IG_SCOPED_USER_ID"
          },
          "recipient": {
            "id": "IG_USER_ID"
          },
          "timestamp": 1234567890,
          "message": {
            "mid": "MESSAGE_ID",
            "text": "Hello from Instagram DM!"
          }
        }
      ]
    }
  ]
}
```

---

### 6. Instagram Story Mention/Reply

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "IG_USER_ID",
      "time": 1234567890,
      "messaging": [
        {
          "sender": {
            "id": "IG_SCOPED_USER_ID"
          },
          "recipient": {
            "id": "IG_USER_ID"
          },
          "timestamp": 1234567890,
          "message": {
            "mid": "MESSAGE_ID",
            "attachments": [
              {
                "type": "story_mention",
                "payload": {
                  "url": "https://story-cdn-url..."
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

> [!NOTE]
> Story mentions و story replies تأتي كـ `messaging[]` وليس `changes[]` في Instagram.

---

### 7. WhatsApp Message (رسالة واتساب)

#### الهيكل الكامل

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+1234567890",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Customer Name"
                },
                "wa_id": "CUSTOMER_PHONE_NUMBER"
              }
            ],
            "messages": [
              {
                "from": "CUSTOMER_PHONE_NUMBER",
                "id": "wamid.UNIQUE_MESSAGE_ID",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Hello from WhatsApp!"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### الحقول المهمة

| الحقل | المسار الكامل | الوصف |
|---|---|---|
| **Phone Number ID** | `entry[].changes[].value.metadata.phone_number_id` | لتوجيه الرسالة للرقم الصحيح |
| **Sender Name** | `entry[].changes[].value.contacts[].profile.name` | اسم المرسل |
| **Sender Phone** | `entry[].changes[].value.messages[].from` | رقم المرسل |
| **Message ID** | `entry[].changes[].value.messages[].id` | معرف فريد (يبدأ بـ `wamid.`) |
| **Message Type** | `entry[].changes[].value.messages[].type` | نوع الرسالة |
| **Text Body** | `entry[].changes[].value.messages[].text.body` | نص الرسالة |

#### أنواع رسائل WhatsApp

| Type | الهيكل | مثال |
|---|---|---|
| `text` | `message.text.body` | رسالة نصية |
| `image` | `message.image.id`, `.caption` | صورة مع تعليق |
| `video` | `message.video.id`, `.caption` | فيديو |
| `audio` | `message.audio.id` | رسالة صوتية |
| `document` | `message.document.id`, `.filename` | ملف |
| `location` | `message.location.latitude`, `.longitude` | موقع |
| `contacts` | `message.contacts[]` | جهة اتصال |
| `sticker` | `message.sticker.id` | ملصق |
| `button` | `message.button.text`, `.payload` | رد زر |
| `interactive` | `message.interactive.type` | رد قائمة/زر |
| `reaction` | `message.reaction.emoji`, `.message_id` | تفاعل |

#### WhatsApp Status Updates

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+1234567890",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.MESSAGE_ID",
                "status": "delivered",
                "timestamp": "1234567890",
                "recipient_id": "CUSTOMER_PHONE"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### حالات WhatsApp

| Status | المعنى |
|---|---|
| `sent` | تم الإرسال من السيرفر |
| `delivered` | وصلت لجهاز المستلم |
| `read` | المستلم قرأ الرسالة |
| `failed` | فشل الإرسال |

> [!TIP]
> للتمييز بين الرسائل وتحديثات الحالة في WhatsApp:
> ```typescript
> const value = entry.changes[0].value;
> 
> if (value.messages && value.messages.length > 0) {
>   // رسالة جديدة من العميل
>   processWhatsAppMessage(value);
> }
> 
> if (value.statuses && value.statuses.length > 0) {
>   // تحديث حالة رسالة (delivered, read, etc.)
>   processWhatsAppStatus(value);
> }
> ```

---

## إزالة التكرار (Deduplication)

### المشكلة

Meta يستخدم نموذج **at-least-once delivery**، مما يعني أن نفس الحدث قد يُرسل أكثر من مرة. بدون إزالة التكرار، قد يتلقى المستخدم ردوداً مكررة.

### أسباب التكرار

| السبب | التفصيل |
|---|---|
| **Timeout** | سيرفرك لم يرد بـ 200 خلال 20 ثانية |
| **Server Error** | أرجعت 5xx |
| **Network Issue** | مشكلة شبكة بين Meta وسيرفرك |
| **Meta Internal** | إعادة محاولة داخلية من Meta |

### استراتيجية إزالة التكرار

```
1. استخرج معرف فريد من كل حدث
2. تحقق: هل تمت معالجة هذا المعرف من قبل؟
3. إذا نعم → تجاهل (return 200 OK)
4. إذا لا → خزّن المعرف + عالج الحدث
5. احذف المعرفات القديمة (TTL)
```

### معرفات فريدة حسب المنصة

| المنصة | نوع الحدث | المعرف الفريد |
|---|---|---|
| Facebook | Comment | `value.comment_id` |
| Facebook | Messenger | `message.mid` |
| Instagram | Comment | `value.id` |
| Instagram | DM | `message.mid` |
| WhatsApp | Message | `message.id` (wamid.*) |
| WhatsApp | Status | `status.id` + `status.status` |

### مثال التنفيذ

```typescript
// نموذج لتخزين المعرفات المعالجة
interface WebhookDeduplication {
  eventId: string;        // المعرف الفريد
  platform: string;       // المنصة
  processedAt: Date;      // وقت المعالجة
  expiresAt: Date;        // وقت الحذف التلقائي (TTL)
}

class DeduplicationService {
  // TTL: 48 ساعة (كافية لتغطية أي إعادة محاولة من Meta)
  private readonly TTL_HOURS = 48;

  async isDuplicate(eventId: string): Promise<boolean> {
    const existing = await this.deduplicationRepo.findOne({
      where: { eventId }
    });
    return !!existing;
  }

  async markProcessed(eventId: string, platform: string): Promise<void> {
    await this.deduplicationRepo.save({
      eventId,
      platform,
      processedAt: new Date(),
      expiresAt: new Date(Date.now() + this.TTL_HOURS * 60 * 60 * 1000)
    });
  }
}
```

### في مشروع Hubqa

| المستوى | الآلية | التفصيل |
|---|---|---|
| **Controller Level** | `x-request-id` header | تجنب معالجة نفس الطلب مرتين |
| **Service Level** | `comment_id` / `message.mid` / `message.id` | تجنب الرد على نفس الحدث مرتين |
| **Model** | `WebhookDeduplication` | تخزين بـ TTL = 48 ساعة |

> [!WARNING]
> إزالة التكرار على مستوى واحد فقط **غير كافية**. يجب التحقق على مستويين على الأقل:
> 1. **مستوى الطلب** (request-level): لمنع معالجة نفس HTTP request
> 2. **مستوى الحدث** (event-level): لمنع الرد على نفس الحدث من requests مختلفة

---

## أفضل الممارسات

### 1. الرد فوراً بـ 200 OK

```typescript
// ✅ الطريقة الصحيحة
app.post('/webhooks', async (req, res) => {
  // أرجع 200 فوراً
  res.status(200).send('EVENT_RECEIVED');
  
  // عالج الحدث بشكل غير متزامن
  processEventAsync(req.body).catch(err => {
    console.error('Error processing event:', err);
  });
});

// ❌ الطريقة الخاطئة
app.post('/webhooks', async (req, res) => {
  // لا تنتظر المعالجة قبل الرد!
  await processEvent(req.body);  // قد تأخذ أكثر من 20 ثانية
  res.status(200).send('OK');
});
```

### 2. حد الـ 20 ثانية

```
⏱️ إذا لم ترد خلال 20 ثانية:
  → Meta يعتبر الطلب فاشلاً
  → يعيد الإرسال (retry)
  → بعد عدة محاولات فاشلة: يوقف إرسال الأحداث لتطبيقك!
```

### 3. معالجة إعادة المحاولات (Retries)

```
Meta Retry Policy:
  → المحاولة الأولى: فوراً
  → المحاولة الثانية: بعد بضع ثوانٍ
  → المحاولة الثالثة: بعد فترة أطول
  → ... (exponential backoff)
  → بعد ~8 ساعات من المحاولات الفاشلة: يوقف الأحداث
```

### 4. قائمة مراجعة كاملة

| # | الممارسة | الحالة |
|---|---|---|
| 1 | ✅ إرجاع 200 OK فوراً | مطلوب |
| 2 | ✅ معالجة غير متزامنة | مطلوب |
| 3 | ✅ التحقق من التوقيع | مطلوب |
| 4 | ✅ إزالة التكرار | مطلوب |
| 5 | ✅ التحقق من `is_echo` | مطلوب (Messenger) |
| 6 | ✅ التحقق من `verb` | مطلوب (Comments) |
| 7 | ✅ HTTPS مع شهادة صالحة | مطلوب |
| 8 | ✅ تسجيل الأخطاء (logging) | موصى به |
| 9 | ✅ مراقبة حالة Webhooks | موصى به |
| 10 | ✅ Queue system (Redis/Bull) | موصى به للإنتاج |

---

## ربط المشروع (Hubqa)

### خريطة الملفات

```
backend/src/webhooks/
├── webhooks.controller.ts     ← استقبال HTTP requests
│   ├── GET  /webhooks         ← verifyWebhook()
│   └── POST /webhooks         ← handleIncomingEvent() + signature check
│
├── webhooks.service.ts        ← المنطق الأساسي
│   ├── verifyWebhook()        ← التحقق من token
│   ├── handleIncomingEvent()  ← التوجيه حسب المنصة
│   ├── processComment()       ← معالجة التعليقات (FB + IG)
│   ├── processPrivateDM()     ← معالجة الرسائل (Messenger + IG DM)
│   ├── processWhatsAppMessage() ← معالجة رسائل WhatsApp
│   └── handleStoryEvent()     ← معالجة Story mentions/replies
│
└── webhooks.module.ts         ← تسجيل الـ module
```

### تدفق المعالجة في Hubqa

```mermaid
flowchart TD
    A[Meta Webhook POST] --> B{Signature Valid?}
    B -->|No| C[403 Reject]
    B -->|Yes| D[200 OK Immediately]
    D --> E{body.object?}
    E -->|page| F{messaging[] exists?}
    F -->|Yes| G[processPrivateDM]
    F -->|No| H{changes[].field?}
    H -->|feed| I[processComment]
    E -->|instagram| J{field?}
    J -->|comments| K[processComment - IG]
    J -->|messaging| L[processPrivateDM - IG]
    E -->|whatsapp_business_account| M[processWhatsAppMessage]
    
    G --> N{is_echo?}
    N -->|Yes| O[Skip]
    N -->|No| P[Match Rules → Reply]
    
    I --> Q{verb === add?}
    Q -->|No| R[Skip]
    Q -->|Yes| S[Match Rules → Reply]
```

---

> [!NOTE]
> للمزيد من التفاصيل حول الأذونات المطلوبة لتفعيل Webhooks، راجع [08-permissions-reference.md](./08-permissions-reference.md).
> لمعالجة الأخطاء التي قد تحدث أثناء معالجة الأحداث، راجع [10-error-codes.md](./10-error-codes.md).
