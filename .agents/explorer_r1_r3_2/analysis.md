# Analysis: Native Dialogs, Alerts, and Reloads Refactoring

This report documents all occurrences of native `window.alert()`, `window.confirm()`, and `window.location.reload()` calls across the Hubqa frontend codebase. It provides recommendations and code designs for custom React replacements (Toast/Notifications and a Promise-based Confirmation Dialog Modal) and outlines a transition strategy to modern React state management.

---

## 1. Overview of Findings

An automated recursive search across `frontend/src` identified **17 occurrences** of native browser interactions:
- **Alerts (`window.alert`)**: 11 occurrences, primarily used for success notifications, form validation errors, and API error reports.
- **Confirms (`window.confirm`)**: 4 occurrences, used for critical user destructive actions (deleting tenants, rules, team members, or broadcasting announcements).
- **Reloads (`window.location.reload`)**: 2 occurrences, used to force a page refresh so that updated profile and workspace names propagate through the app layout.

### Detailed Occurrence Table

| File Path | Line | Native Call | Trigger Context | Arabic Text |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/admin/page.tsx` | 228 | `confirm(...)` | Tenant deletion prompt | `هل أنت متأكد من حذف "${tenant.name}" نهائياً؟ سيتم حذف جميع بياناته (قنوات، قواعد، محادثات) ولا يمكن التراجع.` |
| `src/app/admin/page.tsx` | 705 | `confirm(...)` | Send system-wide announcement | `سيتم الإرسال لجميع مستخدمي المنصة. متابعة؟` |
| `src/app/dashboard/inbox/page.tsx` | 83 | `alert(...)` | Message send failure alert | `فشل إرسال الرسالة` |
| `src/app/dashboard/rules/page.tsx` | 93 | `confirm(...)` | Rule deletion prompt | `هل أنت متأكد من حذف هذه القاعدة؟` |
| `src/app/dashboard/settings/page.tsx` | 78 | `alert(...)` | AI settings save success | `تم حفظ إعدادات الردود الذكية بنجاح` |
| `src/app/dashboard/settings/page.tsx` | 81 | `alert(...)` | AI settings save failure | `فشل حفظ الإعدادات` |
| `src/app/dashboard/settings/page.tsx` | 106 | `alert(...)` | Profile update success | `تم تحديث الملف الشخصي بنجاح` |
| `src/app/dashboard/settings/page.tsx` | 107 | `window.location.reload()` | Refresh page on profile update | N/A |
| `src/app/dashboard/settings/page.tsx` | 110 | `alert(...)` | Profile update failure | `فشل تحديث الملف الشخصي` |
| `src/app/dashboard/settings/page.tsx` | 124 | `alert(...)` | Workspace name update success | `تم تحديث اسم مساحة العمل بنجاح` |
| `src/app/dashboard/settings/page.tsx` | 125 | `window.location.reload()` | Refresh page on workspace update | N/A |
| `src/app/dashboard/settings/page.tsx` | 128 | `alert(...)` | Workspace name update failure | `فشل تحديث مساحة العمل` |
| `src/app/dashboard/settings/page.tsx` | 136 | `alert(...)` | Password validation (empty) | `الرجاء إدخال كلمة المرور الجديدة` |
| `src/app/dashboard/settings/page.tsx` | 140 | `alert(...)` | Password validation (mismatch) | `كلمتا المرور غير متطابقتين` |
| `src/app/dashboard/settings/page.tsx` | 146 | `alert(...)` | Password update success | `تم تحديث كلمة المرور بنجاح` |
| `src/app/dashboard/settings/page.tsx` | 152 | `alert(...)` | Password update failure | `فشل تحديث كلمة المرور` |
| `src/app/dashboard/team/page.tsx` | 102 | `confirm(...)` | Team member removal prompt | `هل أنت متأكد من إزالة ${member.user.name \|\| member.user.email} من الفريق؟` |

---

## 2. Component Design Recommendations

To improve UX and align with the design overhaul goals, we recommend introducing a global Toast context and a global Confirmation Dialog context.

### A. Custom Toast / Notification System (`ToastProvider`)
A lightweight, custom, and accessible Toast system can be created using the existing dependencies (including `framer-motion` for transitions).

*   **File Placement**: `frontend/src/components/ui/toast.tsx`
*   **Key Features**: Auto-dismiss timer, success/error/info styling matching the theme, support for Arabic RTL layout out-of-the-box.

#### Proposed Design Code:
```tsx
"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none" dir="rtl">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold shadow-lg pointer-events-auto border ${
                toast.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : toast.type === 'error'
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" />}
              {toast.type === 'info' && <Info className="w-5 h-5 shrink-0 text-primary" />}
              
              <span className="flex-1 text-right">{toast.message}</span>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context;
}
```

---

### B. Custom Promise-based Confirmation Modal (`ConfirmProvider`)
Creating a Promise-based modal allows us to replace `window.confirm` with `await confirm(...)` directly inside event handlers. This avoids introducing massive state boilerplates (e.g. open states, callback handlers) inside each individual page.

*   **File Placement**: `frontend/src/components/ui/confirm-dialog.tsx`
*   **Key Features**: Wraps the existing shadcn Dialog component, manages a custom promise resolver to return `true`/`false` seamlessly.

#### Proposed Design Code:
```tsx
"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'destructive'
}

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Dialog open={state.isOpen} onOpenChange={(open) => {
          if (!open) handleCancel()
        }}>
          <DialogContent className="sm:max-w-[440px]" showCloseButton={false} dir="rtl">
            <DialogHeader className="flex flex-col items-center text-center">
              {state.options.variant === 'destructive' && (
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
              )}
              <DialogTitle className="text-xl font-black">
                {state.options.title || 'تأكيد الإجراء'}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">
                {state.options.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-center mt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="rounded-xl px-5"
              >
                {state.options.cancelText || 'إلغاء'}
              </Button>
              <Button
                variant={state.options.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={handleConfirm}
                className="rounded-xl px-5 font-bold shadow-md"
              >
                {state.options.confirmText || 'تأكيد'}
              </Button>
            </DialogFooter>
          </Dialog>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}
```

---

## 3. React State/Context Strategy (Eliminating Page Reloads)

In `frontend/src/app/dashboard/settings/page.tsx`, the two `window.location.reload()` calls exist because `localStorage` user updates do not propagate to the `useAuth()` hook in real-time. 

To eliminate hard browser refreshes:
1. Update `frontend/src/lib/auth-context.tsx` to expose an `updateUser(fields: Partial<User>)` function.
2. Inside `updateUser`, mutate both the React state (`setUser`) and synchronization storage (`localStorage.setItem`).

#### Proposed `auth-context.tsx` modification:
```tsx
// Inside AuthContextType interface:
updateUser: (updatedFields: Partial<User>) => void;

// Inside AuthProvider component:
const updateUser = useCallback((updatedFields: Partial<User>) => {
  setUser(prev => {
    if (!prev) return null
    const updated = { ...prev, ...updatedFields }
    localStorage.setItem('user', JSON.stringify(updated))
    return updated
  })
}, [])

// Inside value prop of AuthContext.Provider:
updateUser
```

---

## 4. Refactoring Action Plan for the Implementer

Here is the exact step-by-step instruction set for replacing all occurrences:

1. **Step 1: Write Custom Components**
   Create `frontend/src/components/ui/toast.tsx` and `frontend/src/components/ui/confirm-dialog.tsx` with the proposed designs.
   
2. **Step 2: Add Providers to Root Layout**
   In `frontend/src/app/layout.tsx`, wrap the app with the new providers:
   ```tsx
   import { ToastProvider } from "@/components/ui/toast"
   import { ConfirmProvider } from "@/components/ui/confirm-dialog"
   // ...
   <ThemeProvider ...>
     <AuthProvider>
       <ToastProvider>
         <ConfirmProvider>
           {children}
         </ConfirmProvider>
       </ToastProvider>
     </AuthProvider>
   </ThemeProvider>
   ```

3. **Step 3: Modify `auth-context.tsx`**
   Add `updateUser` to the authentication provider so local user mutations update the sidebar automatically without page reloads.

4. **Step 4: Refactor `settings/page.tsx`**
   - Import `useToast` and `useAuth` (use the new `updateUser` from auth context).
   - Replace all `alert("...")` with `showToast("...", "success")` or `showToast("...", "error")`.
   - Remove `window.location.reload()` and invoke `updateUser({ name: fullName })` or `updateUser({ tenantName: workspaceName })` instead.

5. **Step 5: Refactor `inbox/page.tsx`**
   - Import `useToast`.
   - Replace `alert(err.response?.data?.message || "فشل إرسال الرسالة")` with `showToast(err.response?.data?.message || "فشل إرسال الرسالة", "error")`.

6. **Step 6: Refactor `team/page.tsx`**
   - Import `useConfirm`.
   - In `handleRemove`, replace:
     `if (!confirm(...)) return`
     with:
     `const confirmed = await confirm({ title: "إزالة عضو", message: "هل أنت متأكد من إزالة العضو...", variant: "destructive" }); if (!confirmed) return`

7. **Step 7: Refactor `rules/page.tsx`**
   - Import `useConfirm`.
   - In `handleDeleteRule`, replace the native `confirm()` check with `await confirm({ title: "حذف قاعدة", message: "هل أنت متأكد من حذف هذه القاعدة؟", variant: "destructive" })`.

8. **Step 8: Refactor `admin/page.tsx`**
   - Import `useConfirm`.
   - Replace `confirm` inside `handleTenantDelete` with `await confirm({ title: "حذف مساحة العمل", message: "هل أنت متأكد...", variant: "destructive" })`.
   - Replace `confirm` inside announcement trigger with `await confirm({ title: "إرسال نشرة", message: "سيتم الإرسال لجميع مستخدمي المنصة...", variant: "primary" })`.
