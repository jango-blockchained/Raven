/**
 * Answers one question: "has the realtime connection broken since this channel's
 * messages were fetched?"
 *
 * Why it matters: an open channel's messages are kept up to date by socket events.
 * When the socket drops — which happens every time a phone locks or the PWA goes to
 * the background — the events from that gap are lost forever. Missing NEW messages
 * could be detected by asking the server "anything after X?", but a missed reaction,
 * edit or delete changes an EXISTING message and leaves no trace. The only way to
 * know is to remember that a gap happened, and refetch.
 *
 * How it works:
 *  - `epoch` is a counter that goes up by one every time the connection breaks
 *    (useConnectionFreshness decides when that is).
 *  - Whenever a channel's messages are fetched, the channel is stamped with the
 *    counter's value at that moment (markWindowFresh).
 *  - If a channel's stamp is older than the counter, a break happened after its
 *    fetch — its messages might be missing something (isWindowStale), and
 *    reconcileStaleWindow (loaders.ts) refetches them to be sure.
 *
 * While the connection never breaks, the counter never moves, every stamp matches,
 * and none of this costs a single extra request.
 */

let epoch = 1
const listeners = new Set<() => void>()

/** Current value of the break counter. */
export const getConnectionEpoch = () => epoch

/** Record a connection break: every channel fetched before this moment becomes
 *  suspect. Also notifies subscribers, so channels on screen refetch right away. */
export const bumpConnectionEpoch = () => {
    epoch += 1
    for (const listener of listeners) listener()
}

/** Runs `listener` on every recorded break. The channel currently on screen uses
 *  this to refetch immediately — it can't wait for a "next open" that won't come. */
export const subscribeConnectionEpoch = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** The counter value each channel was stamped with at its last fetch. */
const windowEpochs = new Map<string, number>()

/** Stamp a channel as up to date. Pass the counter value read BEFORE the fetch
 *  started: if the connection broke while the request was running, the response
 *  is from before the break, and the channel should stay suspect. */
export const markWindowFresh = (channelID: string, epochAtFetchStart: number) => {
    windowEpochs.set(channelID, epochAtFetchStart)
}

/** True if the connection has broken since this channel was last fetched
 *  (or it was never stamped at all). */
export const isWindowStale = (channelID: string) => (windowEpochs.get(channelID) ?? 0) < epoch
