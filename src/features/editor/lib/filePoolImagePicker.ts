import type { InboxEntry } from '@/shared/lib/inbox'

export function isFilePoolImageEntry(entry: InboxEntry): boolean {
  return entry.kind === 'file' && (entry.category === 'image' || entry.category === 'slide')
}

export function isFilePoolImageSelectableEntry(entry: InboxEntry): boolean {
  return entry.kind === 'folder' || isFilePoolImageEntry(entry)
}

function compareEntries(left: InboxEntry, right: InboxEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === 'folder' ? -1 : 1
  }
  return left.name.localeCompare(right.name, 'zh-CN', { numeric: true })
}

export function filterVisibleImagePoolEntries(
  entries: readonly InboxEntry[],
  currentFolder: string,
  searchQuery: string,
): readonly InboxEntry[] {
  const selectable = entries.filter(isFilePoolImageSelectableEntry)
  const query = searchQuery.trim().toLowerCase()
  if (query !== '') {
    return selectable
      .filter((entry) => entry.kind === 'file' && entry.name.toLowerCase().includes(query))
      .sort(compareEntries)
  }
  return selectable
    .filter((entry) => entry.parentPath === currentFolder)
    .sort(compareEntries)
}

export function toggleImageSelection(
  selectedPaths: readonly string[],
  path: string,
): readonly string[] {
  if (selectedPaths.includes(path)) {
    return selectedPaths.filter((item) => item !== path)
  }
  return [...selectedPaths, path]
}

export function resolveSelectedImageEntries(
  entries: readonly InboxEntry[],
  selectedPaths: readonly string[],
): readonly InboxEntry[] {
  const byPath = new Map<string, InboxEntry>()
  for (const entry of entries) {
    if (isFilePoolImageEntry(entry)) {
      byPath.set(entry.path, entry)
    }
  }
  const result: InboxEntry[] = []
  for (const path of selectedPaths) {
    const matched = byPath.get(path)
    if (matched !== undefined) {
      result.push(matched)
    }
  }
  return result
}
