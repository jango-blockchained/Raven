import { useEffect, useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@components/ui/select"
import { Input } from "@components/ui/input"
import { Star, Plus, X } from "lucide-react"
import { toast } from "sonner"
import _ from "@lib/translate"
import { NEW_GROUP_VALUE, UNGROUP_VALUE, useChannelGroups } from "./useChannelGroups"


interface ChannelGroupSelectProps {
    channelId: string
    channelGroup: string
}

/** The group cell of the channel table: assign, or create-and-assign in one step. */
export const ChannelGroupSelect = ({ channelId, channelGroup }: ChannelGroupSelectProps) => {
    const { groups, createGroup, assignChannel } = useChannelGroups()

    const [isCreating, setIsCreating] = useState(false)
    const [name, setName] = useState("")
    const [error, setError] = useState<string | undefined>(undefined)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleChange = (value: string) => {
        if (value === NEW_GROUP_VALUE) {
            setName("")
            setError(undefined)
            setIsCreating(true)
            return
        }
        assignChannel(channelId, value === UNGROUP_VALUE ? null : value)
    }

    const submit = () => {
        const result = createGroup(name, channelId)
        if (!result.ok) {
            setError(result.error)
            // The row is a fixed 44px (ListView rowHeight), so an inline error message
            // gets clipped and bleeds into the next row. Keep the red aria-invalid border
            // as the in-place signal and put the words in a toast, where they fit.
            // Fixed id so mashing Enter replaces the toast instead of stacking them.
            toast.error(result.error, { id: "channel-group-error" })
            inputRef.current?.focus()
            return
        }
        setIsCreating(false)
        setName("")
    }

    // Radix's dialog dismisses on a document-level CAPTURE listener, which beats any
    // React handler on this input — so an Escape branch in onKeyDown can never run
    // before the whole settings dialog closes and discards unsaved work. window
    // receives capture events before document, so this is the only place we can
    // claim Escape for the inline editor.
    useEffect(() => {
        if (!isCreating) return

        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return
            // Every open create-editor registers one of these listeners. Without this
            // focus check the first-registered one wins and stopImmediatePropagation
            // cancels the WRONG row, leaving the focused editor looking dead to Escape.
            if (document.activeElement !== inputRef.current) return
            event.preventDefault()
            event.stopImmediatePropagation()
            setIsCreating(false)
            setName("")
            setError(undefined)
        }

        window.addEventListener("keydown", cancelOnEscape, { capture: true })
        return () => window.removeEventListener("keydown", cancelOnEscape, { capture: true })
    }, [isCreating])

    if (isCreating) {
        return (
            <div className="w-52 px-0.5">
                <Input
                    ref={inputRef}
                    autoFocus
                    inputSize="sm"
                    maxLength={50}
                    value={name}
                    placeholder={_("Group name")}
                    aria-label={_("New group name")}
                    aria-invalid={!!error}
                    title={error}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError(undefined)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    onBlur={() => !name.trim() && setIsCreating(false)}
                />
            </div>
        )
    }

    return (
        <Select value={channelGroup} onValueChange={handleChange}>
            <SelectTrigger
                inputSize="sm"
                className="w-52 **:data-[slot=select-value]:truncate **:data-[slot=select-value]:block"
            >
                <SelectValue placeholder={_("Select a group")} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="Favorites">
                    <div className="flex items-center gap-2">
                        <Star className="fill-yellow-400 stroke-yellow-400" />
                        {_("Favorites")}
                    </div>
                </SelectItem>
                {groups.length > 0 && <SelectSeparator />}
                {groups.map((group) => (
                    <SelectItem
                        key={group.name ?? group.group_name}
                        value={group.group_name}
                        className="overflow-hidden *:last:truncate *:last:block!"
                    >
                        {group.group_name}
                    </SelectItem>
                ))}
                <SelectSeparator />
                {channelGroup && <SelectItem value={UNGROUP_VALUE}>
                    <div className="flex items-center gap-2">
                        <X />
                        {_("Clear")}
                    </div>
                </SelectItem>}
                <SelectItem value={NEW_GROUP_VALUE}>
                    <div className="flex items-center gap-2">
                        <Plus />
                        {_("New group…")}
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    )
}
