import { useMemo } from "react"
import { CommandGroup } from "@components/ui/command"
import { FilterCombobox, FilterComboboxItem } from "@components/common/FilterCombobox"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { cn } from "@lib/utils"
import type { ChannelListItem, DMChannelListItem } from "@raven/types/common/ChannelListItem"
import { UserData } from "@db"
import _ from "@lib/translate"
import { useWorkspaces } from "@hooks/useWorkspaces"

export type ChannelSelectItem = ChannelListItem | DMChannelListItem

/** Sentinel for "no channel filter". Not a real channel id. */
const ALL = "*all"

interface ChannelSelectProps {
    /** Regular channels */
    channels: ChannelListItem[]
    /** DM channels */
    dmChannels?: DMChannelListItem[]
    /** Users for resolving DM peer names/avatars (optional; falls back to peer_user_id when empty) */
    users?: UserData[]
    value: string
    onValueChange: (value: string) => void
    /** Label for the "no filter" option. */
    allLabel?: string
    /** Width of the open popover; also the trigger width unless triggerClassName is set. */
    dropdownClassName?: string
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the select can flex down in a shared row. */
    className?: string
}

/** Channel + DM picker for the search-style filter bars. */
export function ChannelSelect({
    channels,
    dmChannels,
    users,
    value,
    onValueChange,
    allLabel = _("In Any Channel"),
    dropdownClassName,
    triggerClassName,
    className,
}: ChannelSelectProps) {
    const selectedChannel = useMemo(() => {
        if (!value || value === ALL) return null
        return channels.find((channel) => channel.name === value)
            ?? dmChannels?.find((dm) => dm.name === value)
            ?? null
    }, [value, channels, dmChannels])

    const channelsByWorkspace = useMemo(() => {
        const groups = new Map<string, ChannelListItem[]>()
        for (const channel of channels) {
            const key = channel.workspace ?? ""
            const list = groups.get(key)
            if (list) list.push(channel)
            else groups.set(key, [channel])
        }
        return Array.from(groups.entries())
    }, [channels])

    // Headings used to render the raw workspace ID. The list is a shared SWR key already
    // fetched app-wide, so resolving names here is a cache read, not a request.
    const { workspaces } = useWorkspaces()
    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.name, workspace.workspace_name])),
        [workspaces],
    )

    return (
        <FilterCombobox
            className={className}
            triggerClassName={triggerClassName}
            contentClassName={dropdownClassName}
            emptyLabel={_("No channels or DMs found.")}
            onClear={() => onValueChange(ALL)}
            trigger={
                selectedChannel ? (
                    <ChannelOption channel={selectedChannel} users={users} compact />
                ) : (
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">{allLabel}</span>
                )
            }
        >
            {(close) => (
                <>
                    {channelsByWorkspace.map(([workspaceID, workspaceChannels]) => (
                        <CommandGroup key={workspaceID} heading={workspaceNames.get(workspaceID) ?? workspaceID}>
                            {workspaceChannels.map((channel) => (
                                <ChannelCommandItem
                                    key={channel.name}
                                    channel={channel}
                                    users={users}
                                    selected={value === channel.name}
                                    onSelect={() => { onValueChange(channel.name); close() }}
                                />
                            ))}
                        </CommandGroup>
                    ))}
                    {dmChannels && dmChannels.length > 0 && (
                        <CommandGroup heading={_("Direct Messages")}>
                            {dmChannels.map((dm) => (
                                <ChannelCommandItem
                                    key={dm.name}
                                    channel={dm}
                                    users={users}
                                    selected={value === dm.name}
                                    onSelect={() => { onValueChange(dm.name); close() }}
                                />
                            ))}
                        </CommandGroup>
                    )}
                </>
            )}
        </FilterCombobox>
    )
}

function ChannelCommandItem({
    channel, users, selected, onSelect,
}: {
    channel: ChannelSelectItem
    users?: UserData[]
    selected: boolean
    onSelect: () => void
}) {
    return (
        <FilterComboboxItem
            value={`${channel.name} ${getChannelLabel(channel, users)}`}
            selected={selected}
            onSelect={onSelect}
        >
            <ChannelOption channel={channel} users={users} />
        </FilterComboboxItem>
    )
}

function getChannelLabel(channel: ChannelSelectItem, users?: UserData[]): string {
    if (channel.is_direct_message === 1) {
        const dm = channel as DMChannelListItem
        return users?.find((user) => user.name === dm.peer_user_id)?.full_name ?? dm.peer_user_id ?? channel.name
    }
    return channel.channel_name ?? channel.name ?? ""
}

function ChannelOption({
    channel, users, compact = false,
}: { channel: ChannelSelectItem; users?: UserData[]; compact?: boolean }) {
    const isDM = channel.is_direct_message === 1
    const peerUser = users?.find((user) => user.name === (channel as DMChannelListItem).peer_user_id)

    // min-w-0 + flex-1 in BOTH modes: as a list row this has to be able to shrink,
    // or it overflows the item and pushes the trailing check out of the popover.
    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {isDM ? (
                peerUser ? (
                    <UserAvatar user={peerUser} size={compact ? "xs" : "sm"} showStatusIndicator={false} showBotIndicator={false} />
                ) : (
                    <span className={cn(
                        "flex shrink-0 items-center justify-center rounded bg-surface-gray-2 text-xs font-bold text-ink-gray-4",
                        compact ? "size-4" : "size-6",
                    )}>
                        ?
                    </span>
                )
            ) : (
                <ChannelIcon
                    type={(channel as ChannelListItem).type as "Public" | "Private" | "Open"}
                    className="size-4 shrink-0 text-ink-gray-4"
                />
            )}
            {/* leading-snug: the UI type scale's 1.15 is too tight to contain descenders
                once `truncate` clips the line box. */}
            <span className="min-w-0 flex-1 truncate text-left leading-snug">
                {getChannelLabel(channel, users)}
            </span>
        </div>
    )
}
