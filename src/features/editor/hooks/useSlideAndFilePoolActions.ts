import { useCallback, useState } from 'react'

import { buildInboxUrl } from '@/shared/lib/inbox'
import type { InboxEntry } from '@/shared/lib/inbox'
import { rewriteDocumentInboxPaths } from '@/shared/lib/inboxReferences'
import type { NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'
import type { SlideDocumentSpec } from '@/shared/types/slide'
import type { SlideComposerTarget } from '../components/SlideComposerModal'
import { createInitialDocument } from '../data/document'
import type { DetailContent } from '../lib/detailContent'
import { computeIdealSlideBox } from '../lib/fitNodeSize'
import { fetchInboxTextContent } from '../lib/inboxClient'
import { detectStaticFileFormat } from '../lib/staticMarkdown'
import { useFilePool } from './useFilePool'
import type { NodeMutations } from './useNodeMutations'

interface SlideAndFilePoolOptions {
  readonly document: PaperDocument
  readonly activeNodes: readonly PaperNode[]
  readonly selectedNode: PaperNode | undefined
  readonly nodeMutations: NodeMutations
  readonly replaceDocument: (next: PaperDocument) => void
}

function insertSavedSlideIntoCanvas(
  relPath: string,
  src: string,
  spec: SlideDocumentSpec,
  targetImageNodeId: NodeId | null,
  selectedNode: PaperNode | undefined,
  activeNodes: readonly PaperNode[],
  nodeMutations: NodeMutations,
): void {
  const fileName = relPath.slice(relPath.lastIndexOf('/') + 1)
  const slideItem = {
    src,
    alt: fileName,
    naturalWidth: spec.width,
    naturalHeight: spec.height,
  }
  const targetNode =
    targetImageNodeId === null
      ? selectedNode
      : activeNodes.find((n) => n.id === targetImageNodeId)

  if (targetNode?.content.kind === 'image') {
    nodeMutations.addImagePages(targetNode.id, [slideItem])
    return
  }

  const box = computeIdealSlideBox(spec.width, spec.height)
  nodeMutations.addImage(
    {
      kind: 'image',
      src,
      alt: fileName,
      items: [slideItem],
      activeIndex: 0,
    },
    {
      ...(selectedNode === undefined ? {} : { parentId: selectedNode.id }),
      size: box,
    },
  )
}

export function useSlideAndFilePoolActions({
  document,
  activeNodes,
  selectedNode,
  nodeMutations,
  replaceDocument,
}: Readonly<SlideAndFilePoolOptions>) {
  const filePool = useFilePool(document, replaceDocument)
  const [slideComposerTarget, setSlideComposerTarget] = useState<SlideComposerTarget | null>(null)
  const [targetImageNodeForSlide, setTargetImageNodeForSlide] = useState<NodeId | null>(null)

  const openNewSlideComposer = useCallback(
    (folderPath = filePool.currentFolder, forImageNodeId: NodeId | null = null) => {
      setTargetImageNodeForSlide(forImageNodeId)
      setSlideComposerTarget({ existingRelPath: null, folderPath })
    },
    [filePool.currentFolder],
  )

  const openEditSlideComposer = useCallback((relPath: string) => {
    const slash = relPath.lastIndexOf('/')
    const folderPath = slash === -1 ? '' : relPath.slice(0, slash)
    setTargetImageNodeForSlide(null)
    setSlideComposerTarget({ existingRelPath: relPath, folderPath })
  }, [])

  const closeSlideComposer = useCallback(() => {
    setSlideComposerTarget(null)
    setTargetImageNodeForSlide(null)
  }, [])

  const handleSavedSlide = useCallback(
    (relPath: string, src: string, spec: SlideDocumentSpec, insertToCanvas: boolean) => {
      const refreshedDoc = rewriteDocumentInboxPaths(document, relPath, relPath, Date.now())
      if (refreshedDoc !== document) replaceDocument(refreshedDoc)
      void filePool.refresh()
      if (!insertToCanvas && targetImageNodeForSlide === null) return
      insertSavedSlideIntoCanvas(
        relPath,
        src,
        spec,
        targetImageNodeForSlide,
        selectedNode,
        activeNodes,
        nodeMutations,
      )
    },
    [document, replaceDocument, filePool, targetImageNodeForSlide, selectedNode, activeNodes, nodeMutations],
  )

  const previewInboxEntry = useCallback(
    (entry: InboxEntry, openCustomDetail: (content: DetailContent) => void) => {
      const src = buildInboxUrl(entry.path, entry.updatedAt)
      if (entry.category === 'image' || entry.category === 'slide') {
        openCustomDetail({ type: 'image', src, alt: entry.name })
        return
      }
      if (entry.category === 'reference') {
        if (entry.ext === '.pdf') {
          openCustomDetail({ type: 'pdf', src, page: 1, label: entry.name })
        } else {
          openCustomDetail({ type: 'page', src, label: entry.name })
        }
        return
      }
      void fetchInboxTextContent(entry.path).then((text) => {
        const format = detectStaticFileFormat(entry.name)
        openCustomDetail({ type: 'file', fileName: entry.name, format, text })
      })
    },
    [],
  )

  const resetBlankProject = useCallback(() => {
    replaceDocument(createInitialDocument())
  }, [replaceDocument])

  return {
    filePool,
    slideComposerTarget,
    openNewSlideComposer,
    openEditSlideComposer,
    closeSlideComposer,
    handleSavedSlide,
    previewInboxEntry,
    resetBlankProject,
  }
}
