import { useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@components/ui/command"
import { Button } from "@components/ui/button"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "@lib/utils"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"

/**
 * DropdownMenuItem's type scale and geometry, so a filter row reads like a menu row.
 * text-lg md:text-base (15/14) overrides CommandItem's own text-content (14/13) —
 * cn() registers text-content in the font-size group, so the later class wins.
 * Two deliberate departures: a fixed h-7.5 instead of py-2/md:py-1.5, so every row
 * lines up with the trigger and the search field; and hover:, because these are cmdk
 * rows and a plain button, neither of which takes DropdownMenu's focus: highlight.
 */
const ITEM_STYLES = "flex h-7.5 cursor-pointer items-center gap-2 rounded px-2 text-lg md:text-base text-ink-gray-7 hover:bg-surface-gray-2"

/**
 * cmdk highlights the first item whenever its selection is empty — on mount, and again
 * on every search change. Seeding the selection with a string no item can match leaves
 * the list unhighlighted on open, so nothing looks pre-chosen and Enter can't pick a row
 * the user never pointed at. Typing still highlights the top match (search change
 * re-runs selectFirstItem), and ArrowDown from nothing lands on the first row.
 */
const NO_SELECTION = "__filter-combobox-no-selection__"

/** The p-2 gutter every filter-hosting page uses, in px. */
const PAGE_GUTTER = 8

/**
 * One selectable row, with the trailing check DropdownMenu's checkable items carry.
 * Both filters rendered this identically by hand; keeping it here is what stops the
 * checked-row treatment from drifting between them.
 */
export function FilterComboboxItem({
    value, selected, onSelect, children, className,
}: {
    /** cmdk's search key — include the id so an exact id still matches. */
    value: string
    selected: boolean
    onSelect: () => void
    children: ReactNode
    className?: string
}) {
    return (
        <CommandItem
            value={value}
            onSelect={onSelect}
            className={cn(
                ITEM_STYLES,
                "justify-between",
                // DropdownMenu paints its checked row with surface-gray-3 rather than
                // relying on the check alone.
                selected && "bg-surface-gray-3",
                className,
            )}
        >
            {children}
            {selected && <CheckIcon className="size-4 shrink-0 text-ink-gray-6" />}
        </CommandItem>
    )
}

interface FilterComboboxProps {
    /** Rendered inside the trigger button, left of the chevron. */
    trigger: ReactNode
    /** Defaults to "Search" — the field sits inside the filter it searches, so naming
        the list again adds nothing. Override only where that context is missing. */
    searchPlaceholder?: string
    emptyLabel: string
    /** Receives a `close` callback — every item must call it after selecting. */
    children: (close: () => void) => ReactNode
    /** Resets the filter. Rendered as the pinned "Clear" row, per the Frappe pattern. */
    onClear: () => void
    /** Width of the open popover. Also the trigger width unless triggerClassName is set. */
    contentClassName?: string
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/**
 * The shell shared by the search filter comboboxes (channel, user): trigger button,
 * popover, search box, scroll container and empty state. Callers supply only the
 * items, so the two filters can't drift apart in sizing or scroll behaviour.
 */
export function FilterCombobox({
    trigger,
    searchPlaceholder = _("Search"),
    emptyLabel,
    children,
    onClear,
    contentClassName,
    triggerClassName,
    className,
}: FilterComboboxProps) {
    const [open, setOpen] = useState(false)
    const isMobile = useIsMobile()
    // cmdk's search and highlight are controlled so they can be reset between opens WITHOUT
    // remounting the list. Remounting would restart every row's Radix Avatar, and that
    // component only shows its image once its own load resolves — so each open flashed
    // the initials fallback for every user, even on cached images.
    const [search, setSearch] = useState("")
    const [highlighted, setHighlighted] = useState(NO_SELECTION)

    // The two resets sit on OPPOSITE edges on purpose. Clearing the search is itself a
    // search change, and cmdk schedules selectFirstItem on every search change — so
    // clearing on open would re-highlight row 1 right after we cleared the highlight.
    // Clearing it on close lets that fire and settle while the popover is shut; the next
    // open then only has to clear the highlight, with no search change to undo it.
    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) setHighlighted(NO_SELECTION)
        else setSearch("")
    }

    return (
        <div className={cn("shrink-0", className)}>
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        variant="subtle"
                        size="sm"
                        role="combobox"
                        aria-expanded={open}
                        // h-7.5 (30px) matches the search page's TabsList, which the trigger
                        // sits beside: subtle/md TabsTrigger is py-1.5 + text-base/1.15 = 28px,
                        // plus the list's p-px = 30px. Matching the row it lives in beats
                        // matching the popover's own h-8 search field, which is a separate
                        // surface. No `!` needed: cn() puts className after the variant classes.
                        className={cn(
                            "h-7.5 w-fit justify-between gap-2 overflow-hidden font-normal cursor-pointer",
                            triggerClassName ?? contentClassName,
                        )}
                    >
                        {trigger}
                        <ChevronDownIcon className="size-4 shrink-0 text-ink-gray-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    side="bottom"
                    align="start"
                    // Every page that hosts a filter wraps the row in p-2, and a popover wider
                    // than its trigger would otherwise run to the screen edge on mobile. Radix
                    // shifts the content to keep this gap, so the menu lines up with the page
                    // gutter from whichever trigger it hangs off — no per-page alignment.
                    collisionPadding={PAGE_GUTTER}
                    // Radix focuses the popover's first tabbable on open — here the search
                    // field, which throws up the on-screen keyboard and buries the list it
                    // is meant to filter. Desktop keeps it: typing straight away is the point.
                    onOpenAutoFocus={(event) => { if (isMobile) event.preventDefault() }}
                    // shadow-2xl matches DropdownMenuContent's elevation. Its hairline is
                    // the popover's own border rather than DropdownMenu's ring-black/5 —
                    // same result, without spreading an opacity override into new code.
                    className={cn(
                        "flex max-h-96 w-fit min-w-(--radix-popover-trigger-width) flex-col p-0 shadow-2xl",
                        contentClassName,
                    )}
                >
                    {/* bg-transparent: Command defaults to elevation-1, which would paint
                        over the popover's elevation-2 — the surface DropdownMenu uses. */}
                    {/* Espresso's Input pairs a size with a type step: sm/h-7 and md/h-8 take
                        text-base, and text-xl belongs to lg/h-10. CommandInput hardcodes
                        text-xl md:text-base, so on mobile a large-input type lands in a field
                        smaller than sm. text-base restores the pairing; the field keeps the
                        taller mobile box for touch, then h-7.5 on desktop to sit flush with
                        the rows and the trigger. shrink-0 because the field is a flex child of
                        a height-capped column: without it the overflowing list shrinks the
                        field off its height (36px became 34.09px on mobile). */}
                    {/* This popover's content stays mounted after it closes, so cmdk would
                        otherwise carry its search text and highlight into the next open — you
                        reopen onto the last query with the list still filtered. onOpenChange
                        resets both instead, which leaves the rows (and their avatars) mounted. */}
                    <Command
                        shouldFilter
                        value={highlighted}
                        onValueChange={setHighlighted}
                        className="min-h-0 flex-1 bg-transparent [&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]]:h-9 md:[&_[data-slot=command-input-wrapper]]:h-7.5"
                    >
                        <CommandInput
                            placeholder={searchPlaceholder}
                            value={search}
                            onValueChange={setSearch}
                            className="text-base"
                        />
                        {/* cmdk's own list caps its height and scrolls; this wrapper owns the
                            scroll instead so the popover can size to content. overscroll-contain
                            is what stops the page behind scrolling on once this list bottoms out —
                            not a wheel handler: React registers wheel passively, so preventDefault
                            there is a no-op and the browser's own scroll lands on top of any
                            manual scrollTop. */}
                        {/* CommandGroup's own p-1 is the viewport gutter and CommandItem's own
                            px-2 is the row padding — the same geometry DropdownMenuContent gets
                            from its p-1, so no padding overrides are needed. The one override
                            left is the group label's type: DropdownMenuLabel is text-sm-medium,
                            and px-2/py-1.5/text-ink-gray-4 already match. */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain overflow-x-hidden [&_[cmdk-group-heading]]:text-sm-medium">
                            <CommandList className="max-h-none overflow-visible">
                                <CommandEmpty>{emptyLabel}</CommandEmpty>
                                {children(() => onOpenChange(false))}
                            </CommandList>
                        </div>
                        {/* Pinned outside the scroller so it stays reachable in a long list.
                            p-1 matches DropdownMenuContent's gutter, which lines this row's
                            hover pill up with the options above it. */}
                        <div className="shrink-0 p-1">
                            {/* DropdownMenuSeparator's exact geometry and token. */}
                            <div className="bg-outline-elevation-2 mx-0.5 mb-1 h-px" />
                            <button
                                type="button"
                                onClick={() => { onClear(); onOpenChange(false) }}
                                className={cn(ITEM_STYLES, "w-full")}
                            >
                                <XIcon className="size-4 shrink-0 text-ink-gray-5" />
                                {_("Clear")}
                            </button>
                        </div>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
