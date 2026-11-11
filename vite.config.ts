import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, extname, posix, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const INBOX_DIR = fileURLToPath(new URL('./res/inbox', import.meta.url))
const FORBIDDEN_CHARS = /[<>:"\\|?*]/u

function isSafeRelPath(relPath: string): boolean {
  if (relPath === '' || relPath.startsWith('/') || relPath.endsWith('/')) return false
  for (let index = 0; index < relPath.length; index += 1) {
    if (relPath.charCodeAt(index) < 32) return false
  }
  if (FORBIDDEN_CHARS.test(relPath)) return false
  const parts = relPath.split('/')
  return parts.length > 0 && parts.every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

function resolveInboxTarget(relPath: string): string | null {
  if (!isSafeRelPath(relPath)) return null
  const target = resolve(INBOX_DIR, ...relPath.split('/'))
  const prefix = INBOX_DIR.endsWith(sep) ? INBOX_DIR : `${INBOX_DIR}${sep}`
  return target.startsWith(prefix) ? target : null
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function respondJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.statusCode = statusCode
  res.end(JSON.stringify(payload))
}

function respondNotFound(res: ServerResponse): void {
  res.statusCode = 404
  res.end('Not found')
}

function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse,
  onParsed: (body: Record<string, unknown>) => void,
): void {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })
  req.on('end', () => {
    try {
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        onParsed(Object.fromEntries(Object.entries(parsed)))
        return
      }
    } catch {
      // fallthrough
    }
    res.statusCode = 400
    res.end('Invalid JSON')
  })
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp'])
const REF_EXTS = new Set(['.pdf', '.html', '.htm'])
const DOC_EXTS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.py',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.sh',
  '.css',
  '.sql',
  '.xml',
  '.csv',
])

function detectExtAndCategory(fileName: string): {
  readonly ext: string
  readonly category: 'slide' | 'image' | 'document' | 'reference' | 'other'
} {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.slide.svg')) return { ext: '.slide.svg', category: 'slide' }
  const ext = extname(lower)
  if (IMAGE_EXTS.has(ext)) return { ext, category: 'image' }
  if (REF_EXTS.has(ext)) return { ext, category: 'reference' }
  if (DOC_EXTS.has(ext)) return { ext, category: 'document' }
  return { ext, category: 'other' }
}

interface ServerInboxEntry {
  readonly path: string
  readonly name: string
  readonly parentPath: string
  readonly kind: 'file' | 'folder'
  readonly size: number
  readonly updatedAt: number
  readonly ext: string
  readonly category: 'slide' | 'image' | 'document' | 'reference' | 'other'
}

function scanInboxDirectory(dirAbs: string, relPrefix: string, out: ServerInboxEntry[]): void {
  const dirStat = statSync(dirAbs, { throwIfNoEntry: false })
  if (dirStat === undefined || !dirStat.isDirectory()) return
  const dirents = readdirSync(dirAbs, { withFileTypes: true })
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue
    const relPath = relPrefix === '' ? dirent.name : `${relPrefix}/${dirent.name}`
    const fullPath = resolve(dirAbs, dirent.name)
    const stat = statSync(fullPath, { throwIfNoEntry: false })
    if (stat === undefined) continue
    if (dirent.isDirectory()) {
      out.push({
        path: relPath,
        name: dirent.name,
        parentPath: relPrefix,
        kind: 'folder',
        size: 0,
        updatedAt: Math.round(stat.mtimeMs),
        ext: '',
        category: 'other',
      })
      scanInboxDirectory(fullPath, relPath, out)
    } else if (dirent.isFile()) {
      const { ext, category } = detectExtAndCategory(dirent.name)
      out.push({
        path: relPath,
        name: dirent.name,
        parentPath: relPrefix,
        kind: 'file',
        size: stat.size,
        updatedAt: Math.round(stat.mtimeMs),
        ext,
        category,
      })
    }
  }
}

function handleInboxTree(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'GET' || !rawUrl.startsWith('/api/res/inbox/tree')) return false
  mkdirSync(INBOX_DIR, { recursive: true })
  const entries: ServerInboxEntry[] = []
  scanInboxDirectory(INBOX_DIR, '', entries)
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
  })
  respondJson(res, 200, { entries })
  return true
}

function splitFileStemAndExt(fileName: string): { readonly stem: string; readonly ext: string } {
  if (fileName.toLowerCase().endsWith('.slide.svg')) {
    return { stem: fileName.slice(0, -'.slide.svg'.length), ext: '.slide.svg' }
  }
  const ext = extname(fileName)
  return ext === ''
    ? { stem: fileName, ext: '' }
    : { stem: fileName.slice(0, -ext.length), ext }
}

function findAvailableRelPath(desiredRelPath: string, overwrite: boolean): string {
  if (overwrite) return desiredRelPath
  const initialTarget = resolveInboxTarget(desiredRelPath)
  if (initialTarget === null) return desiredRelPath
  if (statSync(initialTarget, { throwIfNoEntry: false }) === undefined) return desiredRelPath

  const dir = posix.dirname(desiredRelPath)
  const base = posix.basename(desiredRelPath)
  const { stem, ext } = splitFileStemAndExt(base)
  for (let i = 1; i < 1000; i += 1) {
    const candidateName = `${stem} (${i})${ext}`
    const candidateRel = dir === '.' ? candidateName : `${dir}/${candidateName}`
    const target = resolveInboxTarget(candidateRel)
    if (target !== null && statSync(target, { throwIfNoEntry: false }) === undefined) {
      return candidateRel
    }
  }
  return desiredRelPath
}

function encodeInboxUrl(relPath: string): string {
  const encoded = relPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `/res/inbox/${encoded}`
}

function handleInboxUpload(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  const parsedUrl = new URL(rawUrl, 'http://localhost')
  if (req.method !== 'POST' || parsedUrl.pathname !== '/api/res/inbox') return false
  const rawRelPath = parsedUrl.searchParams.get('path') ?? parsedUrl.searchParams.get('name') ?? ''
  const overwrite = parsedUrl.searchParams.get('overwrite') === '1'
  const finalRelPath = findAvailableRelPath(rawRelPath, overwrite)
  const targetAbs = resolveInboxTarget(finalRelPath)
  if (targetAbs === null) {
    res.statusCode = 400
    res.end('Invalid inbox file path')
    return true
  }

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })
  req.on('end', () => {
    mkdirSync(dirname(targetAbs), { recursive: true })
    writeFileSync(targetAbs, Buffer.concat(chunks))
    respondJson(res, 200, {
      src: encodeInboxUrl(finalRelPath),
      path: `res/inbox/${finalRelPath}`,
      relPath: finalRelPath,
    })
  })
  return true
}

function handleInboxMkdir(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'POST' || rawUrl !== '/api/res/inbox/mkdir') return false
  readJsonBody(req, res, (body) => {
    const rawPath = typeof body.path === 'string' ? body.path.trim() : ''
    const finalRelPath = findAvailableRelPath(rawPath, false)
    const targetAbs = resolveInboxTarget(finalRelPath)
    if (targetAbs === null) {
      res.statusCode = 400
      res.end('Invalid folder path')
      return
    }
    mkdirSync(targetAbs, { recursive: true })
    respondJson(res, 200, { ok: true, path: finalRelPath })
  })
  return true
}

function handleInboxMove(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'POST' || rawUrl !== '/api/res/inbox/move') return false
  readJsonBody(req, res, (body) => {
    const fromPath = typeof body.fromPath === 'string' ? body.fromPath.trim() : ''
    const toPath = typeof body.toPath === 'string' ? body.toPath.trim() : ''
    const fromAbs = resolveInboxTarget(fromPath)
    const toAbs = resolveInboxTarget(toPath)
    if (fromAbs === null || toAbs === null) {
      res.statusCode = 400
      res.end('Invalid move paths')
      return
    }
    if (statSync(fromAbs, { throwIfNoEntry: false }) === undefined) {
      respondNotFound(res)
      return
    }
    if (fromPath !== toPath) {
      mkdirSync(dirname(toAbs), { recursive: true })
      renameSync(fromAbs, toAbs)
    }
    respondJson(res, 200, { ok: true, fromPath, toPath })
  })
  return true
}

function handleInboxDelete(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'POST' || rawUrl !== '/api/res/inbox/delete') return false
  readJsonBody(req, res, (body) => {
    const paths = Array.isArray(body.paths) ? body.paths : []
    let deletedCount = 0
    for (const item of paths) {
      if (typeof item !== 'string') continue
      const targetAbs = resolveInboxTarget(item)
      if (targetAbs === null) continue
      if (statSync(targetAbs, { throwIfNoEntry: false }) !== undefined) {
        rmSync(targetAbs, { recursive: true, force: true })
        deletedCount += 1
      }
    }
    respondJson(res, 200, { ok: true, deletedCount })
  })
  return true
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.markdown': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.js': 'text/plain; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.css': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8',
}

function handleInboxServe(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !rawUrl.startsWith('/res/inbox/')) {
    return false
  }
  const parsedUrl = new URL(rawUrl, 'http://localhost')
  const rawSlice = parsedUrl.pathname.slice('/res/inbox/'.length)
  const decodedSegments = rawSlice.split('/').map((seg) => safeDecode(seg))
  if (decodedSegments.some((seg) => seg === null)) {
    respondNotFound(res)
    return true
  }
  const relPath = decodedSegments.join('/')
  const filePath = resolveInboxTarget(relPath)
  if (filePath === null) {
    respondNotFound(res)
    return true
  }
  const stat = statSync(filePath, { throwIfNoEntry: false })
  if (stat === undefined || !stat.isFile()) {
    respondNotFound(res)
    return true
  }

  const ext = extname(relPath).toLowerCase()
  res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
  const isMutableAsset = relPath.toLowerCase().endsWith('.slide.svg') || DOC_EXTS.has(ext)
  res.setHeader(
    'Cache-Control',
    isMutableAsset ? 'no-cache' : 'public, max-age=31536000, immutable',
  )
  res.statusCode = 200
  res.end(readFileSync(filePath))
  return true
}

const PROJECT_FILE = fileURLToPath(new URL('./project.json', import.meta.url))
const PROJECT_TMP_FILE = fileURLToPath(new URL('./project.json.tmp', import.meta.url))
const PROJECT_BACKUP_FILE = fileURLToPath(new URL('./project.json.bak', import.meta.url))
const MAX_PROJECT_BYTES = 8 * 1024 * 1024

function handleProjectRead(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'GET' || (rawUrl !== '/api/project' && rawUrl !== '/api/project/backup')) {
    return false
  }
  const targetFile = rawUrl === '/api/project/backup' ? PROJECT_BACKUP_FILE : PROJECT_FILE
  const stat = statSync(targetFile, { throwIfNoEntry: false })
  if (stat === undefined || !stat.isFile()) {
    respondNotFound(res)
    return true
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.statusCode = 200
  res.end(readFileSync(targetFile))
  return true
}

function storeProjectFile(text: string): void {
  mkdirSync(dirname(PROJECT_FILE), { recursive: true })
  writeFileSync(PROJECT_TMP_FILE, text)
  if (statSync(PROJECT_FILE, { throwIfNoEntry: false })?.isFile() === true) {
    copyFileSync(PROJECT_FILE, PROJECT_BACKUP_FILE)
  }
  renameSync(PROJECT_TMP_FILE, PROJECT_FILE)
}

function handleProjectWrite(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'PUT' || rawUrl !== '/api/project') return false
  const chunks: Buffer[] = []
  let size = 0
  let rejected = false
  req.on('data', (chunk: Buffer) => {
    if (rejected) return
    size += chunk.length
    if (size > MAX_PROJECT_BYTES) {
      rejected = true
      res.statusCode = 413
      res.end('Project too large')
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => {
    if (rejected) return
    const text = Buffer.concat(chunks).toString('utf8')
    try {
      JSON.parse(text)
    } catch {
      res.statusCode = 400
      res.end('Invalid JSON')
      return
    }
    storeProjectFile(text)
    respondJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
  })
  return true
}

function paperloomStoragePlugin(): Plugin {
  return {
    name: 'paperloom-storage',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? ''
        if (handleInboxTree(req, res, rawUrl)) return
        if (handleInboxMkdir(req, res, rawUrl)) return
        if (handleInboxMove(req, res, rawUrl)) return
        if (handleInboxDelete(req, res, rawUrl)) return
        if (handleInboxUpload(req, res, rawUrl)) return
        if (handleInboxServe(req, res, rawUrl)) return
        if (handleProjectRead(req, res, rawUrl)) return
        if (handleProjectWrite(req, res, rawUrl)) return
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), paperloomStoragePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    watch: {
      ignored: ['**/project.json', '**/project.json.tmp', '**/project.json.bak', '**/res/inbox/**'],
    },
  },
})
