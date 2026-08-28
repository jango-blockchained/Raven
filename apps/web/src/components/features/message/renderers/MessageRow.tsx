import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useUser } from "@hooks/useUser"
import { getDateObject } from "@lib/date"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { UserAvatar } from "../UserAvatar"
import { UserProfileHoverCard } from "./UserProfileHoverCard"
import { timeFormatAtom } from "@utils/preferences"
import { useAtomValue } from "jotai"

/**
 * Shared anatomy for everything rendered as a row in the chat stream
 * (single messages, batches). Keeps the shell, sender header, and time
 * formatting in ONE place so the two row types can't drift apart.
 */

/** Short (in-row) and long (tooltip) display times for a message timestamp. */
export const useMessageTimes = (creation: string) => {

    const timeFormat = useAtomValue(timeFormatAtom)

    return useMemo(() => {
        try {
            const dateObject = getDateObject(creation)
            let format = "h:mm a"
            if (timeFormat === "24-hour") {
                format = "HH:mm"
            }

            return {
                shortTime: dateObject.format(format),
                longTime: dateObject.format(`Do MMMM YYYY, ${format}`),
            }
        } catch {
            return { shortTime: creation, longTime: creation }
        }
    }, [creation, timeFormat])
}

/** The hoverable row shell every stream row shares. */
export const MessageRow = ({
    children,
    ref,
    className,
}: {
    children: React.ReactNode
    ref?: React.Ref<HTMLDivElement>
    className?: string
}) => (
    <div
        ref={ref}
        // Anchor for the floating hover toolbar (see MessageActionMenu) — the
        // hover hit can land on an inner element that also carries a
        // data-message-id (an image tile), so the row marks itself.
        data-message-row=""
        className={cn(
            // overflow-hidden clips media to the rounded corners — but while this row
            // holds the inline editor, drop it so the editor's mention/emoji popup
            // (which rises above the box) isn't clipped by the row.
            "group/message-item w-full overflow-hidden has-[[data-raven-editor]]:overflow-visible relative hover:bg-surface-gray-1/50 py-2 rounded-md px-3.5 transition-all duration-200",
            className,
        )}
    >
        {children}
    </div>
)

// Own-message surface in Left-Right mode: faint gray fill that deepens on row
// hover — it IS the hover highlight (ownRowClass silences the row shell's).
// w-fit hugs short messages; full width around the inline editor.
const bubbleClass =
    "w-fit min-w-0 max-w-full rounded-xl bg-surface-gray-1 group-hover/message-item:bg-surface-gray-2 transition-colors p-2.5 md:p-3.5 has-[[data-raven-editor]]:w-full"
// Alignment context for a footer (thread pill) under an own bubble. The width
// cap lives on the row shell (ownRowClass), so the bubble just fills it.
const bubbleColumnClass = "flex w-fit max-w-full flex-col"

/** Left-Right rows shrink the hover shell to their content, capped at 75% of
 *  the stream on desktop; mobile keeps the full width (alignment still reads
 *  from self-end, and a cap only clips wide content). */
export const leftRightRowClass = "w-fit max-w-full md:max-w-[75%]"
export const ownRowClass = `${leftRightRowClass} self-end hover:bg-transparent`

/**
 * The sender layout inside a row: avatar + name + time header for the first
 * message of a group, the empty gutter for continuations. `children` render
 * in the (min-w-0) content column either way.
 *
 * Left-Right mode only restyles the current user's OWN messages: right-aligned
 * bubble, no avatar/name. Everyone else keeps the Simple layout.
 */
export const MessageSenderLayout = ({
    owner,
    creation,
    isContinuation,
    isOwn = false,
    footer,
    children,
}: {
    owner: string
    creation: string
    isContinuation: boolean
    /** Left-Right mode, current user's message: right-aligned bubble, no avatar/name. */
    isOwn?: boolean
    /** Rendered under an OWN message's bubble, left-aligned to it (thread pill).
     *  Other/simple layouts render their footer at the row level instead. */
    footer?: React.ReactNode
    children: React.ReactNode
}) => {
    const user = useUser(owner)
    const displayName = user?.full_name || user?.name || owner || _("User")
    const { shortTime, longTime } = useMessageTimes(creation)

    if (isOwn) {
        return (
            <div className="flex flex-col items-end">
                {!isContinuation && (
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <span className="pb-0.5 pr-1 text-xs text-ink-gray-5">{shortTime}</span>
                        </TooltipTrigger>
                        <TooltipContent>{longTime}</TooltipContent>
                    </Tooltip>
                )}
                {/* Bubble hugs the column's right edge; the footer (self-start)
                    left-aligns to the bubble's left edge, not the stream's. */}
                <div className={cn(bubbleColumnClass, "items-end")}>
                    {/* data-message-bubble: the hover toolbar anchors to the bubble
                        itself — above it, right edges flush. */}
                    <div className={bubbleClass} data-message-bubble="">{children}</div>
                    {footer}
                </div>
            </div>
        )
    }

    if (isContinuation) {
        return (
            <div className="flex items-start gap-3">
                <div className="w-8 min-w-8" />
                {/* data-message-content: in Left-Right mode the hover toolbar
                    left-aligns to where the content starts. */}
                <div className="flex-1 min-w-0" data-message-content="">{children}</div>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            {/* Avatar triggers the same profile card as the name below. The
                trigger is the column div, not UserAvatar itself — asChild needs
                an element that forwards props to the DOM. */}
            <UserProfileHoverCard id={owner} fallbackLabel={displayName}>
                <div className="mt-0.5 cursor-pointer">
                    {user ? (
                        <UserAvatar user={user} size="md" />
                    ) : (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-surface-gray-2 flex items-center justify-center text-xs-medium text-ink-gray-4">
                            {displayName.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
            </UserProfileHoverCard>
            <div className="flex-1 min-w-0" data-message-content="">
                <div className="flex items-baseline gap-1">
                    {/* Same profile card as hovering a mention — a person's name
                        opens the same thing wherever it appears in the stream. */}
                    <UserProfileHoverCard id={owner} fallbackLabel={displayName}>
                        <span className="font-medium text-content text-ink-gray-6 dark:text-ink-gray-7 cursor-pointer">
                            {displayName}
                        </span>
                    </UserProfileHoverCard>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <span className="text-xs text-ink-gray-5">· {shortTime}</span>
                        </TooltipTrigger>
                        <TooltipContent>{longTime}</TooltipContent>
                    </Tooltip>
                </div>
                {/* Header-to-content gap lives HERE (not on content renderers)
                    so continuation rows — which skip this branch — stay tight.
                    pt-1 suits text (line-height adds visual leading); hard-edged
                    media boxes (albums, file grids) read tighter, so a media
                    root leading the content gets a nudge more. */}
                <div className="pt-1 [&_[data-media-root]:first-child]:mt-0.5">
                    {children}
                </div>
            </div>
        </div>
    )
}
