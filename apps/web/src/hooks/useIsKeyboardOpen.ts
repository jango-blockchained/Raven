import { useEffect, useState } from "react"

const isEditable = (el: Element | null): boolean =>
    !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)

/**
 * True while the on-screen keyboard is (likely) open.
 *
 * iOS keeps `env(safe-area-inset-bottom)` reporting the home-indicator inset even when the
 * keyboard covers that area, so composer padding meant to clear the indicator turns into dead
 * space floating above the keyboard. Consumers drop that padding when this returns true.
 *
 * Primary signal is focus: whenever an editable element (input / textarea / contenteditable —
 * the TipTap composer) is focused, the keyboard is up. The visualViewport shrink is used as a
 * secondary signal because focus alone can miss hardware-keyboard / split-view cases. Focus is
 * what makes this reliable in a standalone iOS PWA, where the viewport-resize math is flaky
 * (innerHeight can shrink with the keyboard, and page scroll eats the gap).
 */
export function useIsKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const vv = window.visualViewport

        const compute = () => {
            const gap = vv ? window.innerHeight - vv.height - vv.offsetTop : 0
            setOpen(isEditable(document.activeElement) || gap > 120)
        }

        compute()
        document.addEventListener("focusin", compute)
        // focusout fires before the next element gains focus, so defer the read a tick.
        const onFocusOut = () => setTimeout(compute, 0)
        document.addEventListener("focusout", onFocusOut)
        vv?.addEventListener("resize", compute)
        vv?.addEventListener("scroll", compute)

        return () => {
            document.removeEventListener("focusin", compute)
            document.removeEventListener("focusout", onFocusOut)
            vv?.removeEventListener("resize", compute)
            vv?.removeEventListener("scroll", compute)
        }
    }, [])

    return open
}
