import { useEffect, useSyncExternalStore } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useFrappeGetDoc } from "frappe-react-sdk"
import { LinkIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { Skeleton } from "@components/ui/skeleton"
import { MessageListSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { channelStore } from "@stores/channels/store"
import type { Message } from "@raven/types/common/Message"
import _ from "@lib/translate"

/** While resolving: the destination's silhouette (sidebar + chat stream) instead
 *  of a bare spinner — the redirect lands on a page shaped exactly like this, so
 *  the transition reads as the page filling in rather than swapping. */
const ResolvingSkeleton = () => (
    <div className="flex h-full w-full">
        {/* Channel sidebar (desktop only — mobile lands straight on the chat) */}
        <div className="hidden w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-outline-gray-2 bg-surface-sidebar px-2 py-3 md:flex">
            <Skeleton className="mb-3 h-6 w-36" />
            {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="flex h-7 items-center gap-2 px-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm" style={{ width: `${45 + ((index * 17) % 40)}%` }} />
                </div>
            ))}
        </div>
        {/* Chat: header bar + message rows */}
        <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center border-b border-outline-gray-2 px-4">
                <Skeleton className="h-4 w-40" />
            </div>
            <MessageListSkeleton />
        </div>
    </div>
)

/**
 * The permalink resolver: /message/:messageID → wherever that message actually
 * lives. "Copy message link" always produces THIS route, so one URL shape works
 * for every message — channel, DM, or thread reply — from any surface.
 *
 * Resolution:
 *  1. Fetch the message → its channel_id.
 *  2. channel_id in the channel store → a channel/DM message → replace-navigate
 *     to the channel with ?message_id (the stream centers + highlights it).
 *  3. channel_id NOT in the store → it's a thread reply (threads never appear in
 *     the channel list). The thread's ROOT message shares the thread's id and
 *     knows the parent channel — fetch it (same SWR key as ThreadRootMessage, so
 *     the thread view reuses the response) and replace-navigate to
 *     {parent}/thread/{threadID}?thread_message_id (read by ThreadDrawerRoute).
 *
 * Replace-navigation keeps this resolver out of history — back from the
 * destination goes to wherever the user was before opening the link.
 */
export default function MessagePermalink() {
    const { messageID } = useParams<{ messageID: string }>()
    const navigate = useNavigate()
    // The store decides channel-vs-thread, so wait for it (also re-renders us when it loads).
    const channelsLoaded = useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)

    const { data: message, error } = useFrappeGetDoc<Message>(
        "Raven Message",
        messageID,
        messageID ? `raven_message:${messageID}` : null,
    )

    const channelID = message?.channel_id
    const directChannel = channelsLoaded && channelID ? channelStore.getChannel(channelID) : undefined

    // Thread reply: resolve the parent via the root message (root id = channel_id).
    const needsRoot = Boolean(channelsLoaded && message && channelID && !directChannel)
    const { data: rootMessage, error: rootError } = useFrappeGetDoc<Message>(
        "Raven Message",
        needsRoot ? channelID : "",
        needsRoot ? `raven_message:${channelID}` : null,
    )
    const parentChannel = rootMessage ? channelStore.getChannel(rootMessage.channel_id) : undefined

    useEffect(() => {
        if (!channelsLoaded || !message || !messageID) return
        const baseFor = (channel: { name: string; is_direct_message?: 0 | 1; workspace?: string }) =>
            channel.is_direct_message === 1
                ? `/dm-channel/${encodeURIComponent(channel.name)}`
                : `/${encodeURIComponent(channel.workspace ?? "")}/${encodeURIComponent(channel.name)}`

        if (directChannel) {
            navigate(`${baseFor(directChannel)}?message_id=${encodeURIComponent(messageID)}`, { replace: true })
        } else if (rootMessage && parentChannel) {
            navigate(
                `${baseFor(parentChannel)}/thread/${encodeURIComponent(rootMessage.name)}?thread_message_id=${encodeURIComponent(messageID)}`,
                { replace: true },
            )
        }
    }, [channelsLoaded, message, messageID, directChannel, rootMessage, parentChannel, navigate])

    // Unresolvable: the message (or its thread's root) is gone or not visible to
    // this user — or the thread's parent channel isn't one they can see.
    const failed = Boolean(error || rootError || (rootMessage && channelsLoaded && !parentChannel))

    if (failed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Empty>
                    <EmptyMedia>
                        <LinkIcon />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle>{_("Message not found")}</EmptyTitle>
                        <EmptyDescription>
                            {_("This message may have been deleted, or you may not have access to it.")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <Button variant="outline" size="md" onClick={() => navigate("/", { replace: true })}>
                        {_("Go home")}
                    </Button>
                </Empty>
            </div>
        )
    }

    return <ResolvingSkeleton />
}
