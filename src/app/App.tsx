import { Editor, EditorToolbar, useEditor, useProjectPersistence } from '@/features/editor'
import { ProjectPackageControls } from '@/features/exporter'

interface EditorSectionProps {
  readonly editor: ReturnType<typeof useEditor>
}

function BrandMark() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 pr-1 select-none">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
        <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
          <circle cx="5" cy="10" r="2.25" fill="currentColor" />
          <circle cx="15" cy="5.5" r="2.25" fill="currentColor" />
          <circle cx="15" cy="14.5" r="2.25" fill="currentColor" />
          <path
            d="M7.25 10C10.2 10 10.2 5.5 12.75 5.5M7.25 10C10.2 10 10.2 14.5 12.75 14.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-sm font-bold tracking-tight text-slate-900">PaperLoom</span>
    </div>
  )
}

function AppHeader({ editor }: Readonly<EditorSectionProps>) {
  return (
    <header className="z-10 flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.03)] backdrop-blur-md">
      <BrandMark />
      <span className="hidden h-5 w-px bg-slate-200/80 sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <EditorToolbar
          selectedNode={editor.selectedNode}
          defaults={editor.activeDocument.defaults}
          rootCount={editor.activeDocument.rootIds.length}
          activeCanvasId={editor.activeCanvasId}
          activeHostNodeId={editor.activeHostNodeId}
          onAddRoot={editor.addRoot}
          onUpdateDefaults={editor.updateDefaults}
          onAddChild={editor.addChild}
          onAddSibling={editor.addSibling}
          onDeleteNode={editor.deleteNode}
          onChangeNodeKind={editor.changeKind}
          onUpdateNodeTitle={editor.updateTitle}
          onUpdateNodeImage={editor.updateImage}
          onUpdateNodeFile={editor.updateFile}
          onUpdateLayout={editor.updateLayout}
          onUpdateNodeEvents={editor.updateEvents}
          onEnterSubCanvas={editor.enterSubCanvas}
          onEditNodeText={editor.startEditing}
        />
      </div>
      <div className="w-48 shrink-0">
        <ProjectPackageControls
          document={editor.document}
          onRestoreDocument={editor.replaceDocument}
        />
      </div>
    </header>
  )
}

function EditorWorkspace({ editor }: Readonly<EditorSectionProps>) {
  return (
    <main className="relative min-h-0 flex-1">
      <Editor
        document={editor.activeDocument}
        activeCanvasId={editor.activeCanvasId}
        activeHostNodeId={editor.activeHostNodeId}
        breadcrumbs={editor.breadcrumbs}
        selectedNodeId={editor.selectedNode?.id ?? null}
        editingNodeId={editor.editingNodeId}
        expandedMediaNodeId={editor.expandedMediaNodeId}
        detailMediaNodeId={editor.detailMediaNodeId}
        detailReference={editor.detailReference}
        onSelectNode={editor.selectNode}
        onStartEditing={editor.startEditing}
        onStopEditing={editor.stopEditing}
        onUpdateContent={editor.updateContent}
        onFitNodeSize={editor.updateLayout}
        onAddImage={editor.addImage}
        onTriggerEvent={editor.triggerNodeEvent}
        onNavigateCanvas={editor.navigateToCanvas}
        onPopSubCanvas={editor.popSubCanvas}
        onOpenMediaDetail={editor.openMediaDetail}
        onOpenReferenceDetail={editor.openReferenceDetail}
        onCollapseDetail={editor.collapseDetail}
        onCollapseExpandedMedia={editor.collapseExpandedMedia}
        onMoveRoot={editor.moveRoot}
        onReparentNode={editor.reparentNode}
        onDetachAsRoot={editor.detachAsRoot}
      />
    </main>
  )
}

export function App() {
  const editor = useEditor()
  useProjectPersistence(editor.document, editor.replaceDocument)

  return (
    <div className="fixed inset-0 flex flex-col">
      <AppHeader editor={editor} />
      <EditorWorkspace editor={editor} />
    </div>
  )
}
