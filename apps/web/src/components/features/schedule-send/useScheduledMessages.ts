import { useFrappeEventListener, useFrappeGetCall, useSWRConfig } from "frappe-react-sdk"
import { broadcastScheduledMessagesUpdated } from "./scheduledMessageEvents"

/** SWR key for the badge count. Shares the list's prefix so one prefix mutate refreshes both. */
export const SCHEDULED_MESSAGES_COUNT_KEY = "scheduled-messages-count"

/**
 * The one socket subscriber for `raven_scheduled_message_updated`, mounted once in
 * AppListeners. The event carries no payload and is user-targeted. It refreshes the
 * badge count here and hands the signal to the bus, where the list decides whether
 * to refetch now or wait until an edit in progress is done.
 */
export const useScheduledMessagesRealtime = () => {
    const { mutate: globalMutate } = useSWRConfig()
    useFrappeEventListener("raven_scheduled_message_updated", () => {
        globalMutate(SCHEDULED_MESSAGES_COUNT_KEY)
        broadcastScheduledMessagesUpdated()
    })
}

/** Number of the session user's pending (Scheduled + Failed) rows — drives the sidebar badge. */
export const useScheduledMessagesCount = () => {
    const { data } = useFrappeGetCall<{ message: number }>(
        "raven.api.scheduled_message.get_scheduled_message_count",
        undefined,
        SCHEDULED_MESSAGES_COUNT_KEY,
    )
    return data?.message ?? 0
}
