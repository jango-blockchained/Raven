import { useEffect, useState } from "react"
import { useAtomValue } from "jotai"
import { getQuietHoursConfig, quietHoursNudgeAtom } from "@utils/preferences"
import { isInQuietHours } from "@utils/quietHours"

/**
 * Reactive "are we in quiet hours right now" — re-evaluated once a minute and
 * on tab visibility (a phone waking hours later must not keep the stale
 * answer). When the org hasn't configured quiet hours, no timer runs and this
 * is constant false.
 */
export const useIsInQuietHours = (): boolean => {
    const [quiet, setQuiet] = useState(isInQuietHours)

    useEffect(() => {
        if (!getQuietHoursConfig()) return
        const update = () => setQuiet(isInQuietHours())
        const interval = window.setInterval(update, 60_000)
        document.addEventListener("visibilitychange", update)
        return () => {
            window.clearInterval(interval)
            document.removeEventListener("visibilitychange", update)
        }
    }, [])

    return quiet
}

export type QuietSendMode = "nudge" | "auto" | undefined

/**
 * The composer's quiet-hours mode, combining the org clock with the user's
 * preference: "nudge" advertises silent sending, "auto" flips the send
 * default to silent, undefined = leave sends alone (not quiet time, feature
 * off, or the user opted out).
 */
export const useQuietSendMode = (): QuietSendMode => {
    const quiet = useIsInQuietHours()
    const preference = useAtomValue(quietHoursNudgeAtom)
    if (!quiet || preference === "No Nudge") return undefined
    return preference === "Auto Silent" ? "auto" : "nudge"
}
