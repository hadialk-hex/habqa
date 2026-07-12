# Analysis - NestJS Backend & Next.js Frontend Exploration

This report documents the findings from the exploration of the NestJS backend and Next.js frontend, including located mock data, missing backend endpoints required to pass E2E tests, and responsive design plans for both the landing page navigation and the inbox view.

---

## 1. Frontend Mock Data Files

We identified all files in the frontend (`frontend/src/`) that contain mock data for the specified views:

### A. Dashboard Statistics
* **File Path**: `frontend/src/app/dashboard/page.tsx`
* **Mock Data Details**:
  * `kpiCards` (lines 7-48): Array containing mock KPIs for "إجمالي المشتركين" (Total Subscribers - `12,340`), "الردود الآلية" (Auto-Replies - `8,234`), "المحادثات النشطة" (Active Conversations - `573`), and "معدل التحويل" (Conversion Rate - `12.5%`).
  * `platformData` (lines 50-81): Array containing stats for WhatsApp, Facebook, and Instagram.
  * `recentChats` (lines 83-89): Array containing recent conversation snippets (e.g. Ahmad, Sarah, Khaled) along with platform, timestamp, and message body.

### B. Sidebar User Details
* **File Path**: `frontend/src/components/app-sidebar.tsx`
* **Mock Data Details**:
  * Sidebar footer (lines 89-99): Displays a mock user profile with name "محمد أحمد" and email "mohammad@hubqa.com".

### C. Settings Tabs (Profile, Company, Security)
* **File Path**: `frontend/src/app/dashboard/settings/page.tsx`
* **Mock Data Details**:
  * `settingsNav` (lines 9-15): Defines settings tab buttons for Profile, Company, Security, Billing, and Notifications.
  * Profile Tab (lines 53-140): Inputs contain default values for First Name ("محمد"), Last Name ("أحمد"), and Email ("mohammad@hubqa.com").
  * Company Tab (lines 174-206): Input contains default Company Name ("متجر حبقة") and displays mock billing plan details (e.g., "الخطة الاحترافية").
  * Security Tab (lines 142-172): Standard password fields with placeholder values "••••••••".

### D. Subscribers
* **File Path**: `frontend/src/app/dashboard/subscribers/page.tsx`
* **Mock Data Details**:
  * `subscribers` (lines 10-17): Array containing mock subscriber profiles (e.g. Ahmad Al-Ali, Sarah Mohammad, Khaled Saeed) with properties like ID, platform, joined date, interaction count, and active status.
  * Summary Cards (lines 45-57): Hardcoded summary values for Total Subscribers (`12,340`), Active This Week (`3,210`), Facebook (`5,430`), and WhatsApp (`6,910`).

### E. Inbox Conversations & Messages
* **File Path**: `frontend/src/app/dashboard/inbox/page.tsx`
* **Mock Data Details**:
  * `conversations` (lines 7-14): Array containing mock active conversations with fields: `id`, `name`, `platform` (facebook/whatsapp/instagram), `msg` (last message), `time`, and `unread` count.
  * Message Thread (lines 145-191): Contains hardcoded incoming and outgoing messages representing a simulation of auto-reply.

---

## 2. Missing NestJS Endpoints (Backend)

By inspecting the tests in `backend/test/inbox.e2e-spec.ts` and `backend/test/cross-feature.e2e-spec.ts`, the following endpoints are missing, incomplete, or require authorization guards:

### A. Inbox & Messaging Endpoints (Tested in `inbox.e2e-spec.ts` & `cross-feature.e2e-spec.ts`)
* **`POST /inbox/conversations/:id/messages`** (Send Message)
  * **Behavior**: Sends an outbound message to a customer in the specified conversation. Saves the message to the DB with `direction: 'OUTBOUND'`.
  * **Validations**: Returns `400 Bad Request` if `content` is empty. If the target channel connection token is revoked or invalid, it must catch the error, mark the channel connection (`PlatformConnection`) as inactive (`isActive = false`), and return `400`, `401`, or `500`.
* **`PATCH /inbox/conversations/:id/read`** (Mark Read / Update Status)
  * **Behavior**: Marks the conversation as read (sets `read` flag or similar in DB) and optionally updates the conversation status (e.g. `status: 'RESOLVED'` or `status: 'OPEN'`).
* **`GET /inbox/conversations`** (Filters Incomplete)
  * **Behavior**: Currently implemented but lacks required query parameter filters:
    * `connectionId`: Filter conversations belonging to a specific channel connection.
    * `page` & `limit`: Paginate the results. Returns `[]` if page requests exceed maximum range.
* **`GET /inbox/conversations/:id/messages`** (NotFound check Incomplete)
  * **Behavior**: Lacks validation to return `404 Not Found` when requesting messages for a non-existent conversation (currently returns `200 []`).

### B. Subscriber Endpoints (Tested in `inbox.e2e-spec.ts` & `cross-feature.e2e-spec.ts`)
* *Note: No subscribers controller/service exists in `backend/src`.*
* **`POST /subscribers`** (Create Subscriber)
  * **Behavior**: Manually creates a new subscriber profile.
  * **Payload**: `{ name: string, phone: string, email: string, tags: string[] }`
  * **Validations**: Returns `400 Bad Request` if email or phone is malformed.
* **`GET /subscribers`** (List/Search Subscribers)
  * **Query Params**: `search: string`
  * **Behavior**: Returns all subscribers matching the search term (by name, email, phone, or tags). If `search` is empty or undefined, returns all subscribers for the tenant.
* **`GET /subscribers/:id`** (Get Subscriber)
  * **Behavior**: Retrieves a single subscriber. Returns `404 Not Found` if not exists.
* **`PATCH /subscribers/:id`** (Update Subscriber)
  * **Payload**: `{ name?, phone?, email?, tags?, notes? }`
  * **Validations**: Returns `404 Not Found` if not exists. Deduplicates tags list before saving (e.g. `['vip', 'vip']` -> `['vip']`).
* **`DELETE /subscribers/:id`** (Delete Subscriber)
  * **Behavior**: Deletes subscriber. Returns `404 Not Found` if not exists.

### C. Auth & Password Reset Endpoints (Tested in `cross-feature.e2e-spec.ts`)
* **`POST /auth/logout`** (Logout)
  * **Behavior**: Invalidates the current JWT token. Subsequent requests with the same token must fail with `401 Unauthorized`.
  * **Implementation Plan**: Store revoked tokens in an in-memory Set (or database-backed token blacklist) and check against this blacklist in `JwtStrategy`.
* **`POST /auth/password-reset`** (Request Reset)
  * **Payload**: `{ email: string }`
  * **Behavior**: Validates that a user with the email exists (returns `404 Not Found` if not). Creates a reset token with expiration and stores it in the `PasswordResetToken` table.
  * **Validations**: Restricts creation rate on repeated requests (returns `429 Too Many Requests` on third request).
* **`POST /auth/password-reset/reset`** (Execute Reset)
  * **Payload**: `{ token: string, password: string }`
  * **Behavior**: Validates reset token. Returns `400 Bad Request` if token is expired, used, or malformed. Hashes the new password, updates the user record, and invalidates the reset token. Also invalidates any previous active sessions/JWTs if applicable.
* **`PATCH /auth/profile`** (Update Profile)
  * **Payload**: `{ name: string }`
  * **Behavior**: Updates the logged-in user's profile details.
  * **Validations**: Returns `400 Bad Request` if payload types are invalid (e.g. name is a number).

### D. Rules & Connections Extra Endpoints (Tested in `cross-feature.e2e-spec.ts`)
* **`GET /rules/:id/logs`** (Log Listing Incomplete)
  * **Behavior**: Currently returns `[]`. Needs to return a list of rule execution logs if the rule exists, and throw `404 Not Found` if the rule is not found.
* **`POST /rules/:id/trigger`** (Trigger Simulation Incomplete)
  * **Behavior**: Triggers the rule. Must reject with `403 Forbidden` (or `400`) if the rule's channel connection (`PlatformConnection`) is disabled (`isActive: false`).
* **`DELETE /channels/:id`** (Role Checking Incomplete)
  * **Behavior**: Must restrict deletion to users with `OWNER` role. If a `MEMBER` (agent) role attempts to delete, return `403 Forbidden`.

---

## 3. Responsive UI Implementation Plan

### A. Landing Page Mobile Navigation Menu (Hamburger Button)
The landing page navigation in `frontend/src/app/page.tsx` hides navigation links on small screens using the Tailwind class `hidden md:flex`. There is no mobile menu fallback.

#### Solution Plan:
1. **Hamburger Button**: Add a menu/hamburger button (using `Menu` or `X` icon from `lucide-react`) next to the action buttons inside the header. This button will only be visible on mobile screen sizes (`md:hidden`).
2. **Sheet Component**: Integrate shadcn's `Sheet` (which is already configured in the project under `components/ui/sheet.tsx`) to handle the mobile drawer overlay.
3. **Menu Content**: Inside the mobile menu drawer (SheetContent), render the navigation links vertically along with a "Start Free" CTA button. Clicking a navigation link or the close button will dismiss the drawer.
4. **Implementation sketch (JSX)**:
   ```tsx
   import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
   import { Menu } from "lucide-react";
   
   // In the header component:
   <div className="flex items-center gap-3">
     <ThemeToggle />
     <Link href="/register" className="hidden sm:inline-block">
       <Button className="rounded-full">ابدأ مجاناً</Button>
     </Link>
     {/* Mobile Hamburger Menu */}
     <Sheet>
       <SheetTrigger asChild>
         <Button variant="outline" size="icon" className="md:hidden rounded-xl">
           <Menu className="w-5 h-5" />
         </Button>
       </SheetTrigger>
       <SheetContent side="right" className="w-[300px]">
         <SheetTitle className="text-right font-black mb-6">القائمة</SheetTitle>
         <nav className="flex flex-col gap-5 text-right font-medium mt-8">
           <a href="#features" className="text-lg hover:text-primary transition-colors">الميزات</a>
           <a href="#pricing" className="text-lg hover:text-primary transition-colors">الأسعار</a>
           <a href="#how-it-works" className="text-lg hover:text-primary transition-colors">كيف يعمل</a>
           <Link href="/register" className="mt-4">
             <Button className="w-full rounded-xl">ابدأ مجاناً</Button>
           </Link>
         </nav>
       </SheetContent>
     </Sheet>
   </div>
   ```

### B. Responsive Inbox (Toggle Conversation vs Messages on Mobile)
Currently, the inbox layout in `frontend/src/app/dashboard/inbox/page.tsx` renders the conversation list card and the message thread card side-by-side using `flex flex-col md:flex-row`. On mobile, they stack vertically, showing both lists in full height, which makes the UI unusable.

#### Solution Plan:
1. **View Toggle State**: Introduce a new state `mobileView` to keep track of the active view on mobile:
   ```typescript
   const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
   ```
2. **Conditional CSS Display**:
   * Hide the Conversation List Card when `mobileView` is `'chat'` on mobile screens. Add class names `w-full md:w-80 lg:w-96 flex flex-col border-none shadow-lg overflow-hidden shrink-0` and conditional styling:
     ```className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}```
   * Hide the Chat Area Card when `mobileView` is `'list'` on mobile screens. Add class names:
     ```className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex-1 flex flex-col'}`}```
3. **State Transitions**:
   * When a conversation is clicked in the list, set the active chat ID and switch to the chat view:
     ```typescript
     onClick={() => {
       setActiveChat(chat.id);
       setMobileView('chat');
     }}
     ```
   * Add a "Back" button inside the Chat Header that is visible only on mobile screens (`md:hidden`) using `ArrowRight` (for RTL layout). Clicking it returns to the conversation list:
     ```typescript
     {/* Back Button for Mobile */}
     <button 
       onClick={() => setMobileView('list')}
       className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent transition-all"
     >
       <ChevronRight className="w-5 h-5" /> {/* ChevronRight acts as Back in RTL */}
     </button>
     ```
