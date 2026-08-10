import { ImagePlus, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { useToast } from '@/components/ui/Toast'
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
  isImageKitConfigured,
  MAX_IMAGE_FILE_SIZE,
  uploadImage,
} from '@/services/imagekit'

export interface DonationImage {
  id: string
  /** Remote URL once uploaded to ImageKit (undefined while local-only). */
  url?: string
  /** ImageKit file id (returned by the upload API) — saved on the backend. */
  fileId?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  /** Local object URL used for instant preview. */
  previewUrl?: string
  uploading: boolean
}

interface ImageUploadProps {
  images: DonationImage[]
  onChange: (updater: DonationImage[] | ((prev: DonationImage[]) => DonationImage[])) => void
  max?: number
}

/** Step 46: JPG / JPEG / PNG / WEBP only — checks both the MIME type and the extension. */
function isAcceptedImage(file: File): boolean {
  const type = file.type.toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_IMAGE_TYPES.includes(type) || ACCEPTED_IMAGE_EXTENSIONS.includes(ext)
}

const MAX_SIZE_MB = MAX_IMAGE_FILE_SIZE / (1024 * 1024)

export function ImageUpload({ images, onChange, max = 3 }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks every object URL we create so the unmount cleanup can revoke the
  // ones that are still held (a URL is removed from the set as soon as it's
  // revoked, so revokeObjectURL is never called twice for the same URL).
  const objectUrlsRef = useRef<Set<string>>(new Set())
  const { toast } = useToast()
  const configured = isImageKitConfigured()

  const revoke = useCallback((url?: string) => {
    if (!url) return
    if (objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url)
      objectUrlsRef.current.delete(url)
    }
  }, [])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).slice(0, max - images.length)

      // Step 46: validate format + size, reject the rest with a clear reason.
      const rejected: string[] = []
      const accepted = list.filter((file) => {
        if (!isAcceptedImage(file)) {
          rejected.push(`${file.name} — ${file.type ? 'unsupported format' : 'unsupported file type'}`)
          return false
        }
        if (file.size > MAX_IMAGE_FILE_SIZE) {
          rejected.push(`${file.name} — over ${MAX_SIZE_MB} MB`)
          return false
        }
        return true
      })

      if (rejected.length > 0) {
        toast({
          variant: 'error',
          title: 'Some files were skipped',
          description: rejected.join(' · '),
        })
      }
      if (accepted.length === 0) return

      const items: DonationImage[] = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        objectUrlsRef.current.add(previewUrl)
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previewUrl,
          uploading: configured,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || undefined,
        }
      })
      // slice(0, max) guards a rapid double-add race where the render-closure
      // `images.length` can lag behind state and both adds compute the same
      // remaining capacity.
      onChange((prev) => [...prev, ...items].slice(0, max))

      // Without ImageKit keys the photos stay as local previews (demo mode).
      if (!configured) return

      for (const [index, item] of items.entries()) {
        try {
          const result = await uploadImage(accepted[index])
          // Revoke the object URL outside the state updater (StrictMode
          // double-invokes updaters, and revoking inside would break the second
          // call's preview) before swapping to the remote URL.
          revoke(item.previewUrl)
          onChange((prev) =>
            prev.map((img) =>
              img.id === item.id
                ? {
                    ...img,
                    url: result.url,
                    fileId: result.fileId,
                    previewUrl: undefined,
                    uploading: false,
                  }
                : img,
            ),
          )
        } catch (err) {
          onChange((prev) => prev.map((img) => (img.id === item.id ? { ...img, uploading: false } : img)))
          toast({ variant: 'error', title: 'Upload failed', description: (err as Error).message })
        }
      }
    },
    [configured, images.length, max, onChange, revoke, toast],
  )

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  const remove = (id: string) => {
    const target = images.find((img) => img.id === id)
    revoke(target?.previewUrl)
    onChange((prev) => prev.filter((img) => img.id !== id))
  }

  // Clean up any object URLs still held when the component unmounts (e.g. the
  // user navigates away mid-upload).
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
          >
            <img src={image.url ?? image.previewUrl} alt="" className="size-full object-cover" />
            {image.uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                <Loader2 className="size-5 animate-spin text-brand-600" />
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(image.id)}
              aria-label="Remove image"
              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-neutral-600 shadow-sm transition hover:text-red-600"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-brand-400 hover:text-brand-600"
          >
            <ImagePlus className="size-5" />
            <span className="text-xs font-medium">Add photo</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={handleInput} />

      <p className="mt-2 text-xs text-neutral-500">
        JPG, PNG or WEBP · max {MAX_SIZE_MB} MB each
      </p>

      {!configured && (
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          ImageKit isn&apos;t configured yet — photos preview locally and will upload automatically once the keys are
          added.
        </p>
      )}
    </div>
  )
}
