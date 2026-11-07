import { copyFileSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const INBOX_DIR = fileURLToPath(new URL('./res/inbox', import.meta.url));
const SAFE_FILE_NAME = /^[0-9A-Za-z._-]+$/u;

function isSafeFileName(fileName: string): boolean {
  return SAFE_FILE_NAME.test(fileName) && fileName !== '.' && fileName !== '..';
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function respondNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end('Not found');
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
};

function handleInboxUpload(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'POST' || !rawUrl.startsWith('/api/res/inbox')) return false;
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const fileName = parsedUrl.searchParams.get('name') ?? '';
  if (!isSafeFileName(fileName)) {
    res.statusCode = 400;
    res.end('Invalid inbox file name');
    return true;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on('end', () => {
    mkdirSync(INBOX_DIR, { recursive: true });
    writeFileSync(resolve(INBOX_DIR, fileName), Buffer.concat(chunks));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.end(JSON.stringify({ src: `/res/inbox/${fileName}`, path: `res/inbox/${fileName}` }));
  });
  return true;
}

function handleInboxServe(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !rawUrl.startsWith('/res/inbox/')) {
    return false;
  }
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const fileName = safeDecode(parsedUrl.pathname.slice('/res/inbox/'.length));
  // 收件箱命名空间归本中间件独占：文件缺失必须 404，
  // 否则请求落到 SPA fallback，会把 index.html 当成图片返回 200
  if (fileName === null || !isSafeFileName(fileName)) {
    respondNotFound(res);
    return true;
  }

  const filePath = resolve(INBOX_DIR, fileName);
  const stat = statSync(filePath, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) {
    respondNotFound(res);
    return true;
  }

  const ext = extname(fileName).toLowerCase();
  res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.statusCode = 200;
  res.end(readFileSync(filePath));
  return true;
}

const PROJECT_FILE = fileURLToPath(new URL('./project.json', import.meta.url));
const PROJECT_TMP_FILE = fileURLToPath(new URL('./project.json.tmp', import.meta.url));
const PROJECT_BACKUP_FILE = fileURLToPath(new URL('./project.json.bak', import.meta.url));
const MAX_PROJECT_BYTES = 8 * 1024 * 1024;

function handleProjectRead(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'GET' || rawUrl !== '/api/project') return false;
  const stat = statSync(PROJECT_FILE, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) {
    respondNotFound(res);
    return true;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // 工程文件必须每次拿最新内容，否则自动保存会读到上一次的快照
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(readFileSync(PROJECT_FILE));
  return true;
}

/** 先写临时文件再 rename：自动保存高频写盘，绝不能留下写到一半的 JSON */
function storeProjectFile(text: string): void {
  mkdirSync(dirname(PROJECT_FILE), { recursive: true });
  writeFileSync(PROJECT_TMP_FILE, text);
  if (statSync(PROJECT_FILE, { throwIfNoEntry: false })?.isFile() === true) {
    copyFileSync(PROJECT_FILE, PROJECT_BACKUP_FILE);
  }
  renameSync(PROJECT_TMP_FILE, PROJECT_FILE);
}

function handleProjectWrite(req: IncomingMessage, res: ServerResponse, rawUrl: string): boolean {
  if (req.method !== 'PUT' || rawUrl !== '/api/project') return false;
  const chunks: Buffer[] = [];
  let size = 0;
  let rejected = false;
  req.on('data', (chunk: Buffer) => {
    if (rejected) return;
    size += chunk.length;
    if (size > MAX_PROJECT_BYTES) {
      rejected = true;
      res.statusCode = 413;
      res.end('Project too large');
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (rejected) return;
    const text = Buffer.concat(chunks).toString('utf8');
    // 只做传输层校验：节点结构等业务规则由 shared/lib/projectFile 在客户端负责
    try {
      JSON.parse(text);
    } catch {
      res.statusCode = 400;
      res.end('Invalid JSON');
      return;
    }
    storeProjectFile(text);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
  });
  return true;
}

function paperloomStoragePlugin(): Plugin {
  return {
    name: 'paperloom-storage',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? '';
        if (handleInboxUpload(req, res, rawUrl)) return;
        if (handleInboxServe(req, res, rawUrl)) return;
        if (handleProjectRead(req, res, rawUrl)) return;
        if (handleProjectWrite(req, res, rawUrl)) return;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), paperloomStoragePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 收件箱接口能往 res/inbox 写文件，默认只监听本机；需要局域网访问再改回 0.0.0.0
    host: 'localhost',
    port: 3000,
    watch: {
      // 工程文件由 /api/project 自己写盘，不能让 Vite 监听到后触发整页重载
      ignored: ['**/project.json', '**/project.json.tmp', '**/project.json.bak'],
    },
  },
});
