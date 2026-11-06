import { Editor, EditorToolbar, useEditor } from '@/features/editor'
import { ExportButton } from '@/features/exporter'

export function App() {
  const {
    document,
    selectedNode,
    editingNodeId,
    selectNode,
    startEditing,
    stopEditing,
    addChild,
    addSibling,
    deleteNode,
    updateContent,
    updateLayout,
  } = useEditor()

  return (
    <div className="fixed inset-0 flex flex-col">
      <header className="z-10 flex shrink-0 items-start gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <EditorToolbar
            selectedNode={selectedNode}
            onAddChild={addChild}
            onAddSibling={addSibling}
            onDeleteNode={deleteNode}
            onUpdateLayout={updateLayout}
          />
        </div>
        <div className="w-44 shrink-0">
          <ExportButton document={document} />
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <Editor
          document={document}
          selectedNodeId={selectedNode?.id ?? null}
          editingNodeId={editingNodeId}
          onSelectNode={selectNode}
          onStartEditing={startEditing}
          onStopEditing={stopEditing}
          onUpdateContent={updateContent}
        />
      </main>
    </div>
  )
}
