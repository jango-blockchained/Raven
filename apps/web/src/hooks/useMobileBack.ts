import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Back action for mobile headers. Pops browser history when there's an in-app entry to
 * return to — so back always lands wherever the user actually came from (channel list,
 * DM list, notifications), matching the OS back-swipe. On a cold start (deep link / PWA
 * launched straight into a chat) there's no in-app history, so it uses `fallback`:
 * a route to go to, or a function (e.g. a pane's close handler).
 */
export function useMobileBack(fallback: string | (() => void)) {
    const navigate = useNavigate()
    return useCallback(() => {
        // React Router tracks its position in history.state.idx — 0 means this is the
        // first in-app entry, and going back would leave the app.
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (idx > 0) {
            navigate(-1)
        } else if (typeof fallback === "function") {
            fallback()
        } else {
            navigate(fallback, { replace: true })
        }
    }, [navigate, fallback])
}
