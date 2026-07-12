# Milestone 2: Frontend Rules Page Enhancements Report

This report presents comprehensive, actionable recommendations for enhancing the automated replies rules engine in the frontend. It covers editing support, sequential responses with drag-to-reorder, rich reply formats, real-time message previews, analytics integration, and a templates library loader.

---

## 1. Observation

### Existing Frontend Implementation (`frontend/src/app/dashboard/rules/page.tsx`)
*   **Rule Data Model**:
    ```typescript
    interface Rule {
      id: string
      name: string
      triggerType: string
      postId: string | null
      keywords: string
      replyText: string | null
      replyMedia: string | null
      privateText: string | null
      isActive: boolean
      priority: number
    }
    ```
*   **Dialog & Form State**:
    *   The rule creation form is hosted inside a single `<Dialog>` (lines 135–144) triggered by the "إضافة قاعدة جديدة" (Add new rule) button.
    *   It uses independent state variables: `name`, `ruleType`, `postId`, `selectedPost`, `keywords`, `replyText`, `privateText`, `mediaType`, `mediaUrl` (lines 39–50).
    *   The save handler `handleSaveRule` (lines 68–94) sends a `POST` request to `/rules`. It does not support rule updates.
    *   No edit button exists on the rule cards (lines 369–475); only a toggle switch for status and a delete button are provided.
*   **Dependencies (`frontend/package.json`)**:
    *   The frontend uses standard dependencies (React 19, Next.js 16, Lucide React, Tailwind CSS 4, Framer Motion) but does not have any drag-and-drop packages installed.

### Existing Backend Implementation (`backend/src/rules/`)
*   **HTTP Route for Updates**:
    *   `rules.controller.ts` (lines 40–56) exposes `PUT /rules/:id` which validates input via `UpdateRuleDto` and invokes `rulesService.update(id, req.user.tenantId, dto)`.
*   **Audit Logging**:
    *   `rules.service.ts` (lines 83–107) records rule executions. The `trigger` method writes an `AuditLog` entry:
        ```typescript
        await this.prisma.auditLog.create({
          data: {
            tenantId,
            action: 'RULE_TRIGGERED',
            entityType: 'AutoReplyRule',
            entityId: ruleId,
            oldValues: undefined,
            newValues: JSON.stringify(body || {}),
          },
        });
        ```
*   **Prisma Database Schema (`backend/prisma/schema.prisma`)**:
    *   The `AutoReplyRule` model (lines 202–230) defines `replyMedia` and `privateMedia` as JSON columns:
        ```prisma
        replyMedia    Json?               // PostgreSQL JSON representing media URLs
        privateMedia  Json?               // PostgreSQL JSON representing media URLs
        ```
    *   The `AuditLog` model (lines 342–360) tracks rule activities, including triggers.

---

## 2. Logic Chain

1.  **Rule Editing**: Since the backend already exposes `PUT /rules/:id` (observed in `rules.controller.ts`), we can easily add rule editing to the UI without backend changes. The edit action will pop open the existing form dialog, populate the state fields from the selected rule object, track the ID of the rule being edited, and call `PUT` instead of `POST` on submit.
2.  **Sequential Responses**: To send 2–5 messages with delays, the private reply structure must be upgraded from a single string (`privateText`) to an ordered sequence. Since the DB column type for `privateMedia` is `Json` (observed in `schema.prisma`), we can serialize the entire sequence of 2–5 messages into a structured JSON array and store it in `privateMedia` or a new JSON column `responseSequence`.
3.  **Drag-to-Reorder**: Since `package.json` contains no external drag-and-drop libraries, we can implement reordering in Next.js 16/React 19 using native HTML5 Drag and Drop event handlers (`onDragStart`, `onDragOver`, `onDragEnd`). This keeps bundle sizes small, guarantees compatibility, and avoids version mismatch issues. Alternatively, we can recommend installing `@hello-pangea/dnd` (a React-19-compatible fork of `react-beautiful-dnd`).
4.  **Rich Reply Formats**: Rich formats (carousel cards, buttons, quick replies) require specific payload schemas. Since the DB stores them as `Json`, we can define TypeScript interfaces for these rich replies. In the editor, a select dropdown will conditionally display input fields (e.g. Card builder for Carousels, Chip builder for Quick Replies).
5.  **Visual Preview**: Users must verify their message flows before saving. A simulated phone preview pane displaying Facebook Messenger and WhatsApp view modes will receive the sequence state in real-time, mapping each message object to its platform-specific visual representation (e.g. scrollable carousels for Messenger, text-with-buttons for WhatsApp).
6.  **Rule Analytics**: Triggers write `AuditLog` entries with `action: 'RULE_TRIGGERED'` (observed in `rules.service.ts`). To retrieve this data, we can either group and count the logs on-demand in the database, or add counters directly to the `AutoReplyRule` table. The on-demand aggregation utilizes a Prisma `groupBy` query on the `AuditLog` table to count triggers and get the latest `createdAt` timestamp, returning them with the rules list.
7.  **Template Library Loader**: Beginners can struggle to configure keyword-response pairs. Providing a local client-side JSON dictionary of predefined templates (e.g., "Price Inquiry", "Greeting Flow") allows users to choose a preset, which pre-populates all form inputs in the edit dialog.

---

## 3. Caveats

*   **Platform Carousel Constraints**: WhatsApp does not support horizontal carousels natively unless using official Business API interactive message templates. The preview component should show carousels in WhatsApp mode as a vertical list of messages with buttons, or alert the user of this limitation.
*   **Prisma JSON Column Processing**: Storing structured sequences inside the existing JSON columns (`replyMedia` or `privateMedia`) works seamlessly on the frontend, but the backend worker executing the auto-replies must be refactored to parse these arrays, loop through each item, and execute the proper API calls (Messenger Graph API or WhatsApp Business API) with the specified delays.
*   **Analytics Scale**: Running a group-by query on a rapidly growing `AuditLog` table can degrade database performance at scale. For high-throughput environments, storing `triggerCount` and `lastTriggeredAt` as direct fields in the `AutoReplyRule` table and incrementing them inside the trigger route is the superior design.

---

## 4. Conclusion

Below are the detailed, actionable recommendations for implementing the six frontend enhancements.

### Recommendation 1: Add Rule Editing to the Existing UI

#### 1. Form and State Adjustments
*   Add a new state in `page.tsx` to hold the ID of the rule being edited:
    ```typescript
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    ```
*   Update `resetForm` to clear this ID:
    ```typescript
    const resetForm = () => {
      // existing resets...
      setEditingRuleId(null);
    };
    ```

#### 2. Edit Action in Rule Card
*   In the card rendering loop, add an edit button next to the delete button:
    ```tsx
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground hover:bg-accent rounded-xl cursor-pointer"
      onClick={() => handleEditRule(rule)}
    >
      <Edit className="w-4 h-4" />
    </Button>
    ```

#### 3. Populating State for Edit Mode
*   Define the `handleEditRule` handler to read rule properties and open the dialog:
    ```typescript
    const handleEditRule = (rule: Rule) => {
      setEditingRuleId(rule.id);
      setName(rule.name);
      setKeywords(rule.keywords);
      setReplyText(rule.replyText || "");
      setPrivateText(rule.privateText || "");
      setRuleType(rule.postId ? "POST" : "GLOBAL");
      setPostId(rule.postId || "");
      if (rule.postId) {
        // Fetch or assign selected post details
        setSelectedPost({ id: rule.postId, message: "منشور مخصص", commentsCount: 0, channelName: "" });
      }
      
      // Parse media options if present
      if (rule.replyMedia && Array.isArray(rule.replyMedia) && rule.replyMedia.length > 0) {
        const url = rule.replyMedia[0];
        setMediaUrl(url);
        setMediaType(url.includes(".mp4") ? "VIDEO" : "IMAGE");
      } else {
        setMediaType("NONE");
        setMediaUrl("");
      }
      
      setIsDialogOpen(true);
    };
    ```

#### 4. Conditional Submit Handler
*   Modify `handleSaveRule` to handle both POST and PUT requests:
    ```typescript
    const handleSaveRule = async () => {
      try {
        setIsSubmitting(true);
        const replyMedia = mediaType !== "NONE" && mediaUrl ? [mediaUrl] : null;
        const effectivePostId = selectedPost?.id || postId;
        
        const payload = {
          name,
          triggerType: keywords ? "KEYWORD" : "ANY_COMMENT",
          postId: ruleType === "POST" && effectivePostId ? effectivePostId : null,
          keywords,
          replyText,
          privateText: privateText || null,
          replyMedia,
          priority: ruleType === "POST" ? 10 : 0,
          isActive: true
        };

        if (editingRuleId) {
          await api.put(`/rules/${editingRuleId}`, payload);
          setBanner({ type: "success", text: "✅ تم تعديل القاعدة بنجاح." });
        } else {
          await api.post("/rules", payload);
          setBanner({ type: "success", text: "✅ تم إضافة القاعدة بنجاح." });
        }

        setIsDialogOpen(false);
        resetForm();
        fetchRules();
      } catch (error) {
        console.error("Failed to save rule", error);
        setBanner({ type: "error", text: "فشل حفظ القاعدة. حاول مرة أخرى." });
      } finally {
        setIsSubmitting(false);
      }
    };
    ```
*   Update Dialog header texts based on `editingRuleId !== null`.

---

### Recommendation 2: Implement Sequential Responses (2–5 Messages) with Drag-to-Reorder

#### 1. Sequence Data Structure
Store the sequence inside the `privateMedia` JSON field (or introduce a new JSON column `responseSequence`). A sequence represents a list of message nodes:
```typescript
interface SequenceMessage {
  id: string; // UI key
  type: 'TEXT' | 'IMAGE' | 'CAROUSEL' | 'QUICK_REPLIES';
  delaySeconds: number; // 1 to 10 seconds
  text?: string;
  mediaUrl?: string;
  caption?: string;
  cards?: CarouselCard[];
  quickReplies?: QuickReply[];
}
```

#### 2. Sequence Form Builder UI
*   Add a toggle: `[ ] تفعيل الرد المتسلسل (إرسال عدة رسائل متتالية)`
*   When checked, render the sequence editor instead of the single `privateText` textarea.
*   Allow users to add messages (limit: minimum 2, maximum 5).

#### 3. Zero-Dependency HTML5 Drag-and-Drop Editor Component
Create a sub-component within the rules page directory or inside `src/components`:

```typescript
import React, { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

interface DragDropSequenceProps {
  messages: SequenceMessage[];
  onChange: (updatedMessages: SequenceMessage[]) => void;
  onRemoveMessage: (id: string) => void;
  renderMessageEditor: (msg: SequenceMessage, index: number) => React.ReactNode;
}

export function DragDropSequence({
  messages,
  onChange,
  onRemoveMessage,
  renderMessageEditor,
}: DragDropSequenceProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const list = [...messages];
    const item = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(index, 0, item);
    
    setDraggedIndex(index);
    onChange(list);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {messages.map((msg, index) => (
        <div
          key={msg.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`flex gap-3 p-4 border rounded-xl bg-card shadow-sm transition-all duration-200 ${
            draggedIndex === index ? 'opacity-40 border-dashed border-primary bg-primary/5' : 'hover:border-primary/30'
          }`}
        >
          {/* Drag Handle */}
          <div className="flex flex-col items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 select-none">
            <GripVertical className="w-5 h-5 text-muted-foreground/60" />
            <span className="text-xs font-bold mt-1 bg-accent px-1.5 py-0.5 rounded-md">
              #{index + 1}
            </span>
          </div>

          {/* Form Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {renderMessageEditor(msg, index)}
          </div>

          {/* Remove Button */}
          {messages.length > 1 && (
            <button
              type="button"
              onClick={() => onRemoveMessage(msg.id)}
              className="text-destructive hover:bg-destructive/10 p-2 rounded-lg h-fit shrink-0 self-start transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Recommendation 3: Support for Rich Reply Formats

The rich formats structure should be defined as:
```typescript
interface Button {
  type: 'web_url' | 'postback';
  title: string;
  url?: string;
  payload?: string;
}

interface CarouselCard {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttons: Button[]; // Limit: 1-3
}

interface QuickReply {
  title: string;
  payload: string;
}
```

#### Editor UI Controls
1.  **Image with Caption Form**:
    *   `mediaUrl`: Input field with validation and real-time preview.
    *   `caption`: Text area underneath the URL input.
2.  **Carousel Cards Builder**:
    *   A horizontal layout containing small thumbnails for cards (`Card 1`, `Card 2`... up to 10) with a `+ Add Card` option.
    *   Selecting a card thumbnail reveals form fields for that specific card:
        *   Image URL (string input).
        *   Title (input, limit 80 characters).
        *   Subtitle (input, limit 80 characters).
        *   Button Manager: Lists active buttons and shows a button `+ إضافة زر` (Add Button, limit 3).
3.  **Buttons Manager Sub-Form**:
    *   Title/Label input (limit 20 characters).
    *   Type selector dropdown: `رابط موقع (Web URL)` vs `زر تفاعل (Postback)`.
    *   Conditional Input: Target URL field (when `web_url` is chosen) or Action Payload field (when `postback` is chosen).
4.  **Quick Replies Manager**:
    *   Text Bubble field (string input representing the message body).
    *   Dynamic tag manager: a row of pill inputs (each with a Title limit of 20 chars, and a Payload field). Users can click `+ إضافة رد سريع` (up to 10 items).

---

### Recommendation 4: Create a Facebook/WhatsApp Visual Preview Component

Create `VisualPreview.tsx` to simulate a phone interface in real-time.

```tsx
import React, { useState } from 'react';
import { Smartphone, Check, CheckCheck } from 'lucide-react';

interface VisualPreviewProps {
  messages: SequenceMessage[];
  triggerKeywords: string;
}

export function VisualPreview({ messages, triggerKeywords }: VisualPreviewProps) {
  const [platform, setPlatform] = useState<'messenger' | 'whatsapp'>('messenger');

  return (
    <div className="border rounded-2xl p-4 bg-muted/20 flex flex-col items-center">
      {/* Device Toggle */}
      <div className="flex gap-2 mb-4 bg-accent p-1.5 rounded-xl w-full max-w-[280px]">
        <button
          onClick={() => setPlatform('messenger')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all ${
            platform === 'messenger' ? 'bg-background shadow text-primary' : 'text-muted-foreground'
          }`}
        >
          Messenger
        </button>
        <button
          onClick={() => setPlatform('whatsapp')}
          className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all ${
            platform === 'whatsapp' ? 'bg-background shadow text-primary' : 'text-muted-foreground'
          }`}
        >
          WhatsApp
        </button>
      </div>

      {/* Simulated Phone Shell */}
      <div className="relative w-full max-w-[320px] aspect-[9/16] bg-slate-900 border-[8px] border-slate-800 rounded-[36px] shadow-2xl overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-28 bg-slate-800 rounded-b-xl z-20" />
        
        {/* Chat Header */}
        <div className="p-3 pt-6 bg-background border-b flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs">
            {platform === 'messenger' ? 'FB' : 'WA'}
          </div>
          <div>
            <div className="text-xs font-bold">بوابة الرد الآلي</div>
            <div className="text-[10px] text-emerald-500">نشط الآن</div>
          </div>
        </div>

        {/* Scrollable Message Feed */}
        <div
          className={`flex-1 p-3 overflow-y-auto flex flex-col gap-3 text-xs ${
            platform === 'whatsapp' ? 'bg-[#efeae2]' : 'bg-background'
          }`}
          style={platform === 'whatsapp' ? { backgroundImage: 'url("/assets/wa-bg.png")' } : undefined}
        >
          {/* User Trigger Message */}
          <div className="self-end max-w-[80%] flex flex-col items-end">
            <div
              className={`p-2.5 rounded-2xl rounded-tr-none ${
                platform === 'messenger' ? 'bg-primary text-white' : 'bg-[#d9fdd3] text-[#111b21] shadow-sm'
              }`}
            >
              {triggerKeywords ? `تعليق يحتوي على: ${triggerKeywords.split(',')[0]}` : 'أي تعليق أو رسالة'}
            </div>
            <span className="text-[8px] text-muted-foreground mt-0.5">
              10:00 AM {platform === 'whatsapp' && <CheckCheck className="w-3 h-3 text-blue-500 inline ml-0.5" />}
            </span>
          </div>

          {/* Bot Responses */}
          {messages.map((msg, index) => (
            <div key={msg.id} className="self-start max-w-[85%] flex flex-col gap-1">
              {/* Delay indicator */}
              <div className="text-[9px] text-muted-foreground/60 italic self-center">
                بعد {msg.delaySeconds || 1} ثانية
              </div>

              {/* Text Message */}
              {msg.type === 'TEXT' && (
                <div
                  className={`p-2.5 rounded-2xl rounded-tl-none ${
                    platform === 'messenger' ? 'bg-muted' : 'bg-white shadow-sm'
                  }`}
                >
                  {msg.text || '...' }
                </div>
              )}

              {/* Image Message */}
              {msg.type === 'IMAGE' && (
                <div
                  className={`p-1 rounded-xl overflow-hidden border ${
                    platform === 'messenger' ? 'bg-muted' : 'bg-white shadow-sm'
                  }`}
                >
                  {msg.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.mediaUrl} alt="Preview" className="w-full aspect-video object-cover rounded-lg" />
                  ) : (
                    <div className="w-full aspect-video bg-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                      مرفق صورة
                    </div>
                  )}
                  {msg.caption && <div className="p-2 text-xs">{msg.caption}</div>}
                </div>
              )}

              {/* Carousel Cards */}
              {msg.type === 'CAROUSEL' && (
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full snap-x">
                  {msg.cards?.map((card, cIdx) => (
                    <div
                      key={cIdx}
                      className={`w-[180px] shrink-0 border rounded-xl overflow-hidden snap-center ${
                        platform === 'messenger' ? 'bg-muted' : 'bg-white shadow-sm'
                      }`}
                    >
                      {card.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.imageUrl} alt="" className="w-full h-24 object-cover" />
                      )}
                      <div className="p-2">
                        <div className="font-bold truncate">{card.title || 'عنوان الكارت'}</div>
                        {card.subtitle && <div className="text-[10px] text-muted-foreground truncate">{card.subtitle}</div>}
                      </div>
                      {/* Carousel Card Buttons */}
                      <div className="border-t divide-y">
                        {card.buttons?.map((btn, bIdx) => (
                          <div key={bIdx} className="p-2 text-center text-primary font-bold text-[10px] cursor-pointer hover:bg-accent/20">
                            {btn.title || 'زر'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {platform === 'whatsapp' && (
                    <div className="text-[9px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                      ⚠️ واتساب لا يدعم الكاروسيل الأفقي؛ سيتم تحويله تلقائياً لرسائل مفرقة.
                    </div>
                  )}
                </div>
              )}

              {/* Quick Replies */}
              {msg.type === 'QUICK_REPLIES' && (
                <>
                  <div
                    className={`p-2.5 rounded-2xl rounded-tl-none ${
                      platform === 'messenger' ? 'bg-muted' : 'bg-white shadow-sm'
                    }`}
                  >
                    {msg.text || 'الرجاء اختيار أحد الخيارات:'}
                  </div>
                  {/* Render Quick Replies under the message */}
                  <div className="flex flex-wrap gap-1.5 mt-1 justify-start">
                    {msg.quickReplies?.map((qr, qrIdx) => (
                      <div
                        key={qrIdx}
                        className={`px-3 py-1 rounded-full border text-[10px] font-bold shadow-sm ${
                          platform === 'messenger'
                            ? 'border-primary text-primary bg-background'
                            : 'border-emerald-500 text-emerald-600 bg-emerald-50'
                        }`}
                      >
                        {qr.title || 'رد سريع'}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### Recommendation 5: Show Rule Analytics (Trigger Count & Last-Triggered Date)

To present detailed analytics (trigger count, last triggered timestamp) without causing performance degradation at scale:

#### Option A: Dynamic GroupBy Query (Best for Initial Phase - Zero Schema Migration)
Update `backend/src/rules/rules.service.ts` to perform a grouped aggregation on the `AuditLog` table:
```typescript
async getRules(tenantId: string) {
  const rules = await this.prisma.autoReplyRule.findMany({
    where: { tenantId },
    include: { connection: true },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate trigger counts and last triggered timestamps in a single query
  const stats = await this.prisma.auditLog.groupBy({
    by: ['entityId'],
    where: {
      tenantId,
      entityType: 'AutoReplyRule',
      action: 'RULE_TRIGGERED',
    },
    _count: {
      id: true,
    },
    _max: {
      createdAt: true,
    },
  });

  // Map analytics back onto rules objects
  return rules.map((rule) => {
    const stat = stats.find((s) => s.entityId === rule.id);
    return {
      ...rule,
      triggerCount: stat?._count.id || 0,
      lastTriggeredAt: stat?._max.createdAt || null,
    };
  });
}
```

#### Option B: Schema Fields with Direct Increment (Best for Scaling)
For higher traffic, add the fields directly to the `AutoReplyRule` table in `prisma.schema`:
```prisma
model AutoReplyRule {
  // ... existing fields
  triggerCount  Int       @default(0)
  lastTriggered DateTime?
}
```
And inside `rules.service.ts`'s `trigger` method:
```typescript
await this.prisma.autoReplyRule.update({
  where: { id: ruleId },
  data: {
    triggerCount: { increment: 1 },
    lastTriggered: new Date(),
  },
});
```

#### Frontend Display Layout
In the rule card (in `page.tsx`), replace the standard descriptive text layout with a grid detailing analytics:

```tsx
<div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
  <div className="flex items-center gap-1.5">
    <Zap className="w-3.5 h-3.5 text-amber-500" />
    <span>مرات التفعيل: </span>
    <span className="font-bold text-foreground">{rule.triggerCount || 0}</span>
  </div>
  <div className="flex items-center gap-1.5 justify-end">
    <Clock className="w-3.5 h-3.5 text-blue-500" />
    <span>آخر تفعيل: </span>
    <span className="font-bold text-foreground">
      {rule.lastTriggeredAt 
        ? new Date(rule.lastTriggeredAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
        : 'لم يُفعّل بعد'}
    </span>
  </div>
</div>
```

---

### Recommendation 6: Add a Rule Templates Library Loader

Define a static library of templates to help users get started immediately.

#### 1. Define local templates schema (`frontend/src/app/dashboard/rules/templates.ts`):
```typescript
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string;
  replyText: string;
  privateSequence: SequenceMessage[];
  category: 'SALES' | 'SUPPORT' | 'MARKETING';
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'price-inquiry',
    name: 'الرد التلقائي على استفسارات السعر',
    description: 'يقوم بالرد على الكلمات المتعلقة بالسعر ويوجه العميل للشراء عبر الخاص.',
    keywords: 'بكم, السعر, سعر, كم السعر, بكم السعر, السعر كم',
    replyText: 'أهلاً بك! تم إرسال تفاصيل الأسعار كاملة وصور المنتجات في رسالة خاصة 💬',
    category: 'SALES',
    privateSequence: [
      {
        id: '1',
        type: 'TEXT',
        delaySeconds: 1,
        text: 'أهلاً بك! سعر المنتج هو 150 ريال سعودي فقط. يتوفر لدينا شحن سريع لجميع مناطق المملكة 🇸🇦'
      },
      {
        id: '2',
        type: 'QUICK_REPLIES',
        delaySeconds: 2,
        text: 'هل تود تأكيد طلبك الآن؟',
        quickReplies: [
          { title: 'نعم، أريد الطلب 🛒', payload: 'CONFIRM_ORDER' },
          { title: 'تواصل مع المبيعات 📞', payload: 'CONTACT_SALES' }
        ]
      }
    ]
  },
  {
    id: 'welcome-flow',
    name: 'الترحيب بالعملاء الجدد والتعريف بالشركة',
    description: 'يرحب بالعميل فور تعليقه بكلمة ترحيبية ويعرض كارت تعريفي بالخدمات.',
    keywords: 'مرحباً, السلام عليكم, هلو, سلام, صباح الخير, مساء الخير',
    replyText: 'وعليكم السلام ورحمة الله وبركاته! أهلاً بك. تفقد الخاص للمزيد من المعلومات ✨',
    category: 'MARKETING',
    privateSequence: [
      {
        id: '1',
        type: 'CAROUSEL',
        delaySeconds: 1,
        cards: [
          {
            title: 'خدماتنا الرقمية',
            subtitle: 'نساعدك على برمجة البوتات وإدارة الحملات الإعلانية.',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
            buttons: [{ type: 'web_url', title: 'موقعنا الإلكتروني 🌐', url: 'https://example.com' }]
          },
          {
            title: 'طلب استشارة مجانية',
            subtitle: 'احصل على استشارة مجانية لمدة 15 دقيقة مع خبرائنا.',
            imageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b904737c88?w=400',
            buttons: [{ type: 'postback', title: 'احجز الآن 📅', payload: 'BOOK_CONSULTATION' }]
          }
        ]
      }
    ]
  }
];
```

#### 2. Templates Modal Component
Create a modal dialog containing the list of templates. When a user clicks a template card, populate the creation form states and open the main creator Dialog:
```tsx
// Inside RulesPage:
const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

const handleApplyTemplate = (template: RuleTemplate) => {
  setName(template.name);
  setKeywords(template.keywords);
  setReplyText(template.replyText);
  // Update sequence list state
  setMessages(template.privateSequence);
  
  setIsTemplatesOpen(false);
  setIsDialogOpen(true); // Open the Rule edit form populated with template
};
```
Provide a button styled next to the "Add Rule" button:
```tsx
<Button 
  variant="outline" 
  onClick={() => setIsTemplatesOpen(true)} 
  className="gap-2 rounded-xl px-5 h-11 border-dashed hover:bg-accent"
>
  <Sparkles className="w-4 h-4 text-primary" />
  مكتبة القوالب الجاهزة
</Button>
```

---

## 5. Verification Method

To verify these implementations during review:

1.  **Code Compilation & Verification**:
    *   Execute Next.js builds on the frontend:
        ```bash
        cd frontend
        npm run build
        ```
    *   Run ESLint checks to prevent Next.js 16/React 19 syntax or hook issues:
        ```bash
        npm run lint
        ```
2.  **API Verification**:
    *   Verify the editing payload uses the `PUT /rules/:id` endpoint. Using DevTools Network Tab, confirm that updating a rule issues a `PUT` request with payload structure mapping to `UpdateRuleDto`.
    *   Inspect `GET /rules` response. Verify it successfully returns properties `triggerCount` (number) and `lastTriggeredAt` (string/null) parsed in Recommendation 5.
3.  **UI Interactivity Spot-Check**:
    *   Click "مكتبة القوالب" to confirm the loading of templates, pick one, and verify the edit fields are auto-filled.
    *   Add 3 elements in the sequential response UI. Drag the third element to the top position and verify it immediately swaps places in both the editor list and the mobile preview screen.
