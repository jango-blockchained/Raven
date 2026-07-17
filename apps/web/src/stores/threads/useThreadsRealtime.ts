import { useContext } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener } from "frappe-react-sdk"
import { reconcileUnknownThread, type ThreadCall } from "@stores/threads/listLoaders"
import { threadMetaStore } from "@stores/threads/store"
import { threadListStore } from "@stores/threads/listStore"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { useUserCookieData } from "@hooks/useUserCookieData"

type ThreadReplyEvent = {
    /** The thread's channel id (a thread IS a Raven Channel). */
    channel_id: string
    number_of_replies: number
    sent_by: string
    last_message_timestamp: string
}

type UnreadThreadEvent = {
    channel_id: string
    sent_by: string
    last_message_timestamp: string
}

/**
 * Keeps thread reply counts live. The `thread_reply` event fires whenever a message is
 * created in any thread and carries the new `number_of_replies`, so we patch the count
 * directly — no get_thread_details refetch.
 *
 * Patches ONLY threads already tracked in the store (a pill that's been viewed). Threads
 * the user hasn't opened are ignored here; their count is fetched fresh on first view, and
 * their unread state is handled separately (the sidebar badge — piece C).
 *
 * Mounted once at the shell.
 */
export const useThreadsRealtime = () => {
    const { name } = useUserCookieData()
    const currentUser = name

    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as ThreadCall

    // Broadcast to everyone — keeps the "N replies" pill live for all channel members.
    useFrappeEventListener("thread_reply", (event: ThreadReplyEvent) => {
        if (!event?.channel_id) return
        // Count → threadMetaStore (the list + pill read it there); order → list windows.
        threadMetaStore.patch(event.channel_id, event.number_of_replies, event.last_message_timestamp)
        threadListStore.bump(event.channel_id, event.last_message_timestamp)
        // bump only reorders rows a view already has. If a loaded view is missing
        // this thread (it's brand new — often the user's OWN new thread, which the
        // unread backstop never sees), refetch that view's page 0 so the row shows
        // up. Each (view, thread) pair is only tried once, so a busy thread that
        // doesn't belong in a view can't keep triggering fetches.
        reconcileUnknownThread(client, event.channel_id)
    })

    // Scoped to the thread's participants — marks a thread unread for the sidebar badge.
    // Skip our own replies; the store skips the thread the user is actively reading, and
    // reading a thread clears it (useChannelReadTracker).
    useFrappeEventListener("raven:unread_thread_count_updated", (event: UnreadThreadEvent) => {
        if (!event?.channel_id || event.sent_by === currentUser) return
        unreadThreadsStore.add(event.channel_id)
    })
}
