import { useMemo, useSyncExternalStore } from "react"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { ListView, type ListViewColumnMeta } from "@components/ui/list-view"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@components/ui/badge"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { usersStore } from "@stores/usersStore"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import type { UserData } from "@db"
import AddUserDialog from "./AddUserDialog"

/** Workspace → Users: everyone with access to Raven (bots excluded). */
export const Users = () => {
    const usersMap = useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot)

    const humanUsers = useMemo(
        () =>
            Array.from(usersMap.values())
                .filter((user) => user.type === "User")
                .sort((a, b) => (a.full_name || a.name).localeCompare(b.full_name || b.name)),
        [usersMap],
    )

    return (
        <>
            <SettingsPanelHeader actions={hasRole("System Manager") ? <AddUserDialog /> : null}>
                <SettingsPanelTitle>{_("Users")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Manage users added to Raven.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0">
                <ListView
                    className="flex-1 min-h-0"
                    scrollAreaClassName="flex-1"
                    maxHeight="100%"
                    data={humanUsers}
                    columns={userColumns}
                    getRowId={(row) => row.name}
                    emptyState={<span className="text-ink-gray-4">{_("No users found.")}</span>}
                />
            </SettingsPanelContent>
        </>
    )
}

const userColumns: ColumnDef<UserData>[] = [
    {
        id: "full_name",
        accessorKey: "full_name",
        header: _("Name"),
        meta: { gridWidth: "minmax(200px,2fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
                <UserAvatar user={row.original} size="sm" showStatusIndicator={false} />
                <span className="font-medium truncate">{row.original.full_name}</span>
                {!row.original.enabled && <Badge variant="outline">{_("Disabled")}</Badge>}
            </div>
        ),
    },
    {
        id: "email",
        accessorKey: "name",
        header: _("Email"),
        meta: { gridWidth: "minmax(180px,2fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) => <span className="text-ink-gray-5">{row.original.name}</span>,
    },
    {
        id: "custom_status",
        accessorKey: "custom_status",
        header: _("Status"),
        meta: { gridWidth: "minmax(120px,1fr)" } satisfies ListViewColumnMeta,
        cell: ({ row }) =>
            row.original.custom_status ? <Badge variant="subtle">{row.original.custom_status}</Badge> : null,
    },
]

export default Users
