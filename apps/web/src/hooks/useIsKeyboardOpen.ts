import { useEffect, useState } from "react"

/**
 * True while the on-screen keyboard is (likely) open, detected via the visualViewport API.
 *
 * iOS keeps `env(safe-area-inset-bottom)` reporting the home-indicator inset even when the
 * keyboard is covering that area, so composer padding meant to clear the indicator turns into
 * dead space floating above the keyboard. Consumers drop that padding when this returns true.
 *
 * Threshold is generous (100px) so the URL-bar show/hide shuffle — which only moves the visual
 * viewport a little — doesn't get mistaken for the keyboard (~250-300px).
 */
export function useIsKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return

        const onChange = () => {
            // The keyboard occupies the gap between the layout viewport and the (shrunk,
            // possibly offset) visual viewport.
            const gap = window.innerHeight - vv.height - vv.offsetTop
            setOpen(gap > 100)
        }

        onChange()
        vv.addEventListener("resize", onChange)
        vv.addEventListener("scroll", onChange)
        return () => {
            vv.removeEventListener("resize", onChange)
            vv.removeEventListener("scroll", onChange)
        }
    }, [])

    return open
}
