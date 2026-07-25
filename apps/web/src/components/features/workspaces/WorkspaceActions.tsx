import { WorkspaceFields } from '@hooks/useWorkspaces'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@components/ui/dropdown-menu'
import { Button } from '@components/ui/button'
import { EllipsisVertical } from 'lucide-react'
import WorkspaceSettingsButton from '@components/features/workspaces/WorkspaceSettingsButton'
import LeaveWorkspaceButton from '@components/features/workspaces/LeaveWorkspaceButton'
import JoinWorkspaceButton from '@components/features/workspaces/JoinWorkspaceButton'

type Props = {
    workspace: WorkspaceFields
    /** When set, "Manage" invokes this instead of routing (settings-dialog context). */
    onManage?: (workspaceID: string) => void
}

const WorkspaceActions = ({ workspace, onManage }: Props) => {
    return (
        <div className='flex items-center gap-2 justify-center h-full'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='sm' isIconButton>
                        <EllipsisVertical fontSize={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='min-w-36'>
                    {workspace.is_admin ? <WorkspaceSettingsButton workspace={workspace} onManage={onManage ? () => onManage(workspace.name) : undefined} /> : null}
                    {workspace.workspace_member_name ? <LeaveWorkspaceButton workspace={workspace} /> : <JoinWorkspaceButton workspace={workspace} />}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

    )
}

export default WorkspaceActions
