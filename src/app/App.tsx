import { Editor, EditorToolbar, useEditor } from '@/features/editor'
import { ExportButton } from '@/features/exporter'

interface EditorSectionProps {
  readonly editor: ReturnType<typeof useEditor>
}

function AppHeader({ editor }: Readonly<EditorSectionProps>) {
  return (
    <header className="z-10 flex shrink-0 items-start gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <EditorToolbar
          selectedNode={editor.selectedNode}
          defaults={editor.document.defaults}
          rootCount={editor.document.rootIds.length}
          onAddRoot={editor.addRoot}
          onUpdateDefaults={editor.updateDefaults}
          onAddChild={editor.addChild}
          onAddSibling={editor.addSibling}
          onDeleteNode={editor.deleteNode}
          onUpdateLayout={editor.updateLayout}
        />
      </div>
      <div className="w-44 shrink-0">
        <ExportButton document={editor.document} />
      </div>
    </header>
  )
}

function EditorWorkspace({ editor }: Readonly<EditorSectionProps>) {
  return (
    <main className="relative min-h-0 flex-1">
      <Editor
        document={editor.document}
        selectedNodeId={editor.selectedNode?.id ?? null}
        editingNodeId={editor.editingNodeId}
        expandedMediaNodeId={editor.expandedMediaNodeId}
        detailMediaNodeId={editor.detailMediaNodeId}
        detailReference={editor.detailReference}
        onSelectNode={editor.selectNode}
        onStartEditing={editor.startEditing}
        onStopEditing={editor.stopEditing}
        onUpdateContent={editor.updateContent}
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

  return (
    <div className="fixed inset-0 flex flex-col">
      <AppHeader editor={editor} />
      <EditorWorkspace editor={editor} />
    </div>
  )
}
