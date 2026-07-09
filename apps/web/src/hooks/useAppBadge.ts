import { useEffect } from "react"
import { channelUnreadStore } from "@stores/unread/store"

/**
 * Mirrors the unread total onto the app icon via the Badging API — iOS 16.4+
 * installed PWAs, Android and desktop Chromium; a silent no-op everywhere else.
 *
 * This covers the APP-RUNNING case only (the store is live and reconciles reads
 * made on other devices). While the app is closed, sw.js sets the badge from
 * the push payload's `unread_count` — an authoritative server total, so every
 * arriving push re-syncs the badge, correcting for messages read elsewhere in
 * the meantime. The one gap: reading on desktop with NO subsequent push leaves
 * the badge stale until the next open — the same trade WhatsApp ships; closing
 * it needs badge-only pushes on read events (Declarative Web Push, iOS 18.4+),
 * which is server-side work.
 */
export const useAppBadge = () => {
    useEffect(() => {
        if (typeof navigator.setAppBadge !== "function") return
        const sync = () => {
            const total = channelUnreadStore.getTotalUnread()
            if (total > 0) navigator.setAppBadge(total).catch(() => { })
            else navigator.clearAppBadge?.().catch(() => { })
        }
        sync()
        return channelUnreadStore.subscribeGlobal(sync)
    }, [])
}
