import { useState, useCallback } from "react"
import { Outlet, useMatch, useNavigate } from "react-router-dom"
import { BellCheckIcon, Check, Inbox, MoreVertical } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import { useNotificationList } from "@stores/notifications/useNotificationList"
import { useUnreadNotificationsCount } from "@hooks/useNotifications"
import { useUsersById } from "@hooks/useMessageRowLookups"
import _ from "@lib/translate"
import { Label } from "@components/ui/label"
import { Switch } from "@components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@components/ui/tabs"
import { UnreadFilterPill } from "@components/common/UnreadFilterPill"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@components/ui/empty"
import { useIsMobile } from "@hooks/use-mobile"
import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { NotificationsEmptyState, type SelectedNotification } from "./NotificationChat"
import { MentionItem, ReactionItem } from "./NotificationItem"
import { cn } from "@lib/utils"

type NotificationTab = "all" | "mentions" | "reactions"

const TABS: { key: NotificationTab; label: string; type: "mention" | "reaction" | null }[] = [
    { key: "all", label: "All", type: null },
    { key: "mentions", label: "Mentions", type: "mention" },
    { key: "reactions", label: "Reactions", type: "reaction" },
]

export default function Notifications() {
    const [activeTab, setActiveTab] = useState<NotificationTab>("all")
    const [showUnread, setShowUnread] = useState(true)
    const isMobile = useIsMobile()

    // The open notification is route-driven: `/notifications/:channelID/:messageID`
    // renders NotificationChatRoute in the Outlet. Being in history means the mobile
    // back-swipe closes the chat (instead of leaving the page) and refresh restores it.
    // This layout mounts above the child route, so useParams can't see its params —
    // match the path instead.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/notifications/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID

    const tab: "all" | "mention" | "reaction" =
        activeTab === "mentions" ? "mention" : activeTab === "reactions" ? "reaction" : "all"

    const {
        rows: currentData,
        isLoading,
        hasMore,
        loadMore: loadMoreRows,
        markMessageRead,
        markAllRead,
    } = useNotificationList(tab, { unreadOnly: showUnread })

    const unreadCount = useUnreadNotificationsCount()

    const usersById = useUsersById()

    const loadMore = useCallback(() => {
        if (hasMore) loadMoreRows()
    }, [hasMore, loadMoreRows])

    const onSelect = useCallback((selection: SelectedNotification) => {
        markMessageRead(selection.messageID)
        navigate(
            `/notifications/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`,
            {
                // Thread/DM context for the pane — a cold deep-link derives it instead.
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // First open pushes (one back closes the chat); switching between
                // notifications replaces, so back never walks through every chat viewed.
                replace: hasSelection,
            },
        )
    }, [markMessageRead, navigate, hasSelection])

    const onShowUnreadChange = useCallback((checked: boolean) => {
        setShowUnread(checked)
        if (hasSelection) navigate("/notifications", { replace: true })
    }, [hasSelection, navigate])

    const onTabChange = useCallback((tab: NotificationTab) => {
        setActiveTab(tab)
        if (hasSelection) navigate("/notifications", { replace: true })
    }, [hasSelection, navigate])

    return (
        <div className="flex flex-col h-full min-h-0 w-full">
            {/* Mobile is STACKED navigation (same as WorkspaceLayout): the list is the page
                and the open notification's chat is a full-screen layer on top of it. The
                list stays mounted underneath, so going back — chevron or iOS back-swipe —
                reveals it instantly at the same scroll position. */}
            <div className="relative flex min-h-0 flex-1">
                <div
                    className="md:w-(--notifications-sidebar-width) w-full shrink-0 min-h-0"
                    // While covered by the chat layer on mobile, keep the list out of
                    // focus / accessibility order.
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <nav className="relative flex h-full w-full flex-col bg-surface-base md:bg-surface-sidebar">
                        <PageHeader title={_("Notifications")}>
                            {unreadCount > 0 && (
                                <Badge variant="subtle" size="sm" theme="gray">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </Badge>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                                <div className="hidden md:flex items-center gap-2 px-1">
                                    <Label htmlFor="unread-toggle" className="text-xs font-medium text-ink-gray-4 cursor-pointer">
                                        {_("Unread only")}
                                    </Label>
                                    <Switch
                                        id="unread-toggle"
                                        checked={showUnread}
                                        onCheckedChange={onShowUnreadChange}
                                    />
                                </div>
                                {unreadCount > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size={isMobile ? "lg" : "sm"} isIconButton aria-label={_("More options")}>
                                                <MoreVertical />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={markAllRead}>
                                                <Check />
                                                {_("Mark all as read")}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </PageHeader>

                        <div className="shrink-0 px-2 p-2">
                            <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as NotificationTab)}>
                                <TabsList variant="subtle" className="w-full">
                                    {TABS.map((t) => (
                                        <TabsTrigger key={t.key} value={t.key} className="flex-1">
                                            {_(t.label)}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Empty state centers over the whole nav (absolute) so it lands at the
                                same height as the right pane's empty state, not offset below the
                                header + tabs. pointer-events-none keeps those clickable. */}
                        {currentData.length === 0 && !isLoading && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <EmptyState showUnread={showUnread} />
                            </div>
                        )}
                        <div className="flex min-h-0 flex-1">
                            {(currentData.length > 0 || isLoading) && (
                                <Virtuoso
                                    className="flex-1 min-h-0"
                                    style={{ height: "100%" }}
                                    data={currentData}
                                    endReached={loadMore}
                                    overscan={200}
                                    defaultItemHeight={80}
                                    computeItemKey={(_index, item) => item.name}
                                    itemContent={(_index, item) =>
                                        item.notification_type === "mention" ? (
                                            <MentionItem
                                                notification={item}
                                                sender={usersById.get(item.owner)}
                                                isActive={selectedMessageID === item.message_id}
                                                onSelect={onSelect}
                                            />
                                        ) : (
                                            <ReactionItem
                                                notification={item}
                                                usersById={usersById}
                                                isActive={selectedMessageID === item.message_id}
                                                onSelect={onSelect}
                                            />
                                        )
                                    }
                                />
                            )}
                        </div>
                        <UnreadFilterPill active={showUnread} onToggle={onShowUnreadChange} />
                    </nav>
                </div>
                {/* Mobile: full-screen chat layer above the list while a notification is
                    open, hidden when none is. Desktop: a normal column beside the list. */}
                <div className={cn(
                    "flex min-w-0 min-h-0 flex-col bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-10",
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection ? <Outlet /> : <NotificationsEmptyState />}
                </div>
            </div>
            {!hasSelection && <AppMobileFooter />}
        </div>
    )
}

const EmptyState = ({ showUnread }: { showUnread: boolean }) => (
    <Empty>
        <EmptyMedia>{showUnread ? <BellCheckIcon /> : <Inbox />}</EmptyMedia>
        <EmptyHeader>
            <EmptyTitle>{showUnread ? _("You're all caught up") : _("No notifications yet")}</EmptyTitle>
            <EmptyDescription>
                {showUnread
                    ? _("No unread notifications at the moment.")
                    : _("Mentions and reactions to your messages will appear here.")
                }
            </EmptyDescription>
        </EmptyHeader>
    </Empty>
)
