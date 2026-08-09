import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  icon?: LucideIcon
  onConfirm: () => void | Promise<void>
}

/** Confirmation dialog with an icon, message, and async-aware actions. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon: Icon = AlertTriangle,
  onConfirm,
}: DialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} size="sm" showClose={false}>
      <div className="flex items-start gap-4">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
          }`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight text-neutral-900">{title}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{description}</p>}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm} disabled={loading}>
          {loading ? 'Please wait…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
