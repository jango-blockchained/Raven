import { useEffect, useMemo, useReducer, useState } from "react"
import { useNavigate } from "react-router-dom"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@components/ui/drawer"
import { Badge } from "@components/ui/badge"
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { WorkspaceLogo } from "@components/channel-sidebar/ChannelSidebar"
import { useChannels } from "@stores/channels/useChannelList"
import { channelUnreadStore } from "@stores/unread/store"
import { useWorkspaces, type WorkspaceFields } from "@hooks/useWorkspaces"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

/**
 * The mobile "catch up" drawer — opened by LONG-PRESSING Home in the footer
 * (v3's replacement for v2's always-visible workspace rail, which paid a
 * permanent strip of screen for an occasional job).
 *
 * TWO ZONES with deliberately different anatomy, so the two jobs never compete
 * (nested workspace-rows + channel-rows always read as mush):
 *
 *  - A horizontal STRIP of workspace logos on top — v2's rail rotated sideways
 *    and summoned on demand. Tap switches workspace; a dot marks workspaces
 *    with unreads; the current one is ringed. Works when everything is read.
 *  - A LIST of unread channels beneath, full-width rows in the sidebar idiom,
 *    grouped under plain-text workspace names (headers are labels, not rows —
 *    nothing competes with the channel rows for tap weight).
 *
 * Muted channels are excluded, matching every other unread aggregate (the Home
 * dot that advertises this drawer among them).
 */
/**
 * Shared open state: the footer's Home long-press AND the channel sidebar's
 * workspace switcher (mobile) both open the same drawer instance, which lives
 * in AppMobileFooter — mounted on every mobile page either trigger exists on.
 */
export const workspacesDrawerAtom = atom(false)

export const HomeWorkspacesDrawer = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const navigate = useNavigate()

    // Navigation taps skip the exit animation on purpose. The OS back-swipe
    // gesture animates with a SCREENSHOT of this page taken at the moment we
    // navigate away — if the drawer is still on screen then (even mid-close),
    // the screenshot keeps it, and swiping back from the channel shows the
    // switcher "still open" until the live page paints. So: unmount the drawer
    // at once, let one clean frame paint, and only then navigate. The flag only
    // covers that two-frame handoff — it resets right after navigating (the
    // drawer is closed by then, so remounting it renders nothing).
    const [hiddenForNavigation, setHiddenForNavigation] = useState(false)

    const handleNavigate = (to: string) => {
        setHiddenForNavigation(true)
        onOpenChange(false)
        // Double rAF: the first fires before the next paint, so navigating in
        // the second guarantees at least one drawer-free frame was painted.
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                navigate(to)
                setHiddenForNavigation(false)
            }),
        )
    }

    if (hiddenForNavigation) return null

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="px-4 pb-0 pt-0">
                    <DrawerTitle className="sr-only">{_("Workspaces")}</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        {_("Unread channels across all your workspaces")}
                    </DrawerDescription>
                </DrawerHeader>
                {/* Content only mounts while open (vaul unmounts closed drawers),
                    so the store subscription below never runs in the background. */}
                <DrawerBody onNavigate={handleNavigate} />
            </DrawerContent>
        </Drawer>
    )
}

type UnreadRow = { channel: ChannelListItem; workspace: WorkspaceFields; count: number }

const DrawerBody = ({ onNavigate }: { onNavigate: (to: string) => void }) => {
    const { workspaces } = useWorkspaces()
    const { channels } = useChannels()
    const { myProfile } = useCurrentRavenUser()
    const currentWorkspace = useAtomValue(lastWorkspaceAtom)

    // Re-derive rows when any unread count changes while the drawer is open
    // (a version bump keeps the useMemo below as the single compute site — a
    // useSyncExternalStore snapshot would need a stable array identity).
    const [unreadVersion, bumpUnreadVersion] = useReducer((version: number) => version + 1, 0)
    useEffect(() => channelUnreadStore.subscribeGlobal(bumpUnreadVersion), [])

    // Workspaces in the user's pinned order (same rule as the sidebar switcher):
    // pinned rows first (in row order), the rest in server order.
    const myWorkspaces = useMemo(() => {
        const members = workspaces.filter((workspace) => workspace.workspace_member_name)
        const position = new Map((myProfile?.pinned_workspaces ?? []).map((row, index) => [row.workspace, index]))
        if (position.size === 0) return members
        return [...members].sort((a, b) => (position.get(a.name) ?? Infinity) - (position.get(b.name) ?? Infinity))
    }, [workspaces, myProfile?.pinned_workspaces])

    // One flat list: workspace pinned order, then alphabetical within it.
    const unreadRows = useMemo<UnreadRow[]>(() => {
        return myWorkspaces.flatMap((workspace) =>
            channels
                .filter((channel) => channel.workspace === workspace.name && !channel.muted && !channel.is_archived)
                .map((channel) => ({ channel, workspace, count: channelUnreadStore.getState(channel.name).count }))
                .filter((row) => row.count > 0)
                .sort((a, b) => a.channel.channel_name.localeCompare(b.channel.channel_name)),
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps -- unreadVersion IS the store dependency
    }, [myWorkspaces, channels, unreadVersion])

    const unreadWorkspaceIDs = useMemo(
        () => new Set(unreadRows.map((row) => row.workspace.name)),
        [unreadRows],
    )

    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)

    // Both handlers hand the destination to the parent (onNavigate) instead of
    // navigating here — the parent dismisses the drawer first, then navigates.

    const openWorkspace = (workspace: WorkspaceFields) => {
        // Persist immediately — on mobile no channel opens after a switch (the
        // list IS the page), so the Channel page's pair-write never fires.
        setLastWorkspace(workspace.name)
        setLastChannel("")
        onNavigate(`/${encodeURIComponent(workspace.name)}`)
    }

    const openChannel = (row: UnreadRow) => {
        // The Channel page records last-visited itself; just go.
        onNavigate(`/${encodeURIComponent(row.workspace.name)}/${encodeURIComponent(row.channel.name)}`)
    }

    // Rows are already in workspace order — fold them into per-workspace
    // sections for the plain-text group headers. Headers only earn their place
    // when there's more than one workspace to tell apart.
    const sections = useMemo(() => {
        const out: { workspace: WorkspaceFields; rows: UnreadRow[] }[] = []
        for (const row of unreadRows) {
            const last = out[out.length - 1]
            if (last && last.workspace.name === row.workspace.name) last.rows.push(row)
            else out.push({ workspace: row.workspace, rows: [row] })
        }
        return out
    }, [unreadRows])
    const showSectionHeaders = myWorkspaces.length > 1

    return (
        <div className="flex min-h-0 flex-col pb-2">
            {/* Zone 1 — the workspace grid. WRAPS instead of scrolling: every
                workspace stays visible (a hidden one with unreads would defeat
                the triage job) and each keeps a fixed position (spatial memory —
                the whole point of a switcher). Fixed FOUR columns: tiles line up
                in a stable grid and get room for their two-line names. */}
            <div className="grid grid-cols-4 items-start gap-1 px-3 pb-3 pt-1">
                {myWorkspaces.map((workspace) => (
                    <button
                        key={workspace.name}
                        type="button"
                        onClick={() => openWorkspace(workspace)}
                        className="flex w-full flex-col items-center gap-2 rounded-lg px-1 py-2 active:bg-surface-gray-2"
                    >
                        <span className="relative">
                            <WorkspaceLogo
                                workspace={workspace}
                                className={cn(
                                    "size-12 rounded-lg text-base",
                                    workspace.name === currentWorkspace && "ring ring-outline-gray-2 ring-offset-1 ring-offset-surface-elevation-1",
                                )}
                            />
                            {/* Same ambient signal as the Home tab: a dot, not a count. */}
                            {unreadWorkspaceIDs.has(workspace.name) && (
                                <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-surface-red-6 ring-2 ring-surface-elevation-1" aria-hidden="true" />
                            )}
                        </span>
                        <span className="w-full text-center text-xs leading-snug text-ink-gray-6 line-clamp-2 break-words">
                            {workspace.workspace_name}
                        </span>
                    </button>
                ))}
            </div>



            {/* Zone 2 — unread channels, or the caught-up state. */}
            {unreadRows.length > 0 && (
                <div className="border-t border-outline-gray-2 pt-4">
                    {/* Capped so the whole sheet stays near half the screen even
                        with many unread channels — the workspace grid on top
                        should stay within thumb reach, not ride up the screen.
                        dvh, not vh: in a browser tab vh ignores the collapsing
                        URL bar and would overshoot. */}
                    <div className="max-h-[35dvh] min-h-0 overflow-y-auto px-2 pb-2" data-vaul-no-drag>
                        {sections.map(({ workspace, rows }) => (
                            <section key={workspace.name} className="mb-2">
                                {showSectionHeaders && (
                                    <p className="px-2 text-xs-medium text-ink-gray-4">
                                        {workspace.workspace_name}
                                    </p>
                                )}
                                <ul className="pt-0.5">
                                    {rows.map((row) => (
                                        <li key={row.channel.name}>
                                            <button
                                                type="button"
                                                onClick={() => openChannel(row)}
                                                className="flex py-2.5 w-full items-center gap-1 rounded-md px-2 text-left active:bg-surface-gray-2"
                                            >
                                                <ChannelIcon type={row.channel.type} className="size-4.5 shrink-0 text-ink-gray-6" />
                                                <span className="min-w-0 flex-1 truncate text-base-medium text-ink-gray-8">
                                                    {row.channel.channel_name}
                                                </span>
                                                <Badge size="md" variant="subtle" theme="gray" className="tabular-nums">
                                                    {row.count > 99 ? "99+" : row.count}
                                                </Badge>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
