import { Fragment, useRef, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@components/ui/context-menu"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { channelMessagesStore } from "@stores/messages/store"
import { messageActionTargetAtom } from "@utils/channelAtoms"
import { useIsMobile } from "@hooks/use-mobile"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { MessageAction, useMessageActions } from "./useMessageActions"
import { MessageHoverToolbar } from "./MessageHoverToolbar"
import { ReactionPickerPanel } from "./ReactionPicker"
import { useToggleReaction } from "./useToggleReaction"
import { hapticTick } from "@utils/haptics"
import { SmilePlus } from "lucide-react"
import type { Message } from "@raven/types/common/Message"
import { QuickEmojisAtom } from "@utils/preferences"

/** Two taps on the same message within this window open the quick-action toolbar. */
const DOUBLE_TAP_MS = 300

/** Hold this long (without drifting/lifting) to open the mobile action sheet. */
const LONG_PRESS_MS = 450
/** Finger drift beyond this cancels the long-press — it's a scroll, not a hold. */
const LONG_PRESS_SLOP_PX = 10

/** Double-tapping a message on mobile toggles this reaction (Instagram-style). */
const DOUBLE_TAP_REACTION = "👍"

/**
 * Selections this soon after the menu opened are the tail of the opening
 * gesture: the menu mounts under the cursor, and releasing a slow right-click
 * lands on the first item, "selecting" it. Ignore them.
 */
const OPEN_GESTURE_GUARD_MS = 200

/**
 * One action surface for the whole stream, via event delegation on
 * `data-message-id`. Desktop: hover shows the quick-action toolbar,
 * right-click opens the context menu. Mobile: long-press opens the bottom
 * sheet (quick reactions + full picker + actions), double tap quick-reacts 👍
 * — the hover toolbar is desktop-only. The targeted message is held in
 * `messageActionTargetAtom` so the stream can highlight it while a menu is
 * open.
 *
 * Messages themselves carry no menu machinery — this replaces a Radix
 * ContextMenu instance per message with a single one per stream.
 */
export const MessageActionMenu = ({ channelID, children }: { channelID: string; children: React.ReactNode }) => {
    const isMobile = useIsMobile()
    const [target, setTarget] = useAtom(messageActionTargetAtom)
    /**
     * The target atom is cleared by several close paths (menu close, toolbar
     * dropdown close), and a clear can race a fresh right-click's set —
     * leaving Radix open over a null target, i.e. an empty menu. Rendering
     * from the last non-null target makes the content immune to that race;
     * the live atom still drives the highlight and open/close.
     */
    const lastTargetRef = useRef<Message | null>(null)
    if (target) lastTargetRef.current = target
    const menuMessage = target ?? lastTargetRef.current
    const actionGroups = useMessageActions(menuMessage)
    const lastTapRef = useRef({ messageID: "", time: 0 })
    const menuOpenedAtRef = useRef(0)
    const wrapperRef = useRef<HTMLDivElement>(null)
    /** Hovered message + its toolbar position; null hides the toolbar. */
    const [hovered, setHovered] = useState<{ message: Message; top: number } | null>(null)
    /** While the toolbar's ellipsis menu is open, hover-clearing is suspended. */
    const toolbarMenuOpenRef = useRef(false)

    const blockFromEvent = (event: React.MouseEvent): { message: Message; element: HTMLElement } | null => {
        const element = (event.target as HTMLElement).closest?.("[data-message-id]") as HTMLElement | null
        const messageID = element?.getAttribute("data-message-id")
        if (!element || !messageID) return null
        const message = channelMessagesStore.getState(channelID).byId.get(messageID)
        if (!message) return null
        // A batch acts as one logical message: target its LAST (newest) member — where
        // the reply linkage already lives — regardless of which tile was hit, and anchor
        // the toolbar to the whole batch row so it doesn't jump between album tiles.
        if (message.message_batch_id) {
            const members = channelMessagesStore.batchMembers(channelID, message.message_batch_id)
            const target = members[members.length - 1] ?? message
            const root = (element.closest("[data-batch-root]") as HTMLElement | null) ?? element
            return { message: target, element: root }
        }
        return { message, element }
    }

    const messageFromEvent = (event: React.MouseEvent): Message | null => blockFromEvent(event)?.message ?? null

    const showToolbarFor = (message: Message, element: HTMLElement) => {
        if (!wrapperRef.current) return
        const top = element.getBoundingClientRect().top - wrapperRef.current.getBoundingClientRect().top - 14
        setHovered({ message, top: Math.max(top, 2) })
    }

    /** Desktop: tracks which message the pointer is over and positions the floating toolbar. */
    const onMouseOver = (event: React.MouseEvent) => {
        if (isMobile || toolbarMenuOpenRef.current) return
        const block = blockFromEvent(event)
        if (!block || block.message.name === hovered?.message.name) return
        showToolbarFor(block.message, block.element)
    }

    const onMouseLeave = () => {
        if (!toolbarMenuOpenRef.current) setHovered(null)
    }

    /** Positions go stale when the content scrolls under the pointer — hide until the next hover. */
    const onScrollCapture = () => {
        if (!toolbarMenuOpenRef.current) setHovered(null)
    }

    const onToolbarMenuOpenChange = (open: boolean) => {
        toolbarMenuOpenRef.current = open
        if (!open) setHovered(null)
    }

    /**
     * Mobile long-press → bottom sheet, via pointer events. Android fires
     * `contextmenu` for touch long-press (handled below), but iOS NEVER does —
     * so the sheet needs a real detector: pointer down starts a timer; drifting
     * past the slop (scrolling) or lifting cancels it. When it fires, the
     * click that follows finger-lift is swallowed (capture phase) so it can't
     * follow a link or re-toggle the toolbar under the sheet.
     */
    const longPressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
    /**
     * Suppress clicks only within a short window after the long-press fires —
     * NOT a one-shot flag: iOS often produces NO click at all after a long
     * hold, and a latched flag would then eat the next unrelated tap (e.g.
     * tapping a reaction pill right after the sheet closes).
     */
    const suppressClicksUntilRef = useRef(0)

    const cancelLongPress = () => {
        if (!longPressRef.current) return
        window.clearTimeout(longPressRef.current.timer)
        longPressRef.current = null
    }

    const onPointerDown = (event: React.PointerEvent) => {
        if (!isMobile || event.pointerType !== "touch") return
        // A fresh touch means any prior long-press suppression is stale.
        suppressClicksUntilRef.current = 0
        const block = blockFromEvent(event)
        if (!block) return
        cancelLongPress()
        const timer = window.setTimeout(() => {
            longPressRef.current = null
            suppressClicksUntilRef.current = performance.now() + OPEN_GESTURE_GUARD_MS
            setTarget(block.message)
            menuOpenedAtRef.current = performance.now()
            hapticTick()
        }, LONG_PRESS_MS)
        longPressRef.current = { timer, x: event.clientX, y: event.clientY }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const press = longPressRef.current
        if (!press) return
        if (Math.abs(event.clientX - press.x) > LONG_PRESS_SLOP_PX || Math.abs(event.clientY - press.y) > LONG_PRESS_SLOP_PX) {
            cancelLongPress()
        }
    }

    const onClickCapture = (event: React.MouseEvent) => {
        if (performance.now() > suppressClicksUntilRef.current) return
        suppressClicksUntilRef.current = 0
        event.preventDefault()
        event.stopPropagation()
    }

    /** Right-click (desktop) and long-press (Android fires contextmenu for it; iOS path above). */
    const onContextMenu = (event: React.MouseEvent) => {
        const message = messageFromEvent(event)
        if (!message) {
            // Empty areas/date separators: no menu. preventDefault also tells the
            // Radix trigger (which respects defaultPrevented) not to open.
            event.preventDefault()
            return
        }
        setTarget(message)
        menuOpenedAtRef.current = performance.now()
        // Mobile long-press: the bottom sheet opens via the target atom instead of Radix
        if (isMobile) {
            setHovered(null)
            event.preventDefault()
        }
    }

    /**
     * Runs an action — unless this "selection" is the release of the right-click that opened
     * the menu. That happens when the menu opens near the viewport bottom: Radix shifts it up
     * to fit, landing an item under the cursor, so the opening pointer-up fires onSelect on it.
     * preventDefault keeps Radix from closing the menu on that phantom select (without it the
     * menu would flash open and dismiss instantly); we just swallow the event.
     */
    const selectAction = (action: MessageAction, event: Event) => {
        if (performance.now() - menuOpenedAtRef.current < OPEN_GESTURE_GUARD_MS) {
            event.preventDefault()
            return
        }
        action.onSelect()
    }

    /** Mobile: double tap on a message quick-reacts (👍) — the toolbar is desktop-only now. */
    const toggleReaction = useToggleReaction()
    const onClick = (event: React.MouseEvent) => {
        if (!isMobile) return
        const element = event.target as HTMLElement
        // A first tap on an interactive element already did something — don't
        // let a quick second tap also fire the reaction.
        if (element.closest("a, button, [role='button'], input, textarea")) return
        const block = blockFromEvent(event)
        if (!block) return
        const last = lastTapRef.current
        lastTapRef.current = { messageID: block.message.name, time: event.timeStamp }
        if (last.messageID === block.message.name && event.timeStamp - last.time < DOUBLE_TAP_MS) {
            lastTapRef.current = { messageID: "", time: 0 }
            toggleReaction(block.message, DOUBLE_TAP_REACTION)
            hapticTick()
        }
    }

    /** The mobile sheet shows either the action list or the full emoji picker. */
    const [sheetView, setSheetView] = useState<"actions" | "picker">("actions")
    const closeSheet = () => {
        setTarget(null)
        setSheetView("actions")
    }

    const quickEmojis = useAtomValue(QuickEmojisAtom)

    return (
        <ContextMenu onOpenChange={(open) => !open && setTarget(null)}>
            <ContextMenuTrigger asChild disabled={isMobile}>
                {/* touch-action keeps double-tap from triggering browser zoom. Touch
                    text-selection is disabled GLOBALLY (index.css @media pointer:coarse)
                    — a select-none scoped to just this subtree makes iOS long-press
                    select everything OUTSIDE it instead. */}
                <div
                    ref={wrapperRef}
                    className="relative flex min-h-0 min-w-0 flex-1 flex-col [touch-action:manipulation]"
                    onContextMenu={onContextMenu}
                    onClick={onClick}
                    onClickCapture={onClickCapture}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onMouseOver={onMouseOver}
                    onMouseLeave={onMouseLeave}
                    onScrollCapture={onScrollCapture}
                >
                    {children}
                    {/* Desktop-only: hovered is only ever set from mouseover */}
                    {hovered && (
                        <MessageHoverToolbar
                            message={hovered.message}
                            top={hovered.top}
                            onMenuOpenChange={onToolbarMenuOpenChange}
                        />
                    )}
                </div>
            </ContextMenuTrigger>

            {/* Keyed by target so right-clicking a DIFFERENT message while the menu is open
                remounts the content — Radix only re-anchors to the pointer on the closed→open
                transition, so without this the menu would stay put over the old message.
                collisionPadding keeps it off the viewport edge. */}
            <ContextMenuContent key={menuMessage?.name} className="w-56" collisionPadding={8}>
                {actionGroups.map((group, index) => (
                    <Fragment key={index}>
                        {index > 0 && <ContextMenuSeparator />}
                        <ContextMenuGroup>
                            {group.map((action) => (
                                <ContextMenuItem
                                    key={action.id}
                                    variant={action.danger ? "destructive" : "default"}
                                    onSelect={(event) => selectAction(action, event)}
                                >
                                    <action.icon />
                                    <span>{action.label}</span>
                                </ContextMenuItem>
                            ))}
                        </ContextMenuGroup>
                    </Fragment>
                ))}
            </ContextMenuContent>

            {isMobile && (
                <Drawer open={!!target} onOpenChange={(open) => !open && closeSheet()}>
                    <DrawerContent className={sheetView === "picker" ? "p-0 pt-1" : ""} showHandle={sheetView !== "picker"}>
                        <DrawerTitle className="sr-only">{_("Message actions")}</DrawerTitle>
                        {sheetView === "picker" && menuMessage ? (
                            // Full emoji picker takes over the sheet edge-to-edge (same panel
                            // as the desktop popover); picking closes the whole sheet.
                            // emoji-mart is a shadow-DOM web component, which defeats BOTH
                            // touch layers here: data-vaul-no-drag stops vaul claiming the
                            // swipe as a sheet drag, and the touchmove stopPropagation stops
                            // Radix Dialog's react-remove-scroll (bubble-phase document
                            // listener) from preventDefault-ing it — shadow retargeting makes
                            // it see only the un-scrollable <em-emoji-picker> host, so it
                            // blocks what it can't inspect. With neither in the way, native
                            // scrolling inside the picker just works. The height cap (host
                            // styled from outside) keeps the sheet fixed, overflow inward.
                            <div
                                data-vaul-no-drag
                                onTouchMove={(e) => e.stopPropagation()}
                                className="flex justify-center overflow-hidden [&_em-emoji-picker]:h-[60vh] [&_em-emoji-picker]:w-100vw"
                            >
                                <ReactionPickerPanel perLine={10} message={menuMessage} onClose={closeSheet} />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 p-3 pb-6">
                                {/* Quick reactions — one tap reacts and dismisses; the smiley
                                    swaps the sheet to the full picker. */}
                                <div className="flex items-center justify-between px-1 pb-2">
                                    {quickEmojis.map((emoji) => (
                                        <Button
                                            key={emoji.id}
                                            variant="ghost"
                                            size="lg"
                                            isIconButton
                                            aria-label={`${_("React with {0}", [emoji.native ? emoji.native : emoji.id ?? ""])}`}
                                            className="rounded-full text-2xl"
                                            onClick={() => {
                                                if (menuMessage) toggleReaction(menuMessage, emoji.native ? emoji.native : emoji.src ?? "", emoji.src ? true : false, emoji.id)
                                                hapticTick()
                                                closeSheet()
                                            }}
                                        >
                                            {emoji.src ? (
                                                <img
                                                    src={emoji.src}
                                                    alt={emoji.id}
                                                    loading="lazy"
                                                    className="h-6 w-6 object-contain"
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                // em-emoji renders from the Apple set (initialized in
                                                // App.tsx) so reactions look the same on every platform
                                                <span className="flex h-6 w-6 items-center justify-center" aria-hidden="true">
                                                    <em-emoji native={emoji.native} set="apple" size="1.4em" fallback={emoji.id} />
                                                </span>
                                            )}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        size="lg"
                                        isIconButton
                                        aria-label={_("More reactions")}
                                        className="rounded-full bg-surface-gray-2"
                                        onClick={() => setSheetView("picker")}
                                    >
                                        <SmilePlus />
                                    </Button>
                                </div>
                                {actionGroups.map((group, index) => (
                                    <Fragment key={index}>
                                        {index > 0 && <div className="my-1 border-t border-outline-gray-2" />}
                                        {group.map((action) => (
                                            <SheetActionRow key={action.id} action={action} onDone={closeSheet} />
                                        ))}
                                    </Fragment>
                                ))}
                            </div>
                        )}
                    </DrawerContent>
                </Drawer>
            )}
        </ContextMenu>
    )
}

const SheetActionRow = ({ action, onDone }: { action: MessageAction; onDone: () => void }) => (
    <Button
        variant="ghost"
        size="lg"
        theme={action.danger ? "red" : "gray"}
        className={cn("w-full justify-start gap-3", action.danger ? "active:bg-surface-red-2" : "active:bg-surface-gray-2")}
        onClick={() => {
            action.onSelect()
            onDone()
        }}
    >
        <action.icon />
        {action.label}
    </Button>
)
