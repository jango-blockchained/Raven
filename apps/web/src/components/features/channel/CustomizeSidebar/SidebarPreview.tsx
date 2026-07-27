import {
    Collapsible,
    CollapsibleContent,
} from '@components/ui/collapsible'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { ChannelSidebarData } from '@raven/lib/hooks/useGroupedChannels'
import { useEffect, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PreviewGroupHeader } from "./PreviewGroupHeader"
import { useChannelGroups } from "./useChannelGroups"

interface SidebarPreviewProps {
    data: ChannelSidebarData
    globalSort?: string
}

/** Non-interactive mirror of ChannelSidebar's layout for the customize dialog. */
export const SidebarPreview = ({ data, globalSort }: SidebarPreviewProps) => {

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
    const [scrollerRef, setScrollerRef] = useState<HTMLElement | null>(null)

    const { reorder } = useChannelGroups()
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    useEffect(() => {
        data.groupedChannels.forEach(([groupName, channels]) => {
            if (channels.length > 0 && openGroups[groupName] === false) {
                setOpenGroups(prev => ({ ...prev, [groupName]: true }))
            }
            else if (channels.length === 0 && openGroups[groupName] === true) {
                setOpenGroups(prev => ({ ...prev, [groupName]: false }))
            }
        })
    }, [data.groupedChannels])

    const isGroupOpen = (groupName: string, hasChannels: boolean) => {
        if (groupName in openGroups) {
            return openGroups[groupName]
        }
        return hasChannels
    }

    const sortableGroupNames = data.groupedChannels
        .map(([groupName]) => groupName)
        .filter((groupName) => groupName !== "Favorites")

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            reorder(String(active.id), String(over.id))
        }
    }

    return (
        <div className="flex h-full flex-col bg-surface-sidebar">
            <div ref={setScrollerRef} className="min-h-0 flex-1 overflow-auto p-2 pb-12">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortableGroupNames} strategy={verticalListSortingStrategy}>
                        <ul className="flex flex-col gap-0.5">
                            {data.groupedChannels.map(([groupName, channels]) => (
                                <SortableGroup
                                    key={groupName}
                                    groupName={groupName}
                                    globalSort={globalSort}
                                    open={isGroupOpen(groupName, channels.length > 0)}
                                    onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [groupName]: open }))}
                                >
                                    <ul className="ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-outline-gray-1 px-2 py-0.5">
                                        {channels.map((channel) => (
                                            <li key={channel.name}>
                                                <PreviewRow channel={channel} />
                                            </li>
                                        ))}
                                    </ul>
                                </SortableGroup>
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>

                {scrollerRef && <Virtuoso
                    customScrollParent={scrollerRef}
                    data={data.ungroupedChannels}
                    computeItemKey={(_index, channel) => channel.name}
                    itemContent={(_index, channel) => <PreviewRow channel={channel} />}
                />}
            </div>
        </div>
    )
}

/**
 * The sortable unit is this whole <li> — header AND the group's channels — not just
 * the header. dnd-kit measures the node it is given, so a header-only sortable made
 * every group look one header tall: dropping "below" an OPEN group landed the dragged
 * group between that group's header and its own channels. Measuring the full block
 * keeps channels stuck to their group.
 *
 * Only the grip button is the activator, so dragging still starts from the handle.
 */
const SortableGroup = ({
    groupName,
    globalSort,
    open,
    onOpenChange,
    children,
}: {
    groupName: string
    globalSort?: string
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}) => {
    const isSortable = groupName !== "Favorites"
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: groupName,
        disabled: !isSortable,
    })

    return (
        <li
            ref={setNodeRef}
            // Translate, NOT Transform: dnd-kit's transform also carries scaleX/scaleY to
            // morph the dragged item toward the target's size. That was invisible while
            // every sortable was a uniform-height header, but these items are whole groups
            // of very different heights, so the scale visibly stretches them.
            style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        >
            {/* Collapsible lives INSIDE the li rather than wrapping it with asChild:
                Slot would hand `group/collapsible` and `data-state` to SortableGroup, which
                is not a DOM node and cannot forward them, breaking the chevron's
                group-data-[state=open]/collapsible rotation. */}
            <Collapsible open={open} onOpenChange={onOpenChange} className="group/collapsible">
                <PreviewGroupHeader
                    groupName={groupName}
                    isSortable={isSortable}
                    globalSort={globalSort}
                    dragHandleRef={setActivatorNodeRef}
                    dragHandleProps={{ ...attributes, ...listeners }}
                />
                <CollapsibleContent>{children}</CollapsibleContent>
            </Collapsible>
        </li>
    )
}

const PreviewRow = ({ channel }: { channel: ChannelSidebarData['ungroupedChannels'][number] }) => (
    <div className="flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-ink-gray-7">
        <ChannelIcon type={channel.type || "Public"} className="h-4 w-4 shrink-0" />
        {/* leading-snug to match ChannelSidebar's ChannelItem — the preview has to
            clip descenders exactly the way the real sidebar does, or it isn't one. */}
        <span className="truncate leading-snug">{channel.channel_name}</span>
    </div>
)
