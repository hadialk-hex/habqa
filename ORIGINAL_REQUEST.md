# Original User Request

## Initial Request — 2026-07-12T12:57:21Z

Complete overhaul of **Hubqa (حبقة)** — an Arabic-first RTL social media auto-reply SaaS platform (Next.js 16 frontend + NestJS 11 backend). Fix all visual/functional bugs identified in a 16-file audit, redesign with a futuristic Dark Neon aesthetic, and add competitive features to match ManyChat/Chatfuel/Respond.io.

Working directory: c:\Users\pc\Desktop\face bot
Integrity mode: development

## Known Bugs (from full audit — MUST FIX)

### 🚨 Critical Bugs
1. **Subscribers fake pagination** — subscribers/page.tsx L192-200: always shows page "1", both nav buttons disabled, no server-side pagination
2. **Hardcoded billing** — settings/page.tsx L412-446: shows fake "الخطة الاحترافية" at "99 ريال/شهر" regardless of real plan
3. **Password change without current password** — settings L134: security hole
4. **No rule editing** — rules/page.tsx: only create/delete, no edit
5. **26+ dead buttons** across all pages: inbox Filter/Phone/Video/Emoji/Attachment, subscribers Export/Filter, settings Avatar change/Regional save, notification bell

### ⚠️ High Priority Bugs
6. **Purple remnants in admin** — admin/page.tsx L82-86, L287-289, L828: Enterprise plan and Messages stat use explicit purple colors
7. **Native `alert()`/`confirm()` calls** — settings L78/L106, rules L93, team L102, admin L228: ugly browser dialogs instead of custom UI
8. **`window.location.reload()`** — settings L107/L125: bad UX pattern
9. **Admin tabs overflow on mobile** — admin L339: 6 tabs in grid with no scroll
10. **`any` TypeScript types everywhere** — inbox, subscribers, dashboard stats have no interfaces
11. **No error feedback** — most API errors are just `console.error`, users see nothing
12. **Inbox preview shows static text** — inbox L185: "اضغط لعرض..." instead of actual last message
13. **Settings uses native `<select>`** — L254-266: visually inconsistent
14. **Dialog close button shows English "Close"** — dialog.tsx L113

## Requirements

### R1. Fix ALL Dropdown/Select/Dialog Overflow Issues
Every dropdown, Select, dialog, and popover must render fully visible with proper z-index layering. The Select portal uses `z-50` and Dialog also uses `z-50` — when Select is inside Dialog, the Select dropdown can appear behind the dialog overlay. Fix the stacking context. Admin page tabs must scroll horizontally on mobile instead of overflowing.

### R2. Futuristic Dark Neon Design System
Redesign the entire application with a premium "Dark Neon" aesthetic. This is the **primary visual identity** of the platform:
- **Backgrounds**: Deep dark (#0a0a0f / #0d1117) with subtle radial gradient highlights
- **Accent colors**: Neon Teal (#0ff5d4) / Cyan (#00e5ff) primary glow, subtle blue secondary, NO purple anywhere
- **Cards**: Frosted glass effect with backdrop-blur, subtle neon border glow on hover
- **Animations**: Page entrance, hover scale+glow, staggered fade-in, floating elements
- **Typography**: Inter/Tajawal, gradient text for headings, clean hierarchy
- **ALL pages must match**: Landing, Auth, Dashboard (all 7 sub-pages), Admin, Legal pages

### R3. Fix ALL Dead Buttons & Replace Native Dialogs
Every button and interactive element must have a working handler or be removed:
- Replace all `alert()` → custom toast/banner notifications
- Replace all `confirm()` → custom confirmation Dialog (like channels page delete dialog)
- Replace all `window.location.reload()` → state update or context refresh
- Fix or remove: notification bell, inbox filter, inbox phone/video/emoji/attachment buttons, subscribers export/filter, settings avatar/regional save
- Add proper TypeScript interfaces for all `any` types
- Add user-facing error messages for all API failures (no more `console.error` only)

### R4. Advanced Auto-Reply Rule Builder with Edit & Rich Messages
Transform the rules page:
- **Edit existing rules** (currently only create/delete — this is the #1 UX complaint)
- **Multiple response types**: Text, Image with caption, Carousel/Cards with buttons (URL + Postback), Quick Reply buttons
- **Multiple sequential messages**: Chain 2-5 responses per rule with drag-to-reorder
- **Visual message preview**: Show how the message will render on Facebook/WhatsApp
- **Rule analytics**: Show trigger count, last triggered date for each rule
- **Templates library**: Save/reuse common reply patterns
- **Proper confirmation dialogs** for delete (not `confirm()`)

### R5. Flow Builder (Visual Automation)
Add a new page at `/dashboard/flows` with a visual node-based flow builder:
- **Trigger nodes**: Keyword match, New subscriber, Comment on post, Any message
- **Action nodes**: Send message (text/image/card), Add tag, Remove tag, Notify team, Wait/Delay
- **Condition nodes**: If/else based on tag, platform, time, keyword
- **Visual connections** between nodes with animated lines
- **Save/Activate/Deactivate** flows
- The visual builder UX must be impressive — even if the backend execution is simplified. Use a library like reactflow or build with SVG.

### R6. Broadcasting & Scheduled Messages
Add a new page at `/dashboard/broadcasts`:
- **Campaign creation**: Name, message content (rich: text/image/buttons), target segment
- **Scheduling**: Send now or schedule for specific date/time
- **Status tracking**: Draft → Scheduled → Sending → Completed
- **Delivery stats UI**: Sent count, delivered, read, clicked (even if backend data is simulated)
- **Segment targeting**: By tags, platform, subscription date range
- **Campaign list** with filters and pagination

### R7. Enhanced Analytics Dashboard with Real Charts
Upgrade `/dashboard` with a real charting library (recharts or similar):
- **Date range picker**: Today / 7 days / 30 days / Custom range
- **Line chart**: Messages sent/received over time
- **Bar chart**: Subscriber growth by day/week
- **Donut chart**: Platform distribution (Facebook/Instagram/WhatsApp)
- **KPI cards**: With real trend data (↑ +12% from last week, ↓ -5%)
- **Quick action buttons**: "Create Rule", "Connect Channel", "New Broadcast"
- Remove redundant "Quick Stats" section (duplicates KPI cards)

### R8. Subscriber Management with Tags, Segments & Profiles
Upgrade `/dashboard/subscribers`:
- **Real server-side pagination** (fix fake pagination)
- **Tag system**: Add/remove colored tags on subscribers
- **Segments**: Saved filter presets ("Active Facebook users", "New this week")
- **Subscriber profile drawer/page**: Full conversation history, tags, platform, dates
- **Bulk actions**: Select multiple → tag/export/delete
- **Search and filter**: By name, platform, tag, date range
- **Fix platform detection**: Use actual platform data, not heuristic email/phone check
- **Working export button**: CSV export of subscriber list

### R9. Professional Inbox with Rich Messaging & Real-time
Upgrade `/dashboard/inbox`:
- **Send rich messages**: Text, images, quick reply buttons
- **Conversation status**: Open / Resolved / Snoozed with toggle
- **Assign to team member**: Dropdown to assign conversations
- **Canned responses**: Quick-insert saved replies
- **Auto-scroll to bottom** on new messages
- **Real conversation preview** (last message text, not static placeholder)
- **Proper message UI**: Fix RTL alignment for outbound messages
- **Remove dead buttons** or implement: phone, video, emoji, attachment
- **Typing indicator UI** (even if simulated)

## Acceptance Criteria

### Design Quality
- [ ] Zero purple/magenta colors anywhere in the application (grep for `purple`, `violet`, hue `275`-`310` returns zero in user-facing code)
- [ ] All pages use consistent Dark Neon color palette with teal/cyan accents
- [ ] All dropdowns/selects inside dialogs display fully visible (z-index tested)
- [ ] Admin page tabs are fully visible and scrollable on mobile
- [ ] All cards have glassmorphism effects with hover glow transitions
- [ ] Smooth entrance animations on all pages (staggered fade-in)
- [ ] `next build` completes with zero TypeScript errors

### Bug Fixes
- [ ] Zero native `alert()` or `confirm()` calls in the codebase (grep returns zero)
- [ ] Zero `window.location.reload()` calls (grep returns zero)
- [ ] Zero `any` type for state variables in dashboard pages
- [ ] All buttons have working click handlers or are removed
- [ ] All API errors show user-facing feedback in Arabic
- [ ] Subscribers page has working server-side pagination
- [ ] Settings billing shows real plan data from API
- [ ] Password change requires current password
- [ ] Dialog close button shows "إغلاق" not "Close"

### Features
- [ ] Rules page supports editing existing rules
- [ ] Rules support multiple response messages (text + image + buttons)
- [ ] Flow builder page exists at `/dashboard/flows` with visual node interface
- [ ] Broadcasts page exists at `/dashboard/broadcasts` with campaign creation
- [ ] Dashboard has interactive charts using a chart library
- [ ] Dashboard has date range picker
- [ ] Subscribers page supports tags
- [ ] Inbox shows real conversation preview (last message text)
- [ ] Templates library for reusable message patterns

### Code Quality
- [ ] `next build` passes with zero errors
- [ ] All Arabic text displays correctly RTL
- [ ] No placeholder or English UI labels in user-facing pages
- [ ] All pages have loading states and empty states with Arabic text

## Follow-up — 2026-07-12T09:12:36Z

⚠️ تنبيه مهم — المتطلبات الجديدة هي الأولوية الآن!

المراحل القديمة (1-7) التي أنجزتموها ممتازة. لكن المستخدم طلب الآن تحديثات جديدة بالكامل وهي الأولوية القصوى:

### المتطلبات الجديدة (R1-R9) — الأولوية الآن:

**R1**: إصلاح كل Dropdowns/Select/Dialog overflow — z-index conflicts بين Select و Dialog
**R2**: إعادة تصميم كامل بـ Dark Neon — ألوان نيون تيل/سيان على خلفية سوداء، لا أي بنفسجي
**R3**: إصلاح 26+ زر ميت + استبدال كل alert()/confirm() بـ custom dialogs
**R4**: Rule Builder متقدم — تعديل قواعد + رسائل غنية (صور، كاروسيل، أزرار)
**R5**: صفحة Flow Builder جديدة — /dashboard/flows — سحب وإفلات بصري
**R6**: صفحة Broadcasting جديدة — /dashboard/broadcasts — إرسال جماعي + جدولة
**R7**: تحليلات متقدمة — رسوم بيانية حقيقية (recharts) + date range picker
**R8**: إدارة مشتركين متقدمة — tags + segments + pagination حقيقي + profile
**R9**: Inbox احترافي — رسائل غنية + conversation status + assign + canned responses

الرجاء التركيز على هذه المتطلبات التسع فوراً. التصميم أولاً (R1-R3) ثم الميزات (R4-R9).


## Follow-up — 2026-07-12T11:48:16Z

The server restarted. Resume parallel execution of Milestones 2, 3, and 4 (R4-R9). Note that the user has manually contributed to the subscribers/page.tsx to add server-side pagination, tag filtering, and inline tag addition. Verify the progress of the workers and continue the implementation until R1-R9 are fully complete.


## Follow-up — 2026-07-12T12:04:19Z

The user has manually implemented Milestone 4 Task 2 (Profile Drawer, CSV Export) in subscribers/page.tsx, as well as the Inbox features (Emojis, Attachments, Status toggles) in inbox/page.tsx. Inform the Milestone 4 sub-orchestrator to perform quick verification of these features and mark Milestone 4 as complete, focusing all remaining resources on finishing the Flow Builder (Tasks 4 and 5 in Milestone 2).



