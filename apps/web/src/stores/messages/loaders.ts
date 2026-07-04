import { channelMessagesStore } from "./store"
import { channelUnreadStore } from "@stores/unread/store"
import { channelStore } from "@stores/channels/store"
import { MessagesPage } from "./types"

const PAGE_SIZE = 30

/** Minimal client shape — `call` from FrappeContext. */
export type FrappeCallClient = {
    get: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

type PageResponse = { message: MessagesPage }

const inFlight = new Set<string>()

/**
 * IO layer: fetches pages and feeds them to the store.
 * Responses always apply to the channel they were requested for,
 * so a channel switch mid-flight cannot corrupt another channel's state.
 */

/** In-flight initial loads, keyed by channel + anchor message. If the same load is
 *  requested twice, the second caller gets the first call's promise — so awaiting it
 *  always means "that fetch has finished", never "someone else is fetching". */
const inFlightInitial = new Map<string, Promise<void>>()

/**
 * Several things can request a channel's first page at almost the same time (a sidebar
 * hover prefetch, the stream mounting, a jump to a specific message). Their responses
 * come back in any order, and simply applying whichever lands last let a stale response
 * overwrite the page the user actually asked for. So: each request takes a number, and
 * a response is only applied if its number is still the channel's newest. Older
 * responses are thrown away.
 */
const windowIntent = new Map<string, number>()

/**
 * Channels where the user is currently being navigated to a specific message (deep
 * link / notification / reply click). While a channel is in this map, "plain" first-page
 * loads (ones not centered on a message) are refused entirely — they would replace the
 * page containing the target with the latest page and break the navigation. Set by
 * ChatStream; removed when the user leaves the channel or clicks "jump to present".
 */
const targetClaims = new Map<string, string>()

export const claimWindowForTarget = (channelID: string, messageID: string) => {
    targetClaims.set(channelID, messageID)
}

export const releaseWindowClaim = (channelID: string) => {
    targetClaims.delete(channelID)
}

/** Loads the window — latest messages, or around `baseMessage` when jumping to one.
 *  Resolves when the fetch has settled (page applied, discarded as stale, or failed). */
export const loadInitialMessages = (
    client: FrappeCallClient,
    channelID: string,
    baseMessage?: string,
): Promise<void> => {
    // The user is being navigated to a specific message in this channel — a plain
    // (uncentered) load would replace that page, so refuse it (see targetClaims).
    if (!baseMessage && targetClaims.has(channelID)) {
        return Promise.resolve()
    }

    // Keyed per anchor message, so a jump-to-message isn't mistaken for a duplicate of a
    // plain load that's already in flight (and vice versa).
    const key = `${channelID}:initial:${baseMessage ?? ""}`
    const existing = inFlightInitial.get(key)
    if (existing) return existing

    // Take the channel's next request number. If another initial load starts after this
    // one, ours becomes stale and its response will be thrown away (see windowIntent).
    const token = (windowIntent.get(channelID) ?? 0) + 1
    windowIntent.set(channelID, token)

    channelMessagesStore.startLoading(channelID)
    const run = (async () => {
        try {
            const response = await client.get<PageResponse>("raven.api.chat_stream.get_messages", {
                channel_id: channelID,
                limit: PAGE_SIZE,
                base_message: baseMessage,
                // We track last_visit ourselves (useChannelReadTracker), so the fetch must
                // not also write it — that GET-time write can deadlock with a concurrent send.
                update_last_visit: false,
                // Center the window on the first unread message (for the "New messages" divider)
                // unless we're jumping to a specific message — an explicit jump wins.
                anchor_to_unread: !baseMessage,
            })
            // A newer initial load started while we were fetching — discard this response.
            if (windowIntent.get(channelID) !== token) return
            channelMessagesStore.setInitialPage(channelID, response.message)
            // Baseline the read tracker with the server's last_visit so it won't re-post a
            // watermark already recorded (opening a caught-up channel writes nothing).
            channelUnreadStore.setServerWatermark(channelID, response.message.last_visit)
        } catch (error) {
            // Same staleness rule for failures — don't show an error for a superseded fetch.
            if (windowIntent.get(channelID) !== token) return
            channelMessagesStore.failLoading(channelID, errorMessage(error))
        } finally {
            inFlightInitial.delete(key)
        }
    })()
    inFlightInitial.set(key, run)
    return run
}

/**
 * Hover/highlight prefetch: warms a COLD channel's first page into the same store ChatStream
 * reads, so opening it skips the loading skeleton. No-op unless the id is a real channel/DM
 * (so a Command-menu user/settings value is ignored) and its window is still idle — a warm or
 * loading channel must not be reset. Idempotent via loadInitialMessages' inFlight guard.
 */
export const prefetchChannel = (client: FrappeCallClient, channelID: string) => {
    if (!channelID) return
    if (!channelStore.getChannel(channelID)) return
    if (channelMessagesStore.getState(channelID).status !== "idle") return
    loadInitialMessages(client, channelID)
}

export const loadOlderMessages = async (client: FrappeCallClient, channelID: string) => {
    if (!channelMessagesStore.beginPagination(channelID, "older")) return
    const oldestID = channelMessagesStore.getState(channelID).order[0]
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_older_messages", {
            channel_id: channelID,
            from_message: oldestID,
            limit: PAGE_SIZE,
        })
        channelMessagesStore.setOlderPage(channelID, response.message)
    } catch {
        channelMessagesStore.endPagination(channelID, "older")
    }
}

export const loadNewerMessages = async (client: FrappeCallClient, channelID: string) => {
    if (!channelMessagesStore.beginPagination(channelID, "newer")) return
    const state = channelMessagesStore.getState(channelID)
    const newestID = state.order[state.order.length - 1]
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_newer_messages", {
            channel_id: channelID,
            from_message: newestID,
            limit: PAGE_SIZE,
            // last_visit is tracked client-side; don't let the fetch write it (deadlock risk).
            update_last_visit: false,
        })
        channelMessagesStore.setNewerPage(channelID, response.message)
    } catch {
        channelMessagesStore.endPagination(channelID, "newer")
    }
}

/**
 * Recovers messages that landed while the socket was disconnected, for a window
 * pinned to the live edge. Unlike loadNewerMessages this isn't gated on
 * hasNewerMessages (a live-edge window has none "known"); it fetches strictly
 * after the newest message and merges, so it appends in place — no window
 * replacement, no scroll jump. Detached/idle windows are skipped (they resync on
 * their own when the user returns).
 */
export const catchUpNewerMessages = async (client: FrappeCallClient, channelID: string) => {
    const state = channelMessagesStore.getState(channelID)
    if (state.status !== "ready" || state.hasNewerMessages) return
    const newestID = state.order[state.order.length - 1]
    if (!newestID) return
    const key = `${channelID}:catchup`
    if (inFlight.has(key)) return
    inFlight.add(key)
    try {
        const response = await client.get<PageResponse>("raven.api.chat_stream.get_newer_messages", {
            channel_id: channelID,
            from_message: newestID,
            limit: PAGE_SIZE,
            // last_visit is tracked client-side; don't let the fetch write it (deadlock risk).
            update_last_visit: false,
        })
        channelMessagesStore.setNewerPage(channelID, response.message)
    } catch {
        // Best effort — a failed catch-up just leaves the window stale until the user acts
    } finally {
        inFlight.delete(key)
    }
}

/** Discards the detached window and refetches the live edge. */
export const jumpToLatestMessages = async (client: FrappeCallClient, channelID: string) => {
    // The user explicitly asked for the latest messages — lift the "navigating to a
    // message" claim first, or the plain load below would be refused.
    releaseWindowClaim(channelID)
    channelMessagesStore.reset(channelID)
    await loadInitialMessages(client, channelID)
}

const errorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    return "Failed to load messages"
}
