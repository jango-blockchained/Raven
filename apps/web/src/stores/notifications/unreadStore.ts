type Listener = () => void

/**
 * The set of message ids that carry an UNREAD notification (a mention of you, or a
 * reaction on your message) — the source of the sidebar/page notification badge.
 *
 * Mirrors unreadThreadsStore: the badge is just the set's size, so no counts are kept.
 * Kept live client-side: `raven_mention` / `raven_reaction_notification` events add ids,
 * viewing the message in the stream removes it (see markNotificationsReadOnView), the
 * `message_notifications_read` echo keeps other tabs in sync, and
 * get_unread_notification_message_ids reconciles on mount / focus / reconnect.
 */
class UnreadNotificationsStore {
    private unread = new Set<string>()
    private listeners = new Set<Listener>()

    /** Badge count — primitive snapshot, safe per render. */
    getCount(): number {
        return this.unread.size
    }

    /** O(1) membership probe for the read tracker's in-view path (imperative, not a snapshot). */
    has(messageID: string): boolean {
        return this.unread.has(messageID)
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    /** A new mention/reaction notification arrived for this message. */
    add(messageID: string) {
        if (!messageID || this.unread.has(messageID)) return
        this.unread.add(messageID)
        this.notify()
    }

    /** Notifications for these messages were read (locally or echoed from another tab). */
    remove(messageIDs: string[]) {
        let changed = false
        for (const id of messageIDs) {
            if (this.unread.delete(id)) changed = true
        }
        if (changed) this.notify()
    }

    /** Replace with the server's authoritative set (get_unread_notification_message_ids). */
    reconcile(messageIDs: string[]) {
        const next = new Set(messageIDs)
        if (next.size === this.unread.size && [...next].every((id) => this.unread.has(id))) return
        this.unread = next
        this.notify()
    }

    /** mark_all_notifications_read. */
    clear() {
        if (this.unread.size === 0) return
        this.unread.clear()
        this.notify()
    }

    private notify() {
        this.listeners.forEach((listener) => listener())
    }
}

export const unreadNotificationsStore = new UnreadNotificationsStore()

/** Minimal client shape — `call` from FrappeContext. */
type PostClient = { post: (method: string, params?: Record<string, unknown>) => Promise<unknown> }

/** How long after the last notified message scrolls into view before the batch is flushed. */
const FLUSH_DELAY = 1000

let pendingIDs = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Mark a message's notifications read because it scrolled into view. O(1) no-op for the
 * ~all messages that carry no unread notification. Optimistic: the id leaves the store
 * (badge ticks down) immediately; ids are batched and flushed as ONE
 * mark_message_notifications_read call. On failure the ids are put back — the next
 * focus/reconnect reconcile is the backstop either way.
 */
export const markNotificationsReadOnView = (client: PostClient, messageID: string) => {
    if (!unreadNotificationsStore.has(messageID)) return
    unreadNotificationsStore.remove([messageID])
    pendingIDs.add(messageID)
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
        const batch = [...pendingIDs]
        pendingIDs = new Set()
        client
            .post("raven.api.notifications.mark_message_notifications_read", { message_ids: batch })
            .catch(() => {
                // Revert so the badge doesn't lie; the server echo / reconcile reconverges.
                for (const id of batch) unreadNotificationsStore.add(id)
            })
    }, FLUSH_DELAY)
}
