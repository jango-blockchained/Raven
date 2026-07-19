import { DropdownMenuItem } from "@components/ui/dropdown-menu"
import { Link } from "react-router-dom"
import { Settings } from "lucide-react"
import { WorkspaceFields } from "@hooks/useWorkspaces"
import _ from "@lib/translate"

type Props = {
    workspace: WorkspaceFields
    /** Settings-dialog context: open the in-panel detail view instead of routing. */
    onManage?: () => void
}

export default function WorkspaceSettingsButton({ workspace, onManage }: Props) {
    if (onManage) {
        return (
            <DropdownMenuItem onClick={onManage}>
                <Settings />
                {_("Manage")}
            </DropdownMenuItem>
        )
    }
    return (
        <DropdownMenuItem asChild>
            <Link to={`${workspace.name}`}>
                <Settings />
                {_("Manage")}
            </Link>
        </DropdownMenuItem>
    )
}
