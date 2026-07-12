const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const frontendRoot = path.join(projectRoot, 'frontend');

console.log('Project Root:', projectRoot);
console.log('Frontend Root:', frontendRoot);

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    failures++;
  } else {
    console.log('✅ PASS:', message);
  }
}

// 1. Landing Page Navigation Menu
console.log('\n--- 1. Landing Page Navigation Menu ---');
const landingPagePath = path.join(frontendRoot, 'src', 'app', 'page.tsx');
if (fs.existsSync(landingPagePath)) {
  const content = fs.readFileSync(landingPagePath, 'utf8');
  assert(content.includes('Sheet'), 'Should use Sheet component');
  assert(content.includes('SheetTrigger'), 'Should use SheetTrigger component');
  assert(content.includes('SheetContent'), 'Should use SheetContent component');
  assert(content.includes('md:hidden') && content.includes('Menu'), 'Mobile trigger button should have md:hidden and wrap Menu icon');
  assert(content.includes('hidden md:flex'), 'Desktop navigation menu should have hidden md:flex');
} else {
  assert(false, 'landing page file not found: ' + landingPagePath);
}

// 2. Inbox Conversation/Chat Toggle
console.log('\n--- 2. Inbox Conversation/Chat Toggle ---');
const inboxPagePath = path.join(frontendRoot, 'src', 'app', 'dashboard', 'inbox', 'page.tsx');
if (fs.existsSync(inboxPagePath)) {
  const content = fs.readFileSync(inboxPagePath, 'utf8');
  assert(content.includes('showChatThread'), 'Should have showChatThread state for mobile responsive view');
  assert(content.includes("showChatThread ? 'hidden md:flex' : 'flex'") || content.includes('showChatThread ? "hidden md:flex" : "flex"'), 'Conversations list should toggle hidden/flex classes on mobile');
  assert(content.includes("showChatThread ? 'flex' : 'hidden md:flex'") || content.includes('showChatThread ? "flex" : "hidden md:flex"'), 'Chat Area should toggle hidden/flex classes on mobile');
  assert(content.includes('setShowChatThread(false)') && content.includes('md:hidden'), 'Should have a mobile-only back button in chat header that hides the chat thread');
} else {
  assert(false, 'inbox page file not found: ' + inboxPagePath);
}

// 3. AuthGuard protection & redirection
console.log('\n--- 3. AuthGuard Protection & Redirection ---');
const authGuardPath = path.join(frontendRoot, 'src', 'components', 'auth-guard.tsx');
const dashboardLayoutPath = path.join(frontendRoot, 'src', 'app', 'dashboard', 'layout.tsx');

if (fs.existsSync(authGuardPath)) {
  const content = fs.readFileSync(authGuardPath, 'utf8');
  assert(content.includes('useAuth'), 'AuthGuard should use useAuth hook');
  assert(content.includes('isAuthenticated') && content.includes('isLoading'), 'AuthGuard should check isAuthenticated and isLoading states');
  assert(content.includes("router.push('/login')") || content.includes('router.push("/login")'), 'AuthGuard should redirect guest traffic to /login');
} else {
  assert(false, 'auth-guard file not found: ' + authGuardPath);
}

if (fs.existsSync(dashboardLayoutPath)) {
  const content = fs.readFileSync(dashboardLayoutPath, 'utf8');
  assert(content.includes('AuthGuard') || content.includes('auth-guard'), 'DashboardLayout should load AuthGuard');
  assert(content.includes('<AuthGuard>'), 'DashboardLayout should wrap children with <AuthGuard>');
} else {
  assert(false, 'dashboard layout file not found: ' + dashboardLayoutPath);
}

// 4. Arabic Loading, Empty, and Error States across Dashboard Views
console.log('\n--- 4. Arabic Loading, Empty, and Error States ---');

// Dashboard Page
console.log('\n[Dashboard Page]');
const dashboardPagePath = path.join(frontendRoot, 'src', 'app', 'dashboard', 'page.tsx');
if (fs.existsSync(dashboardPagePath)) {
  const content = fs.readFileSync(dashboardPagePath, 'utf8');
  assert(content.includes('isLoading'), 'DashboardPage should have isLoading state');
  assert(content.includes('isLoading ? "..."') || content.includes("isLoading ? '...'"), 'DashboardPage should show placeholder loader while loading');
  assert(content.includes('لا توجد محادثات أخيرة حالياً'), 'DashboardPage should show Arabic empty state for recent chats: "لا توجد محادثات أخيرة حالياً"');
} else {
  assert(false, 'dashboard page file not found: ' + dashboardPagePath);
}

// Channels Page
console.log('\n[Channels Page]');
const channelsPagePath = path.join(frontendRoot, 'src', 'app', 'dashboard', 'channels', 'page.tsx');
if (fs.existsSync(channelsPagePath)) {
  const content = fs.readFileSync(channelsPagePath, 'utf8');
  assert(content.includes('isLoading'), 'ChannelsPage should have isLoading state');
  assert(content.includes('جاري تحميل القنوات...'), 'ChannelsPage should show Arabic loading message: "جاري تحميل القنوات..."');
  assert(content.includes('لا توجد قنوات مرتبطة'), 'ChannelsPage should show Arabic empty state: "لا توجد قنوات مرتبطة"');
} else {
  assert(false, 'channels page file not found: ' + channelsPagePath);
}

// Rules Page
console.log('\n[Rules Page]');
const rulesPagePath = path.join(frontendRoot, 'src', 'app', 'dashboard', 'rules', 'page.tsx');
if (fs.existsSync(rulesPagePath)) {
  const content = fs.readFileSync(rulesPagePath, 'utf8');
  assert(content.includes('isLoading'), 'RulesPage should have isLoading state');
  assert(content.includes('جاري تحميل القواعد...'), 'RulesPage should show Arabic loading message: "جاري تحميل القواعد..."');
  assert(content.includes('لا توجد قواعد بعد'), 'RulesPage should show Arabic empty state: "لا توجد قواعد بعد"');
} else {
  assert(false, 'rules page file not found: ' + rulesPagePath);
}

// Inbox Page
console.log('\n[Inbox Page]');
if (fs.existsSync(inboxPagePath)) {
  const content = fs.readFileSync(inboxPagePath, 'utf8');
  assert(content.includes('isLoadingConvs'), 'InboxPage should have isLoadingConvs state');
  assert(content.includes('isLoadingMsgs'), 'InboxPage should have isLoadingMsgs state');
  assert(content.includes('جاري تحميل المحادثات...'), 'InboxPage should show Arabic loading message for conversations: "جاري تحميل المحادثات..."');
  assert(content.includes('جاري تحميل الرسائل...'), 'InboxPage should show Arabic loading message for messages: "جاري تحميل الرسائل..."');
  assert(content.includes('لا توجد محادثات مطابقة'), 'InboxPage should show Arabic empty state for matching query: "لا توجد محادثات مطابقة"');
  assert(content.includes('لا توجد رسائل في هذه المحادثة'), 'InboxPage should show Arabic empty state for messages: "لا توجد رسائل في هذه المحادثة"');
  assert(content.includes('الرجاء اختيار محادثة من القائمة الجانبية للبدء'), 'InboxPage should show Arabic prompt to select a conversation: "الرجاء اختيار محادثة من القائمة الجانبية للبدء"');
  assert(content.includes('حدث خطأ أثناء تحميل المحادثات. الرجاء المحاولة مرة أخرى.'), 'InboxPage should show Arabic error message: "حدث خطأ أثناء تحميل المحادثات. الرجاء المحاولة مرة أخرى."');
} else {
  assert(false, 'inbox page file not found');
}

console.log('\n--- Summary ---');
if (failures === 0) {
  console.log('🎉 ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`❌ VERIFICATION FAILED WITH ${failures} ERRORS.`);
  process.exit(1);
}
