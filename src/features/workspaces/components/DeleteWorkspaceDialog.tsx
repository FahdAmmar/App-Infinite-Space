import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { WorkspaceMeta } from '../types/workspace'

interface DeleteWorkspaceDialogProps {
  workspace: WorkspaceMeta | null
  onCancel: () => void
  onConfirm: (workspace: WorkspaceMeta) => void
}

export function DeleteWorkspaceDialog({ workspace, onCancel, onConfirm }: DeleteWorkspaceDialogProps) {
  return (
    <Dialog
      open={workspace !== null}
      onClose={onCancel}
      title="Delete this workspace?"
      description="Everything on its canvas will be permanently removed from this browser. This can't be undone."
    >
      {workspace && (
        <>
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium">
            <bdi>{workspace.name}</bdi>
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {/* التركيز الأولي على "Cancel" لأن الحذف لا رجعة فيه */}
            <Button variant="secondary" onClick={onCancel} data-autofocus>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onConfirm(workspace)}>
              Delete workspace
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
