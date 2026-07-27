import { useEffect, useRef, useState } from "react"
import { ArrowDownAzIcon, ArrowDownUp, ChevronRight, ClockIcon, GripVertical, MoreVertical, PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { CollapsibleTrigger } from "@components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { ChannelGroupLabel } from "@components/channel-sidebar/ChannelSidebar"
import { cn } from "@lib/utils"
import { toast } from "sonner"
import _ from "@lib/translate"
import { useChannelGroups } from "./useChannelGroups"

interface PreviewGroupHeaderProps {
    groupName: string
    /** Favorites is backed by pinned_channels, not a channel_groups row — it has
     *  no handle, no menu and no sort of its own. */
    isSortable: boolean
    globalSort?: string
    /** Drag wiring owned by SortableGroup — the sortable NODE is the whole <li>
     *  (header + its channels) so a group and its channels move as one unit; only
     *  the grip button here is the activator. */
    dragHandleRef?: (node: HTMLElement | null) => void
    dragHandleProps?: Record<string, unknown>
}

export const PreviewGroupHeader = ({ groupName, isSortable, globalSort, dragHandleRef, dragHandleProps }: PreviewGroupHeaderProps) => {
    const { groups, renameGroup, deleteGroup, setGroupSort } = useChannelGroups()
    const index = groups.findIndex((group) => group.group_name === groupName)
    const group = groups[index]

    const [isRenaming, setIsRenaming] = useState(false)
    const [name, setName] = useState(groupName)
    const [error, setError] = useState<string | undefined>(undefined)
    const inputRef = useRef<HTMLInputElement>(null)

    // Only these two values exist as radio items. `sort_channels_by` can still hold the
    // legacy "Unreads First" (unimplemented upstream — sortChannels maps it to recency),
    // and an unmatched value would leave the submenu with NO checkmark at all.
    const resolvedSort = group?.sort_by || globalSort || "Recent Activity"
    const effectiveSort = resolvedSort === "Alphabetical Order" ? resolvedSort : "Recent Activity"

    const cancelRename = () => {
        setName(groupName)
        setError(undefined)
        setIsRenaming(false)
    }

    /** Enter: report the problem and keep the user in the field to fix it. */
    const submitRename = () => {
        const result = renameGroup(index, name)
        if (!result.ok) {
            setError(result.error)
            // Red aria-invalid border in place, words in a toast — the same treatment the
            // channel table's create flow uses. Shared id so repeats replace, not stack.
            toast.error(result.error, { id: "channel-group-error" })
            return
        }
        setIsRenaming(false)
    }

    /**
     * Blur: commit if valid, otherwise abandon the edit.
     * Re-submitting on blur would trap the user — the rename fails, focus is already
     * gone, and every subsequent blur fails again with Escape the only way out.
     */
    const handleRenameBlur = () => {
        const trimmed = name.trim()
        if (!trimmed || trimmed === groupName) return cancelRename()

        const result = renameGroup(index, name)
        if (!result.ok) {
            toast.error(result.error, { id: "channel-group-error" })
            return cancelRename()
        }
        setIsRenaming(false)
    }

    // Radix's dialog dismisses on a document-level CAPTURE listener, which beats any
    // React handler on this input — so an Escape branch in onKeyDown can never run
    // before the whole settings dialog closes and discards unsaved work. window
    // receives capture events before document, so this is the only place we can
    // claim Escape for the inline editor.
    useEffect(() => {
        if (!isRenaming) return

        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return
            // Other inline editors may have their own listener registered; without this
            // check the first-registered one calls stopImmediatePropagation and cancels
            // the WRONG editor, making the focused one look unresponsive to Escape.
            if (document.activeElement !== inputRef.current) return
            event.preventDefault()
            event.stopImmediatePropagation()
            setName(groupName)
            setError(undefined)
            setIsRenaming(false)
        }

        window.addEventListener("keydown", cancelOnEscape, { capture: true })
        return () => window.removeEventListener("keydown", cancelOnEscape, { capture: true })
    }, [isRenaming, groupName])

    if (isRenaming) {
        return (
            <div className="px-2 py-1">
                <Input
                    ref={inputRef}
                    autoFocus
                    inputSize="sm"
                    maxLength={50}
                    value={name}
                    aria-label={_("Group name")}
                    aria-invalid={!!error}
                    title={error}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError(undefined)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            submitRename()
                        }
                    }}
                    onBlur={handleRenameBlur}
                />
            </div>
        )
    }

    return (
        <div className="group/header flex h-8 items-center gap-1 rounded-md pe-1 hover:bg-surface-gray-2">
            {isSortable ? (
                <button
                    type="button"
                    ref={dragHandleRef}
                    {...dragHandleProps}
                    aria-label={_("Reorder group")}
                    className="cursor-grab rounded px-1 text-ink-gray-5 opacity-0 transition-opacity active:cursor-grabbing group-hover/header:opacity-100 focus-visible:opacity-100 focus-visible:focus-ring"
                >
                    <GripVertical className="size-4" />
                </button>
            ) : (
                <span className="w-6" aria-hidden />
            )}

            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-ink-gray-7 outline-none"
                >
                    <ChevronRight className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    <ChannelGroupLabel groupName={groupName} />
                </button>
            </CollapsibleTrigger>

            {isSortable && index >= 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            isIconButton
                            aria-label={_("Group options")}
                            className={cn("opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100")}
                        >
                            <MoreVertical />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem
                            onSelect={() => {
                                setName(groupName)
                                setError(undefined)
                                setIsRenaming(true)
                            }}
                        >
                            <PencilIcon />
                            {_("Rename")}
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <ArrowDownUp />
                                {_("Sort channels by")}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                    value={effectiveSort}
                                    onValueChange={(value) => {
                                        // Radix fires onValueChange even when the clicked item is
                                        // already checked, so the no-op case must be handled here.
                                        // Clicking whatever is currently IN EFFECT means "don't pin
                                        // this" — it clears to inherited if pinned, and stays
                                        // inherited if it already was. Only a click on the other
                                        // item pins a concrete value.
                                        const current = group?.sort_by ?? ""
                                        const next = value === effectiveSort ? "" : value
                                        if (next === current) return
                                        setGroupSort(index, next as "" | "Alphabetical Order" | "Recent Activity")
                                    }}
                                >
                                    <DropdownMenuRadioItem value="Recent Activity">
                                        <ClockIcon />
                                        {_("Recent activity")}
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Alphabetical Order">
                                        <ArrowDownAzIcon />
                                        {_("Alphabetical")}
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => deleteGroup(index)}>
                            <Trash2Icon />
                            {_("Delete")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
