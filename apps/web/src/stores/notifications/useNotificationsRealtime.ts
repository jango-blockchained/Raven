import { useContext } from "react"
import { FrappeConfig, FrappeContext, useFrappeEventListener, useSWRConfig } from "frappe-react-sdk"
import { UNREAD_NOTIFICATION_IDS_KEY } from "@hooks/useNotifications"
import { notificationListStore } from "./store"
import { unreadNotificationsStore } from "./unreadStore"
import { reconcileFirstPage, type NotificationCall } from "./loaders"

/**
 * Global notifications realtime, mounted once in AppListeners. The list-affecting events
 * carry no row data, so a new mention/reaction triggers a page-0 reconcile of every loaded
 * view that could contain it. The read events flip is_read in place across all views.
 *
 * The badge is the unread-id SET's size (unreadNotificationsStore) — events apply to it
 * locally (add / remove / clear) with no count refetch. The only refetch left is the ids
 * reconcile on a reaction REMOVAL, where the client can't know whether the message still
 * has other unread reactions.
 */
export const useNotificationsRealtime = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as NotificationCall
    const { mutate: globalMutate } = useSWRConfig()

    // Reconcile page 0 of every loaded view that could hold this type (skip views filtered to
    // the other type). The reconcile is a no-op (same ref) where page 0 didn't change.
    const onNewNotification = (notificationType: "mention" | "reaction") => {
        for (const { viewKey, filters } of notificationListStore.loadedViews()) {
            if (filters.notificationType && filters.notificationType !== notificationType) continue
            reconcileFirstPage(client, viewKey, filters)
        }
    }

    useFrappeEventListener("raven_mention", (event: { message_id?: string }) => {
        if (event.message_id) unreadNotificationsStore.add(event.message_id)
        onNewNotification("mention")
    })

    useFrappeEventListener(
        "raven_reaction_notification",
        (event: { message_id?: string; removed?: boolean }) => {
            if (event.removed) {
                // An unreact: the message may or may not still carry other unread
                // reactions — refetch the authoritative id set instead of guessing.
                globalMutate(UNREAD_NOTIFICATION_IDS_KEY)
            } else if (event.message_id) {
                unreadNotificationsStore.add(event.message_id)
            }
            onNewNotification("reaction")
        },
    )

    // Batched echo from mark_message_notifications_read — our own flush and other tabs'.
    useFrappeEventListener("message_notifications_read", (event: { message_ids?: string[] }) => {
        const ids = event.message_ids ?? []
        unreadNotificationsStore.remove(ids)
        for (const id of ids) notificationListStore.markMessageRead(id)
    })

    useFrappeEventListener("all_notifications_read", () => {
        notificationListStore.markAllRead()
        unreadNotificationsStore.clear()
    })
}
