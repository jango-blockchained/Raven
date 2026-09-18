/**
 * In-app fan-out of the `raven_scheduled_message_updated` realtime event.
 *
 * Same reason as channelEvents: the SDK's listener cleanup removes every handler for
 * an event, so only one place may subscribe to the socket. That place is
 * useScheduledMessagesRealtime, mounted once in AppListeners. Anything else that
 * needs the signal subscribes here, and unmounting removes only its own callback.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/** Called by useScheduledMessagesRealtime only, the single socket subscriber. */
export const broadcastScheduledMessagesUpdated = () => {
    listeners.forEach((listener) => listener())
}

/** Subscribe to the rebroadcast signal. Returns the unsubscribe. */
export const subscribeToScheduledMessagesUpdated = (listener: Listener) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
