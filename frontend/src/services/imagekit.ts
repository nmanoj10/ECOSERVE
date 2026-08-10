import { api } from '@/api/client'

// Public credentials only — the private key lives on the backend, which signs
// each upload request via POST /v1/uploads/imagekit-auth.
const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY
const urlEndpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT

// ── Image validation (Step 46) ────────────────────────────────────────────
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5 MB per photo
export const ACCEPTED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const ACCEPTED_IMAGE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp']

export function isImageKitConfigured() {
  return Boolean(publicKey && urlEndpoint)
}

interface UploadAuth {
  configured: boolean
  token: string
  expire: number
  signature: string
  message?: string
}

/** Asks the backend to mint short-lived upload credentials (it holds the private key). */
async function getUploadAuth(): Promise<UploadAuth> {
  const { data } = await api.post<UploadAuth>('/v1/uploads/imagekit-auth')
  return data
}

/** What the ImageKit upload API returns; the backend stores this metadata (Step 45). */
export interface UploadResult {
  url: string
  fileId: string
  name: string
  filePath: string
  size: number
  fileType: string
}

/**
 * Uploads an image directly to ImageKit from the browser and returns the
 * remote URL + file id. Requires VITE_IMAGEKIT_PUBLIC_KEY +
 * VITE_IMAGEKIT_URL_ENDPOINT on the client and IMAGEKIT_PRIVATE_KEY on the
 * backend.
 */
export async function uploadImage(file: File, folder = 'donations'): Promise<UploadResult> {
  if (!isImageKitConfigured()) {
    throw new Error('ImageKit is not configured on the client')
  }

  const auth = await getUploadAuth()
  if (!auth.configured) {
    throw new Error(auth.message ?? 'ImageKit is not configured')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('fileName', file.name)
  form.append('folder', folder)
  form.append('useUniqueFileName', 'true')
  form.append('publicKey', publicKey)
  form.append('token', auth.token)
  form.append('expire', String(auth.expire))
  form.append('signature', auth.signature)

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `Upload failed (${res.status})`)
  }

  return (await res.json()) as UploadResult
}
