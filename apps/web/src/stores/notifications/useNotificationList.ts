import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react"
import { FrappeConfig, FrappeContext, useSWRConfig } from "frappe-react-sdk"
import { UNREAD_NOTIFICATION_IDS_KEY } from "@hooks/useNotifications"
import { subscribeConnectionEpoch } from "@stores/connectionFreshness"
import { notificationListStore, type NotificationFilters, type NotificationTab } from "./store"
import { unreadNotificationsStore } from "./unreadStore"
import { selectNotificationRows } from "./selectors"
import {
    loadInitialNotifications,
    loadMoreNotifications,
    reconcileFirstPage,
    reconcileViewIfStale,
    type NotificationCall,
} from "./loaders"

/** How long a read row stays in the unread view before it starts sliding out.
 *  Long enough to register as "done", short enough that a stale row never
 *  reads as a bug. */
const LEAVE_LINGER_MS = 700
/** Row exit animation length — must match the row's CSS `duration-300`. */
const LEAVE_EXIT_MS = 300

/**
 * Reads the notifications window for the active `type` (all/mention/reaction) + unread
 * toggle. Each filter combo is its OWN server-filtered, paginated window (keyed
 * `<type>[:unread]`), so the unread toggle and the tabs are complete and never stall.
 * The window is also filtered client-side so reading a notification removes it from the
 * unread view live; `loadMore` paginates the server slice lazily.
 */
export const useNotificationList = (
    type: NotificationTab,
    { unreadOnly, activeMessageID }: { unreadOnly: boolean; activeMessageID?: string },
) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const client = call as NotificationCall
    const { mutate: globalMutate } = useSWRConfig()

    const viewKey = `${type}${unreadOnly ? ":unread" : ""}`
    const filters: NotificationFilters = useMemo(
        () => ({ notificationType: type === "all" ? undefined : type, unreadOnly }),
        [type, unreadOnly],
    )

    const state = useSyncExternalStore(
        useCallback((onChange) => notificationListStore.subscribe(viewKey, onChange), [viewKey]),
        () => notificationListStore.getState(viewKey),
    )

    useEffect(() => {
        loadInitialNotifications(client, viewKey, filters)
    }, [client, viewKey, filters])

    // The load above heals staleness on OPEN — but the connection can also break
    // while the user is sitting on the page (lock the phone on it, come back).
    // While this view is mounted, reconcile as soon as a break is recorded.
    useEffect(
        () => subscribeConnectionEpoch(() => reconcileViewIfStale(client, viewKey, filters)),
        [client, viewKey, filters],
    )

    // Sticky-then-leave unread view. A row the user is LOOKING at must not vanish
    // the moment it's read — the unread filter applies to rows entering the view,
    // not ones already displayed — so every row seen unread here is remembered and
    // survives the filter (seenUnreadRef). But a row the user ACTED ON must not
    // stay forever either: once they've moved on (it isn't the open notification),
    // it lingers briefly, animates closed (leavingIds drives the row's collapse
    // transition), and is then dropped from the kept set so the filter removes it.
    // The open notification itself is exempt while it stays open — and re-opening
    // a row mid-exit cancels its departure.
    const seenUnreadRef = useRef<Set<string>>(new Set())
    // Only EXPLICIT actions enter the leave pipeline: clicking a notification
    // open, swiping it read, or Mark all as read — all of which pass through the
    // handlers below, which record the message ids here. Rows read PASSIVELY
    // (their message scrolled into view in the side pane while the user read
    // something else) never leave — they just render as read. The departure
    // animation is a receipt for something the user did; several rows vanishing
    // because of a scroll reads as a bug.
    const explicitlyReadRef = useRef<Set<string>>(new Set())
    // Rows currently playing their exit animation (rendered collapsed).
    const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(() => new Set())
    // Two timers per leaving row: start the animation, then actually remove.
    const leaveTimersRef = useRef<Map<string, [number, number]>>(new Map())
    // seenUnreadRef is a ref, so dropping a row from it needs an explicit bump
    // for the rows memo below to recompute.
    const [keptVersion, bumpKeptVersion] = useReducer((version: number) => version + 1, 0)

    // Reset synchronously when the tab/filter changes (an effect would leave one
    // stale frame), which re-applies the filter cleanly.
    const seenViewKeyRef = useRef(viewKey)
    if (seenViewKeyRef.current !== viewKey) {
        seenViewKeyRef.current = viewKey
        seenUnreadRef.current = new Set()
        explicitlyReadRef.current = new Set()
        for (const [start, finish] of leaveTimersRef.current.values()) {
            window.clearTimeout(start)
            window.clearTimeout(finish)
        }
        leaveTimersRef.current.clear()
        // Render-phase state update — React restarts this render with the clean set.
        if (leavingIds.size > 0) setLeavingIds(new Set())
    }

    const rows = useMemo(() => {
        const selected = selectNotificationRows(state, { type, unreadOnly, keepIds: seenUnreadRef.current })
        if (unreadOnly) {
            for (const row of selected) {
                if (!row.is_read) seenUnreadRef.current.add(row.name)
            }
        }
        return selected
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keptVersion IS the seenUnreadRef dependency
    }, [state, type, unreadOnly, keptVersion])

    // Call-time mirror of rows for markAllRead (a stable callback can't list
    // rows as a dependency without re-creating on every store change).
    const rowsRef = useRef(rows)
    rowsRef.current = rows

    // The leave scheduler: any displayed row that is read and NOT the open
    // notification gets its exit scheduled; becoming the open notification again
    // cancels it. Runs against the full row window, but timers are only ever
    // created once per row and clean up after themselves.
    useEffect(() => {
        if (!unreadOnly) return
        for (const row of rows) {
            if (!row.is_read) continue
            // Passively-read rows stay — see explicitlyReadRef above.
            if (!explicitlyReadRef.current.has(row.message_id)) continue
            const isOpen = !!activeMessageID && row.message_id === activeMessageID
            const timers = leaveTimersRef.current.get(row.name)
            if (isOpen) {
                if (timers) {
                    window.clearTimeout(timers[0])
                    window.clearTimeout(timers[1])
                    leaveTimersRef.current.delete(row.name)
                    setLeavingIds((prev) => {
                        if (!prev.has(row.name)) return prev
                        const next = new Set(prev)
                        next.delete(row.name)
                        return next
                    })
                }
                continue
            }
            if (timers) continue
            const start = window.setTimeout(() => {
                setLeavingIds((prev) => new Set(prev).add(row.name))
            }, LEAVE_LINGER_MS)
            const finish = window.setTimeout(() => {
                leaveTimersRef.current.delete(row.name)
                seenUnreadRef.current.delete(row.name)
                setLeavingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(row.name)
                    return next
                })
                bumpKeptVersion()
            }, LEAVE_LINGER_MS + LEAVE_EXIT_MS)
            leaveTimersRef.current.set(row.name, [start, finish])
        }
    }, [rows, unreadOnly, activeMessageID])

    // Unmount only: pending exits die with the view.
    useEffect(() => () => {
        for (const [start, finish] of leaveTimersRef.current.values()) {
            window.clearTimeout(start)
            window.clearTimeout(finish)
        }
    }, [])

    const loadMore = useCallback(() => {
        loadMoreNotifications(client, viewKey, filters)
    }, [client, viewKey, filters])

    // Optimistic update + POST only. The server fires message_notifications_read /
    // all_notifications_read back to us (user-scoped), and useNotificationsRealtime
    // applies that echo to the unread-id store (idempotent after our optimistic write).
    // On failure there's no echo, so we reconcile the page + the id set.
    const markMessageRead = useCallback(
        (messageId: string) => {
            // Both explicit gestures (click-open, swipe-read) land here — recording
            // the id is what admits the row to the leave pipeline above.
            explicitlyReadRef.current.add(messageId)
            notificationListStore.markMessageRead(messageId) // optimistic
            unreadNotificationsStore.remove([messageId]) // badge ticks down instantly
            client
                .post("raven.api.notifications.mark_message_notifications_read", { message_ids: [messageId] })
                .catch(() => {
                    reconcileFirstPage(client, viewKey, filters)
                    globalMutate(UNREAD_NOTIFICATION_IDS_KEY)
                })
        },
        [client, globalMutate, viewKey, filters],
    )

    // Manual refresh (pull-to-refresh): refetch the first page of this view and
    // revalidate the unread-id set. reconcileFirstPage is already coalesced, so
    // a pull during a running reconcile just queues one follow-up.
    const refresh = useCallback(async () => {
        await reconcileFirstPage(client, viewKey, filters)
        await globalMutate(UNREAD_NOTIFICATION_IDS_KEY)
    }, [client, viewKey, filters, globalMutate])

    const markAllRead = useCallback(() => {
        // Explicit for every displayed row — the whole unread list sweeps itself
        // clean (animated) instead of freezing as a wall of read rows.
        for (const row of rowsRef.current) explicitlyReadRef.current.add(row.message_id)
        notificationListStore.markAllRead() // optimistic
        unreadNotificationsStore.clear()
        client
            .post("raven.api.notifications.mark_all_notifications_read")
            .catch(() => globalMutate(UNREAD_NOTIFICATION_IDS_KEY))
    }, [client, globalMutate])

    return {
        rows,
        /** Rows mid-exit — the page passes this down so they render collapsed. */
        leavingIds,
        isLoading: state.status === "idle" || state.status === "loading",
        error: state.status === "error" ? state.error : null,
        hasMore: state.hasMore,
        loadMore,
        refresh,
        markMessageRead,
        markAllRead,
    }
}
