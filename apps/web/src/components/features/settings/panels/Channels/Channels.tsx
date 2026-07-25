import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { ListView, type ListViewColumnMeta, type SortingState } from "@components/ui/list-view"
import type { ColumnDef } from "@tanstack/react-table"
import { CreateChannelForm } from "@components/features/channel/CreateChannel/CreateChannelForm"
import { Button } from "@components/ui/button"
import { Dialog, DialogTrigger, DialogContent } from "@components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { useChannels } from "@stores/channels/useChannelList"
import _ from "@lib/translate"
import { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { BellOff, BellRing, Loader2, Plus, Check } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { ChannelFilters } from "./ChannelFilters"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { Badge } from "@components/ui/badge"
import { useJoinChannel } from "@hooks/useJoinChannel"
import { useLeaveChannel } from "@hooks/useLeaveChannel"
import { errorResponseToast } from "@components/ui/error-banner"
import { FrappeError, useFrappePostCall } from "frappe-react-sdk"
import { channelStore } from "@stores/channels/store"
import { toast } from "sonner"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
    useSettingsDialog,
} from "@components/ui/settings-dialog"
import { CreateChannelDialog } from "@components/features/channel/CreateChannel/CreateChannelButton"

export const Channels = () => {

    const { channels } = useChannels()
    const { workspaces } = useWorkspaces()
    const [sorting, setSorting] = useState<SortingState>([])
    const [filters, setFilters] = useState<{ myChannels: string, channelType: string, workspace: string, searchQuery: string }>({ myChannels: 'All Channels', channelType: 'All Types', workspace: workspaces?.[0]?.name ?? '', searchQuery: '' })

    const navigate = useNavigate()
    const { onClose } = useSettingsDialog()

    const filteredChannels = useMemo<ChannelListItem[]>(() => {
        let filteredChannels: ChannelListItem[] = channels.filter((channel) => {
            const myChannelsMatch = filters?.myChannels === 'All Channels' || (filters?.myChannels === 'Joined Channels' && !!channel.member_id) || (filters?.myChannels === 'Other Channels' && !channel.member_id);

            const channelTypeMatch = filters?.channelType === 'All Types' || channel.type === filters?.channelType;

            const workspaceMatch = !filters?.workspace || channel.workspace === filters?.workspace;

            const searchMatch = !filters?.searchQuery || channel.channel_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) || (channel.channel_description ?? "").toLowerCase().includes(filters.searchQuery.toLowerCase());

            return myChannelsMatch && channelTypeMatch && workspaceMatch && searchMatch;
        });

        // Sort archived channels to the bottom
        filteredChannels.sort((a, b) => {
            if (a.is_archived && !b.is_archived) return 1;
            if (!a.is_archived && b.is_archived) return -1;
            return 0;
        });

        const active = sorting[0]
        if (!active) return filteredChannels
        const field = active.id as keyof ChannelListItem
        return filteredChannels.sort((a, b) => {
            // Keep archived channels at bottom even when sorting
            if (a.is_archived && !b.is_archived) return 1
            if (!a.is_archived && b.is_archived) return -1
            const aVal = a[field] ?? ''
            const bVal = b[field] ?? ''
            const cmp = String(aVal).localeCompare(String(bVal))
            return active.desc ? -cmp : cmp
        })
    }, [channels, sorting, filters])

    const columns = useMemo<ColumnDef<ChannelListItem>[]>(() => [
        {
            id: 'channel_name',
            accessorKey: 'channel_name',
            header: _('Name'),
            meta: {
                gridWidth: 'minmax(180px,1.5fr)',
                getTooltipText: (row) => (row as ChannelListItem).channel_name,
            } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <div className='flex items-center gap-2 hover:cursor-pointer min-w-0' onClick={() => {
                    navigate(`/${row.original.workspace}/${row.original.name}`)
                    onClose?.()
                }}>
                    <ChannelIcon type={row.original.type || "Public"} className="w-4 h-4 shrink-0" />
                    <span className='font-medium truncate'>{row.original.channel_name}</span>
                </div>
            )
        },
        {
            id: 'channel_description',
            accessorKey: 'channel_description',
            header: _('Description'),
            enableSorting: false,
            meta: { gridWidth: 'minmax(0,3fr)' } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <span className='text-ink-gray-4 truncate'>
                    {row.original.channel_description || '—'}
                </span>
            )
        },
        {
            id: 'channel_joined',
            header: '',
            size: 112,
            enableSorting: false,
            enableResizing: false,
            meta: { truncate: false, truncateTooltip: false, align: 'center' } satisfies ListViewColumnMeta,
            cell: ({ row }) => (row.original.type !== 'Open' ? <ChannelJoinButton channel={row.original} /> : null),
        },
        {
            id: "allow_notifications",
            header: '',
            size: 56,
            enableSorting: false,
            enableResizing: false,
            meta: { truncate: false, truncateTooltip: false, align: 'center' } satisfies ListViewColumnMeta,
            cell: ({ row }) => <ChannelNotificationsButton channel={row.original} />,
        }
    ], [navigate, onClose])

    return (
        <>
            <SettingsPanelHeader actions={<CreateChannelButton selectedWorkspace={filters?.workspace ?? ""} />}>
                <SettingsPanelTitle>{_("Channels")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Browse and manage every channel in this workspace.")}
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-4 pt-0.5">
                <ChannelFilters filters={filters} setFilters={setFilters} workspaces={workspaces} />
                <ListView
                    className="flex-1 min-h-0"
                    scrollAreaClassName="flex-1"
                    maxHeight="100%"
                    rowHeight={44}
                    columns={columns}
                    data={filteredChannels}
                    getRowId={(row) => row.name}
                    sorting={sorting}
                    onSortingChange={setSorting}
                    emptyState={
                        <div className="flex flex-col items-center justify-center gap-1 py-6">
                            <p className="text-ink-gray-4">{_("No channels found")}</p>
                            <p className="text-ink-gray-4 text-sm">{_("You may want to try adjusting your filters.")}</p>
                        </div>
                    }
                />
            </SettingsPanelContent>
        </>
    )
}

const ChannelJoinButton = ({ channel }: { channel: ChannelListItem }) => {

    const { joinChannel, loading: joinChannelLoading } = useJoinChannel(channel.name)
    const { leaveChannel, loading: leaveChannelLoading } = useLeaveChannel(channel.name)

    const isLoading = joinChannelLoading || leaveChannelLoading

    const toggleJoin = (action: "join" | "leave") => {
        const isJoin = action === "join"
        const promise = isJoin ? joinChannel() : leaveChannel()
        toast.promise(promise, {
            loading: isJoin
                ? _("Joining {0}...", [channel.channel_name])
                : _("Leaving {0}...", [channel.channel_name]),
            success: isJoin
                ? _("You have joined {0}.", [channel.channel_name])
                : _("You have left {0}.", [channel.channel_name]),
            error: isJoin ? _("Could not join channel") : _("Could not leave channel"),
        })
    }

    if (channel.is_archived) {
        return (
            <Badge
                variant="subtle"
            >
                {_("Archived")}
            </Badge>
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="group/join"
            loading={isLoading}
            onClick={() => toggleJoin(channel.member_id ? 'leave' : 'join')}>
            {channel.member_id ? (<span className="grid">
                <span className='opacity-100 group-hover/join:opacity-0 transition-opacity duration-150 col-start-1 row-start-1'>
                    {_('Joined')}
                </span>
                <span className='opacity-0 group-hover/join:opacity-100 transition-opacity duration-150 col-start-1 row-start-1'>
                    {_('Leave')}
                </span>
            </span>) : (<span>
                {_('Join')}
            </span>)}
        </Button>
    )
}

const ChannelNotificationsButton = ({ channel }: { channel: ChannelListItem }) => {

    // Backend supports a binary allow_notifications flag (All / Mute) per member,
    // via toggle_push_notification_for_channel. There is no "mentions only" level yet.
    const { call: toggleNotifications } = useFrappePostCall("raven.api.notification.toggle_push_notification_for_channel")

    if (!channel.member_id || channel.is_archived) {
        return null
    }

    const isOn = !!channel.allow_notifications

    const setNotifications = (allow: 0 | 1) => {
        if (isOn === !!allow) return
        // Optimistic: flip the store so the icon updates immediately, revert on failure.
        channelStore.patchChannel(channel.name, { allow_notifications: allow })
        toggleNotifications({ member: channel.member_id, allow_notifications: allow })
            .catch((e) => {
                channelStore.patchChannel(channel.name, { allow_notifications: allow ? 0 : 1 })
                errorResponseToast(_("Could not update notifications"), e as FrappeError)
            })
    }

    return (
        <div className="flex w-full justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" isIconButton className="hover:cursor-pointer">
                        <span key={isOn ? 'on' : 'off'} className="grid">
                            {isOn ? <BellRing /> : <BellOff />}
                        </span>
                        <span className="sr-only">{isOn ? _('Mute Channel') : _('Unmute Channel')}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={() => setNotifications(1)}>
                        <BellRing />
                        <span className="flex-1">{_("All Notifications")}</span>
                        {isOn && <Check />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNotifications(0)}>
                        <BellOff />
                        <span className="flex-1">{_("Mute Channel")}</span>
                        {!isOn && <Check />}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

const CreateChannelButton = ({ selectedWorkspace }: { selectedWorkspace: string }) => {
    const [isOpen, setIsOpen] = useState(false)
    return (
        <>
            <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
                <Plus />
                {_("Create Channel")}
            </Button>
            <CreateChannelDialog open={isOpen} onOpenChange={setIsOpen} />
        </>
    )
}

export default Channels
