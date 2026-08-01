import { useEffect } from 'react'
import { ChannelFilter } from '@components/common/filters/ChannelFilter'
import { UserFilter } from '@components/common/filters/UserFilter'
import { FileTypeFilter } from '@components/common/filters/FileTypeFilter'
import { SearchFilters as SearchFiltersType } from './types'
import { ChannelListItem, DMChannelListItem } from '@raven/types/common/ChannelListItem'
import _ from '@lib/translate'
import { useUsers } from '@hooks/useUsers'
import { useChannelMembers } from '@hooks/useChannelMembers'

/**
 * min-w-0 lets a filter shrink past its content, which is what keeps a long channel name
 * truncating inside its trigger instead of widening its column at the others' expense.
 */
const FILTER_WIDTH = "min-w-0"

interface SearchFiltersProps {
    filters: SearchFiltersType
    channels: ChannelListItem[]
    dmChannels: DMChannelListItem[]
    onChannelChange: (value: string) => void
    onUserChange: (value: string) => void
    onFileTypeChange: (value: string[]) => void
    /** File type only narrows file results — the other tabs have no use for it. */
    showFileTypeFilter?: boolean
}
export function SearchFiltersBar({ filters, channels, dmChannels, onChannelChange, onUserChange, onFileTypeChange, showFileTypeFilter }: SearchFiltersProps) {
    const users = useUsers()
    const { members, isLoading: isMembersLoading } = useChannelMembers(filters.channel_id || '')

    const userFilterOptions = filters.channel_id && members.length > 0 ? members : users

    // Ensure that if a channel is selected and a user is selected, the user must be a member of the channel, else clear the filter.
    useEffect(() => {
        if (!filters.channel_id) return
        if (!filters.owner || filters.owner === 'all') return
        if (isMembersLoading) return
        if (members.some(m => m.name === filters.owner)) return
        onUserChange('')
    }, [filters.channel_id, filters.owner, members, isMembersLoading, onUserChange])

    return (
        // Three equal columns, always — file type only appears on the files tab, and a flex
        // row would have let the other two grow into its space and jump width on every tab
        // switch. The empty third column keeps them still.
        // Clearing them all at once lives with the active-filter badges below, which is the
        // line that already says what's on.
        <div className="grid grid-cols-3 items-center gap-2">
            {/* Each filter fills its wrapper (trigger w-full + truncates); the wrapper does
                the sizing. The popovers are wider than their triggers and collision-padded,
                so a narrow trigger never costs readability in the open list. */}
            <div className={FILTER_WIDTH}>
                <UserFilter
                    users={userFilterOptions}
                    value={filters.owner || ''}
                    onValueChange={onUserChange}
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                />
            </div>
            <div className={FILTER_WIDTH}>
                <ChannelFilter
                    channels={channels}
                    dmChannels={dmChannels}
                    users={users}
                    value={filters.channel_id || ""}
                    onValueChange={onChannelChange}
                    // Shortest of the three placeholders by necessity: equal-width triggers
                    // leave 73px of label on a phone, and "Any Channel" needs 84. Threads and
                    // saved-messages keep the longer "Any Channel" — their triggers are wider.
                    allLabel={_("Channel")}
                    triggerClassName="w-full"
                    className="w-full min-w-0"
                />
            </div>
            {/* A selection made here survives a tab switch — it stays in the URL, and the
                badge row keeps showing (and removing) it while the control is away. */}
            {showFileTypeFilter && (
                <div className={FILTER_WIDTH}>
                    <FileTypeFilter
                        value={filters.file_type || []}
                        onValueChange={onFileTypeChange}
                        triggerClassName="w-full"
                        className="w-full min-w-0"
                    />
                </div>
            )}
            {/* TODO: Add date range filter capability to sqlite search, either Frappe side or override in Raven */}
        </div>
    )
}
