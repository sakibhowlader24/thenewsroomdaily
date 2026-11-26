// Browser-side cover image compression + upload (Phase 2).
// No library: the Canvas API resizes so the longest side is at most 1600px
// (aspect ratio kept) and re-encodes to WebP quality 0.8, falling back to
// JPEG when the browser cannot write WebP. Re-encoding through a canvas
// strips EXIF data automatically.
import { supabase } from './supabase'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface CompressedImage {
  blob: Blob
  fileName: string
  mimeType: string
  originalSize: number
  compressedSize: number
  width: number
  height: number
}

export async function compressImage(file: File, maxSide = 1600): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  const mimeType = webpSupported ? 'image/webp' : 'image/jpeg'
  const ext = webpSupported ? 'webp' : 'jpg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.8))
  if (!blob) throw new Error('Could not compress this image.')
  const base =
    file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-') || 'cover'
  return { blob, fileName: `${base}.${ext}`, mimeType, originalSize: file.size, compressedSize: blob.size, width, height }
}

export interface UploadedCover {
  publicUrl: string
  fileName: string
  originalSize: number
  compressedSize: number
}

// Compresses in the browser first, then uploads the compressed file to the
// public "covers" Storage bucket and returns its public URL.
export async function uploadCoverImage(file: File, slug: string): Promise<UploadedCover> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const compressed = await compressImage(file)
  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'cover'
  const path = `${safeSlug}-${Date.now()}.${compressed.fileName.split('.').pop()}`
  const { error } = await supabase.storage
    .from('covers')
    .upload(path, compressed.blob, { contentType: compressed.mimeType, upsert: false })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  return {
    publicUrl: data.publicUrl,
    fileName: compressed.fileName,
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
  }
}
