import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { consumePendingNotificationClick } from "@lib/push"

/**
 * Routes push-notification clicks client-side. The SW hands the page the
 * target URL (client.navigate() would be a full reload), on TWO paths — both
 * land here:
 *
 *  1. postMessage at click time — instant, works while the page is live
 *     (desktop, Android, foreground-adjacent states).
 *  2. Pull on load/resume — covers the states where path 1 can't deliver:
 *     a FROZEN backgrounded iOS PWA (the message dies in a suspended event
 *     loop) and the COLD open (the SW deliberately opens the app root, not the
 *     deep URL — see sw.js notificationclick — so the swipe-back stack stays
 *     sane; this pull then does the in-app jump). Consuming clears the stored
 *     copy, so between the two paths a click navigates once.
 */
export const usePushNotificationNavigation = () => {
    const navigate = useNavigate()

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return

        const navigateToUrl = (rawUrl: string) => {
            let target: URL
            try {
                target = new URL(rawUrl)
            } catch {
                return
            }
            if (target.origin !== window.location.origin) return

            // Strip the router basename (e.g. /raven) — navigate() re-adds it.
            let path = target.pathname
            const base = import.meta.env.VITE_BASE_NAME
            if (base && path.startsWith(`/${base}`)) path = path.slice(base.length + 1) || "/"

            navigate(path + target.search + target.hash)
        }

        const consumePending = () => {
            consumePendingNotificationClick().then((url) => {
                if (url) navigateToUrl(url)
            })
        }

        // Path 1: live-page delivery. Also consume, so the stored copy is cleared.
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== "raven:notification-click" || !event.data.url) return
            navigateToUrl(event.data.url)
            consumePendingNotificationClick()
        }

        // Path 2: frozen-page delivery — pull when the app thaws.
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") consumePending()
        }

        navigator.serviceWorker.addEventListener("message", onMessage)
        document.addEventListener("visibilitychange", onVisibilityChange)
        consumePending()
        return () => {
            navigator.serviceWorker.removeEventListener("message", onMessage)
            document.removeEventListener("visibilitychange", onVisibilityChange)
        }
    }, [navigate])
}
