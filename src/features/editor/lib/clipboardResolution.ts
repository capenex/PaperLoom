import type { NodeClipboardPayload } from '../data/nodeClipboard'

export const NODE_CLIPBOARD_MIME = 'application/x-paperloom-node'

export interface NodeClipboardSession {
  readonly token: string
  readonly viaCopyEvent: boolean
  readonly payload: NodeClipboardPayload
}

export type CanvasPasteIntent = 'node' | 'image' | 'none'

export interface ClipboardDataLike {
  readonly types: readonly string[]
  readonly files?: { readonly length: number } | undefined
  getData: (format: string) => string
}

export function hasNodeClipboardMime(clipboardData: ClipboardDataLike | null): boolean {
  if (clipboardData === null) return false
  return clipboardData.types.includes(NODE_CLIPBOARD_MIME)
}

export function hasMatchingNodeClipboardToken(
  clipboardData: ClipboardDataLike | null,
  session: NodeClipboardSession | null,
): boolean {
  if (session === null || clipboardData === null) return false
  return clipboardData.getData(NODE_CLIPBOARD_MIME) === session.token
}

export function hasNonEmptyExternalText(clipboardData: ClipboardDataLike | null): boolean {
  if (clipboardData === null) return false
  return (
    clipboardData.getData('text/plain').trim() !== '' ||
    clipboardData.getData('text/html').trim() !== ''
  )
}

export function resolveCanvasPasteIntent(
  clipboardData: ClipboardDataLike | null,
  session: NodeClipboardSession | null,
  hasImageFile: boolean,
  hasOtherFiles: boolean,
): CanvasPasteIntent {
  if (hasMatchingNodeClipboardToken(clipboardData, session)) {
    return 'node'
  }
  if (hasImageFile) {
    return 'image'
  }
  if (hasOtherFiles) {
    return 'none'
  }
  if (session !== null) {
    if (session.viaCopyEvent && hasNonEmptyExternalText(clipboardData)) {
      return 'none'
    }
    return 'node'
  }
  return 'none'
}