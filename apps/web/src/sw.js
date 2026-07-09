// Push-only service worker for v3 web. No offline caching, and — unlike v2 —
// NO Firebase: Raven Cloud sends data-only FCM messages, which arrive here as
// standard Web Push events. firebase-messaging-sw's only jobs (parse payload,
// skip display when a tab is visible, show the notification) are ~40 lines, so
// we do them ourselves. That removes the CDN importScripts and the ?config=
// query-string dance — the SW URL is static, so it updates purely on code change.
//
// CONTRACT: the server must keep pushes DATA-ONLY (title/body inside `data`).
// A top-level `notification` key would rely on FCM SDK auto-display we no
// longer have.

// OFFLINE PRECACHE — DISABLED (push-only). vite-plugin-pwa injects the precache manifest
// at self.__WB_MANIFEST. With injectManifest.globPatterns = [] it injects [], so nothing
// is precached. To enable offline asset caching later:
//   1. yarn workspace @raven/web add -D workbox-precaching
//   2. set injectManifest.globPatterns in vite.config.ts (e.g. ["**/*.{js,css,html,svg,png,woff2}"])
//   3. uncomment the import + precacheAndRoute below
// import { precacheAndRoute } from "workbox-precaching"
// precacheAndRoute(self.__WB_MANIFEST)
const _precacheManifest = self.__WB_MANIFEST // injection point; inert while globs are empty
void _precacheManifest

self.addEventListener("push", (event) => {
    if (!event.data) return

    // FCM wraps the message as { data: {...}, from, priority, ... }
    let payload
    try {
        payload = event.data.json()
    } catch {
        return
    }
    const data = payload?.data ?? {}

    event.waitUntil(
        (async () => {
            // If the app is visible in some window, the realtime socket already
            // surfaced this message in-app — showing a system notification too
            // would double-notify. (Skipping display on a visible client is
            // also what firebase-messaging-sw does, so Chrome's userVisibleOnly
            // expectations are satisfied.) includeUncontrolled because our
            // scope (/assets/raven/raven_v3/) doesn't control the app's pages.
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
            if (windows.some((client) => client.visibilityState === "visible")) return

            // Raven Cloud flattens title/body into `data` for web pushes; the
            // notification-key fallback covers older payload shapes.
            const title = data.title || payload?.notification?.title
            if (!title) return

            /** @type {NotificationOptions} */
            const options = {
                body: data.body || payload?.notification?.body || "",
                // One notification per channel: a newer push replaces the older
                // one instead of stacking (matches the server's `tag` intent).
                tag: data.channel_id || undefined,
                // Fully-formed by the server (handles workspaces + threads).
                data: { url: data.message_url || data.click_action || data.base_url },
            }
            const icon = data.notification_icon || data.image
            if (icon) options.icon = icon
            if (data.raven_message_type === "Image" && data.content) options.image = data.content
            if (data.creation) options.timestamp = Number(data.creation)

            await self.registration.showNotification(title, options)
        })(),
    )
})

// The URL of the last clicked notification, held until the page ASKS for it.
// The postMessage fired at click time is lost when the window exists but its
// JS is FROZEN (a backgrounded iOS PWA) — focus() foregrounds the app, but the
// message lands in a suspended event loop. So the page also PULLS this on
// resume (visibilitychange → raven:consume-notification-click), with a
// MessageChannel port reply. Consumed = cleared, so it never re-fires.
let pendingNotificationClickUrl = null

self.addEventListener("message", (event) => {
    if (event.data?.type === "raven:consume-notification-click") {
        event.ports[0]?.postMessage({ url: pendingNotificationClickUrl })
        pendingNotificationClickUrl = null
    }
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const url = event.notification.data?.url
    if (!url) return

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
            const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
            if (existing) {
                // Our scope doesn't control app pages, so WindowClient.navigate()
                // would reject. Two delivery paths instead:
                //  - postMessage: instant, works when the page is live (desktop/Android)
                //  - pendingNotificationClickUrl: pulled by the page on resume,
                //    covering the frozen-PWA case where the postMessage is lost
                pendingNotificationClickUrl = url
                await existing.focus()
                existing.postMessage({ type: "raven:notification-click", url })
            } else {
                await self.clients.openWindow(url)
            }
        })(),
    )
})

// Activate updated SW versions immediately — there are no in-flight caches to
// coordinate. clients.claim() is pointless here (our scope controls no pages).
self.skipWaiting()
