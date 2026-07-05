import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Routes push-notification clicks client-side. When a notification is clicked
 * and an app window already exists, sw.js focuses it and posts
 * { type: "raven:notification-click", url } instead of opening a new tab
 * (it can't call WindowClient.navigate() — its scope doesn't control our pages).
 * We translate the absolute URL into a router path so the channel opens without
 * a full page reload.
 */
export const usePushNotificationNavigation = () => {
    const navigate = useNavigate()

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== "raven:notification-click" || !event.data.url) return
            let target: URL
            try {
                target = new URL(event.data.url)
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

        navigator.serviceWorker.addEventListener("message", onMessage)
        return () => navigator.serviceWorker.removeEventListener("message", onMessage)
    }, [navigate])
}
