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
              <DialogDescription className="mt-2 text-sm text-muted-foreground text-center">
                {state.options.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-center mt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="rounded-xl px-5 cursor-pointer"
              >
                {state.options.cancelText || 'إلغاء'}
              </Button>
              <Button
                variant={state.options.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={handleConfirm}
                className="rounded-xl px-5 font-bold shadow-md cursor-pointer"
              >
                {state.options.confirmText || 'تأكيد'}
              </Button>
            </DialogFooter>
          </DialogContent>
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
