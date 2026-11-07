import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { createProjectFile } from '@/shared/lib/projectFile'
import type { PaperDocument } from '@/shared/types/paper'
import {
  findMissingResources,
  loadProjectFile,
  saveProjectFile,
  saveProjectFileOnExit,
} from '../lib/projectStorage'

const SAVE_DEBOUNCE_MS = 1000

async function reportMissingResources(document: PaperDocument): Promise<void> {
  const missing = await findMissingResources(document)
  if (missing.length === 0) return
  window.alert(`有 ${missing.length} 个资源找不到，res 文件夹可能不完整：\n${missing.join('\n')}`)
}

/** 启动时载入工程文件；只有载入成功或确认没有工程文件时才允许自动保存 */
function useProjectLoading(
  onLoadedRef: RefObject<(paper: PaperDocument) => void>,
  readyRef: RefObject<boolean>,
  lastSavedRef: RefObject<string | null>,
): void {
  useEffect(() => {
    let cancelled = false
    void loadProjectFile().then((result) => {
      if (cancelled) return
      if (result.status === 'loaded') {
        lastSavedRef.current = JSON.stringify(result.project.document)
        readyRef.current = true
        onLoadedRef.current(result.project.document)
        void reportMissingResources(result.project.document)
        return
      }
      if (result.status === 'missing') {
        readyRef.current = true
        return
      }
      // 载入失败时不进入自动保存，避免把损坏的存档覆盖掉
      window.alert(`工程文件载入失败：${result.reason}`)
    })
    return () => {
      cancelled = true
    }
  }, [onLoadedRef, readyRef, lastSavedRef])
}

/** 文档变更后防抖落盘；序列化比对跳过无变化的写盘 */
function useProjectSaving(
  paper: PaperDocument,
  paperRef: RefObject<PaperDocument>,
  readyRef: RefObject<boolean>,
  lastSavedRef: RefObject<string | null>,
): void {
  useEffect(() => {
    paperRef.current = paper
    if (!readyRef.current) return undefined
    const text = JSON.stringify(paper)
    if (text === lastSavedRef.current) return undefined

    const timer = setTimeout(() => {
      const project = createProjectFile(paperRef.current)
      void saveProjectFile(project).then((ok) => {
        if (ok) lastSavedRef.current = JSON.stringify(project.document)
      })
    }, SAVE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [paper, paperRef, readyRef, lastSavedRef])
}

/** 页面关闭或切到后台时冲掉防抖窗口里没发出去的改动 */
function useProjectFlush(
  paperRef: RefObject<PaperDocument>,
  readyRef: RefObject<boolean>,
  lastSavedRef: RefObject<string | null>,
): void {
  useEffect(() => {
    const flush = (): void => {
      if (!readyRef.current) return
      const project = createProjectFile(paperRef.current)
      if (JSON.stringify(project.document) === lastSavedRef.current) return
      saveProjectFileOnExit(project)
    }
    const flushWhenHidden = (): void => {
      if (window.document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    window.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [paperRef, readyRef, lastSavedRef])
}

/**
 * 工程文件自动保存：启动时载入，文档变更后防抖落盘，页面关闭时冲掉未保存的改动。
 * 粘贴/拖入画布的图片仍然由收件箱接口立即写入 res/inbox，这里只保存文档里的链接。
 */
export function useProjectPersistence(
  paper: PaperDocument,
  onLoaded: (paper: PaperDocument) => void,
): void {
  const paperRef = useRef(paper)
  const onLoadedRef = useRef(onLoaded)
  const readyRef = useRef(false)
  const lastSavedRef = useRef<string | null>(null)

  useProjectLoading(onLoadedRef, readyRef, lastSavedRef)
  useProjectSaving(paper, paperRef, readyRef, lastSavedRef)
  useProjectFlush(paperRef, readyRef, lastSavedRef)
}
