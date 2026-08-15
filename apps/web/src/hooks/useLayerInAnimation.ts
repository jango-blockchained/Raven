import { useEffect, useState } from "react"
import { useNavigationType } from "react-router-dom"

/**
 * The `animate-layer-in` class for a mobile page layer — or nothing, when the
 * layer must appear WITHOUT the slide.
 *
 * Why it exists: the slide-in restarts on a fresh mount, not just on a
 * hidden→visible flip. Navigating away from a layer host (e.g. thread →
 * "Go to channel") unmounts the whole page; the OS back-swipe then REMOUNTS
 * it with the layer already open — and the slide played again on top of the
 * OS's own back animation. Going back must be instant (the OS already
 * animated it), so a layer that is open at mount time via a POP renders
 * without the class. Once the layer hides, the class is put back (while
 * display:none, so nothing plays) and the next real open slides as usual.
 */
export const useLayerInAnimation = (visible: boolean): string | undefined => {
    const navigationType = useNavigationType()
    const [armed, setArmed] = useState(() => !(visible && navigationType === "POP"))

    useEffect(() => {
        if (!visible && !armed) setArmed(true)
    }, [visible, armed])

    return armed ? "animate-layer-in" : undefined
}
