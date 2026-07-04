import { useCallback, useState } from "react"
import { useFrappeAuth, useSWRConfig, type FrappeError } from "frappe-react-sdk"
import { useSetAtom } from "jotai"
import { toast } from "sonner"
import { lastChannelAtom, lastWorkspaceAtom } from "@utils/lastVisitedAtoms"
import { getErrorMessage } from "@lib/frappe"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"

/**
 * Logs the user out and returns them to Frappe's login page. Ported from the legacy
 * UserProvider.handleLogout: reset last-visited pointers, drop the app cache, best-effort
 * disable push, clear the SWR cache (keep the boot context so re-login rehydrates), then
 * hard-redirect so boot info is fetched fresh.
 */
export function useLogout(): { logout: () => Promise<void>; isLoggingOut: boolean } {
    const { logout: frappeLogout } = useFrappeAuth()
    const { mutate } = useSWRConfig()
    const setLastWorkspace = useSetAtom(lastWorkspaceAtom)
    const setLastChannel = useSetAtom(lastChannelAtom)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const logout = useCallback(async () => {
        setIsLoggingOut(true)
        setLastWorkspace("")
        setLastChannel("")
        localStorage.removeItem("app-cache")

        // Best-effort: stop this device receiving pushes for a logged-out session.
        try {
            // @ts-expect-error - frappePushNotification is injected in main.tsx
            await window.frappePushNotification?.disableNotification?.()
        } catch (e) {
            console.error("Failed to disable push notifications on logout", e)
        }

        try {
            await frappeLogout()
            // Clear every SWR key except the boot context (re-fetched on the reload below).
            await mutate((key) => key !== "raven.api.login.get_context", undefined, false)
            const base = import.meta.env.VITE_BASE_NAME
            window.location.replace(base ? `/${base}/login` : "/login")
        } catch (e) {
            setIsLoggingOut(false)
            errorResponseToast(_("Could not log out"), e as FrappeError)
        }
    }, [frappeLogout, mutate, setLastWorkspace, setLastChannel])

    return { logout, isLoggingOut }
}
