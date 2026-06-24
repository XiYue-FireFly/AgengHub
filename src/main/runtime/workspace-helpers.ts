import { getWorkspaceManager, WorkspaceNotFoundError } from '../hub/workspace'

export function optionalWorkbenchWorkspace(workspaceId?: string | null): string | null {
  const id = workspaceId === undefined ? getWorkspaceManager().getActive() : workspaceId
  if (!id) return null
  if (!getWorkspaceManager().getById(id)) throw new WorkspaceNotFoundError(id)
  return id
}
