import { useEffect } from "react"
import { channelUnreadStore } from "@stores/unread/store"
import { unreadThreadsStore } from "@stores/threads/unreadStore"

/**
 * Mirrors the unread total onto the app icon via the Badging API — iOS 16.4+
 * installed PWAs, Android and desktop Chromium; a silent no-op everywhere else.
 *
 * This covers the APP-RUNNING case only (the stores are live and reconcile reads
 * made on other devices). While the app is closed, sw.js sets the badge: it
 * supports an authoritative `unread_count` from the push payload, but the server
 * doesn't send one yet (TODO, server-side), so in practice the SW uses its
 * fallback — the count of displayed notifications. The two definitions differ,
 * which is fine while asleep; on every return to the app the resume re-sync
 * below re-imposes this hook's definition. Remaining gap: reading on desktop
 * with NO subsequent push leaves the badge stale until the next open — the same
 * trade WhatsApp ships; closing it needs badge-only pushes on read events
 * (Declarative Web Push, iOS 18.4+), which is server-side work.
 */
export const useAppBadge = () => {
    useEffect(() => {
        if (typeof navigator.setAppBadge !== "function") return
        // Channels + DMs + unread THREADS: pushes fire for thread replies too, so a
        // badge definition without threads would clear the icon while a thread the
        // user was notified about is still unread.
        const sync = () => {
            const total = channelUnreadStore.getTotalUnread() + unreadThreadsStore.getCount()
            if (total > 0) navigator.setAppBadge(total).catch(() => { })
            else navigator.clearAppBadge?.().catch(() => { })
        }
        sync()

        // Re-assert on RESUME, not just on store changes. While the page is frozen
        // (backgrounded PWA) the SW also writes the badge from pushes; if everything
        // gets read elsewhere before the user returns, the resume reconcile finds
        // the store already at 0 → no change → no store notification → the SW's
        // stale badge would survive. Becoming visible re-imposes the page's truth
        // unconditionally. No race with the focus reconcile that fires at the same
        // moment: both writers funnel through this same sync() and the reconcile
        // lands last (it's a network round trip) — if it changes the stores, the
        // subscriptions below re-sync with server truth; if it doesn't, the value
        // written here already WAS server truth.
        const onVisible = () => {
            if (document.visibilityState === "visible") sync()
        }
        document.addEventListener("visibilitychange", onVisible)
        const unsubscribeChannels = channelUnreadStore.subscribeGlobal(sync)
        const unsubscribeThreads = unreadThreadsStore.subscribe(sync)
        return () => {
            document.removeEventListener("visibilitychange", onVisible)
            unsubscribeChannels()
            unsubscribeThreads()
        }
    }, [])
}
