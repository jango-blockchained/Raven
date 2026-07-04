import { useFrappeGetCall } from "frappe-react-sdk"

/**
 * Whether the server can deliver push notifications (a push service / Frappe Cloud relay
 * is configured in Raven Settings). Used to hide push toggles entirely when it can't.
 * Defaults to false while loading, so gated UI appears once confirmed.
 */
export function useIsPushNotificationEnabled(): boolean {
    const { data } = useFrappeGetCall<{ message: boolean }>(
        "raven.api.notification.are_push_notifications_enabled",
        undefined,
        undefined,
        { revalidateIfStale: true, revalidateOnFocus: false, revalidateOnReconnect: false },
    )
    return data?.message ? true : false
}
