import { X } from 'lucide-react'
import { Badge } from '@components/ui/badge'
import { SearchFilters } from './types'
import { useClearSearchFilters } from './useClearSearchFilters'
import { formatFileTypeNames } from '@components/common/filters/FileTypeFilter'
import { UserData } from "@db"
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { useSearchParams } from 'react-router-dom'
import _ from '@lib/translate'

interface FilterBadgeProps {
    label: string
    onRemove: () => void
}

function FilterBadge({ label, onRemove }: FilterBadgeProps) {
    return (
        <Badge
            variant="subtle"
            size="md"
            theme="gray"
            className="cursor-pointer mb-2"
            onClick={onRemove}>
            {label}
            <X />
        </Badge>
    )
}

export function SearchActiveBadges({ filters, channels, dmChannels, users }: { filters: SearchFilters, channels: ChannelListItem[], dmChannels: DMChannelListItem[], users: UserData[] }) {

    const [, setSearchParams] = useSearchParams()
    const clearAll = useClearSearchFilters()

    if (!filters) return null

    const removeParam = (key: string) => () => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev)
            params.delete(key)
            return params
        }, { replace: true })
    }

    // Built as a list rather than inline conditionals so the row knows how many badges
    // it has — "Clear all" is only worth showing once there's more than one to clear.
    const badges: FilterBadgeProps[] = []

    if (filters.owner) badges.push({
        label: _('User: {0}', [users.find(u => u.name === filters.owner)?.full_name ?? filters.owner]),
        onRemove: removeParam('user'),
    })

    if (filters.channel_id) badges.push({
        label: _('Channel: {0}', [(channels.find(c => c.name === filters.channel_id)?.channel_name || dmChannels.find(dc => dc.name === filters.channel_id)?.peer_user_id) ?? filters.channel_id]),
        onRemove: removeParam('channel'),
    })

    // Always the names, however many: this row wraps, so unlike the trigger it has no width
    // to run out of, and "File: PDFs, Images" beats "File: 2 types" at saying what's on.
    if (filters.file_type && filters.file_type.length > 0) badges.push({
        label: _('File: {0}', [formatFileTypeNames(filters.file_type)]),
        onRemove: removeParam('file_type'),
    })

    if (badges.length === 0) return null

    return (
        <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
                <FilterBadge key={badge.label} {...badge} />
            ))}
            {/* Lives here, not in the filter row: the row is three comboboxes wide on a
                phone already, and this is the line that lists what's active anyway. */}
            {badges.length > 1 && (
                <button
                    type="button"
                    onClick={clearAll}
                    className="mb-2 cursor-pointer px-1 text-base md:text-sm text-ink-gray-5 underline underline-offset-2 hover:text-ink-gray-8"
                >
                    {_('Clear all')}
                </button>
            )}
        </div>
    )
}
