import { useUnreadNotificationsCount } from '@hooks/useNotifications'
import _ from '@lib/translate'
import { cn } from '@lib/utils'
import useCurrentRavenUser from '@raven/lib/hooks/useCurrentRavenUser'
import { useUnreadThreadsCount } from '@stores/threads/useUnreadThreads'
import { useWorkspaces } from '@hooks/useWorkspaces'
import { useDMUnread, useHasUnreadChannels } from '@stores/unread/useChannelUnread'
import { BellIcon, HomeIcon, MessageSquareTextIcon, SearchIcon, UsersRoundIcon } from 'lucide-react'
import { CircleUserRoundIcon } from "lucide-react"
import { NavLink, useMatch } from 'react-router'

const FOOTER_LINKS = [
    {
        icon: HomeIcon,
        title: _("Home"),
        to: "/",
    },
    {
        icon: UsersRoundIcon,
        title: _("DMs"),
        to: "/dm-channel",
    },
    {
        icon: MessageSquareTextIcon,
        title: _("Threads"),
        to: "/threads",
    },
    {
        icon: BellIcon,
        title: _("Notifications"),
        to: "/notifications",
    },
    {
        icon: CircleUserRoundIcon,
        title: _("Profile"),
        to: "/profile",
    }
]

/**
 * `inert`: set while a detail layer covers the footer (stacked navigation). The footer
 * must stay MOUNTED then — unmounting it changes the list row's height, which clamps the
 * list's scroll position when it was at the bottom (the "list moved after back" bug) —
 * so hosts cover it with a z-20 layer and inert it instead of removing it.
 */
const AppMobileFooter = ({ inert }: { inert?: boolean }) => {
    return (
        <AppMobileFooterContainer inert={inert}>
            <HomeLink />
            <DirectMessageLink />
            <ThreadsLink />
            <NotificationsLink />
            <ProfileLink />
        </AppMobileFooterContainer>
    )
}


export default AppMobileFooter

/** Renders a skeleton where the buttons are not clickable */
export const AppMobileFooterSkeleton = () => {
    return <AppMobileFooterContainer>
        {FOOTER_LINKS.map((link) => (
            <FooterNavLinkSkeleton key={link.to} icon={<link.icon />} title={link.title} />
        ))}
    </AppMobileFooterContainer>
}

// In-flow (NOT position: fixed): the bar takes its real height in the host's flex
// column, so the content above always ends exactly at the bar. The old fixed bar
// needed an h-16 spacer to reserve space, and any mismatch (standalone:pb-4, content
// a few px over 64) made the bar overhang the bottom of every list.
const AppMobileFooterContainer = ({ children, className, inert }: { children: React.ReactNode, className?: string, inert?: boolean }) => {

    return <div className={cn("md:hidden grid grid-cols-5 shrink-0 bg-surface-elevation-2 border-t border-outline-gray-2 standalone:pb-4", className)} inert={inert}>
        {children}
    </div>
}

const AppMobileFooterButton = ({ icon, title, isActive, badgeCount, showDot }: { icon: React.ReactNode, title: string, isActive: boolean, badgeCount?: number, showDot?: boolean }) => {

    return <div data-active={isActive} title={title} className={cn(
        "flex items-center flex-col py-3 justify-center overflow-hidden text-ink-gray-4 active:scale-95 data-active:text-ink-gray-9 [&>svg]:size-6 data-active:[&>svg]:text-ink-gray-7"
    )}>
        <div className='flex flex-col items-center justify-center gap-2'>
            <div className='relative'>
                {icon}
                <UnreadBadge count={badgeCount} />
                {/* Activity dot (no number) — Home uses it for channel unreads:
                    channels are ambient, not an inbox, so "there's activity" is
                    the honest signal; counts stay on the personal queues. */}
                {showDot && !badgeCount && (
                    <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-surface-red-6" aria-hidden="true" />
                )}
            </div>
            <span className='text-2xs-medium text-center'>{title}</span>
        </div>

    </div>
}

const UnreadBadge = ({ count }: { count?: number }) => {

    if (!count || count === 0) return null

    // Pill, not a fixed circle: a single digit stays circular (min-w == height),
    // but "9+" / two digits grow horizontally with px-1 so the glyphs aren't
    // crushed against the boundary. h-4 keeps the cap height stable either way.
    return <span className="absolute -top-2 -right-3.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-surface-red-6 dark:bg-surface-red-6 text-ink-base dark:text-ink-red-1 text-[10px] leading-none">
        {count > 9 ? "9+" : count}
    </span>

}

const DirectMessageLink = () => {
    const unread = useDMUnread()

    return <FooterNavLink
        icon={<UsersRoundIcon />}
        title={_("DMs")}
        to={"/dm-channel"}
        badgeCount={unread}
    />
}

const NotificationsLink = () => {
    // Store-derived (unread-id set size); kept live globally by useNotificationsRealtime.
    const unreadCount = useUnreadNotificationsCount()

    return <FooterNavLink
        icon={<BellIcon />}
        title={_("Notifications")}
        to={"/notifications"}
        badgeCount={unreadCount}
    />
}

const ThreadsLink = () => {
    const unread = useUnreadThreadsCount()

    return <FooterNavLink
        icon={<MessageSquareTextIcon />}
        title={_("Threads")}
        to={"/threads"}
        badgeCount={unread}
    />
}
const FooterNavLink = ({ to, icon, title, badgeCount }: { to: string; icon: React.ReactNode; title: string, badgeCount?: number }) => {
    return (
        <NavLink to={to} end>
            {({ isActive }) => (
                <AppMobileFooterButton icon={icon} title={title} isActive={isActive} badgeCount={badgeCount} />
            )}
        </NavLink>
    )
}

const FooterNavLinkSkeleton = ({ title, icon }: { title: string, icon: React.ReactNode }) => {
    return <AppMobileFooterButton icon={icon} title={title} isActive={false} />
}

const HomeLink = () => {
    // Home is active on a workspace route (`/:workspaceID` or a channel/thread under it) and on
    // the index. The catch: `/:workspaceID` is a single dynamic segment, so it also matches the
    // sibling top-level routes (/threads, /dm-channel, /notifications, /profile, /search, …) —
    // which is why Home looked "always active". Disambiguate by checking the first segment
    // against the REAL workspaces, not just "any string".
    const { workspaces } = useWorkspaces()
    const wsMatch = useMatch("/:workspaceID/*")
    const isIndex = Boolean(useMatch({ path: "/", end: true }))
    const ws = wsMatch?.params.workspaceID
    const isWorkspaceRoute = !!ws && workspaces.some((w) => w.name === ws)

    // Channel unreads get a DOT, not a count — channels are ambient (curated
    // sidebar, not an inbox); the numeric badges stay on the personal queues.
    const hasUnreadChannels = useHasUnreadChannels()

    return (
        <NavLink to="/">
            {() => (
                <AppMobileFooterButton
                    icon={<HomeIcon />}
                    title={_("Home")}
                    isActive={isIndex || isWorkspaceRoute}
                    showDot={hasUnreadChannels}
                />
            )}
        </NavLink>
    )
}

const ProfileLink = () => {

    const { myProfile } = useCurrentRavenUser()

    return <FooterNavLink
        icon={myProfile?.user_image ? <img src={myProfile.user_image} alt="Profile" className="size-6 bg-surface-gray-2 rounded-full object-cover" /> : <CircleUserRoundIcon />}
        title={_("Profile")}
        to={"/profile"}
    />
}