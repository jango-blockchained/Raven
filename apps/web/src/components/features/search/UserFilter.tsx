import { CommandGroup } from '@components/ui/command'
import { FilterCombobox, FilterComboboxItem } from '@components/common/FilterCombobox'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { SearchFilters } from './types'
import { UserData } from "@db"
import _ from '@lib/translate'

/** Sentinel for "no author filter". Not a real user id. */
const ALL = 'all'

interface UserFilterProps {
    filters: SearchFilters
    users: UserData[]
    onValueChange?: (value: string) => void
    /** Width of the open popover; also the trigger width unless triggerClassName is set. */
    dropdownClassName?: string
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/** Message-author picker for the search filter bar. */
export function UserFilter({
    filters,
    users,
    onValueChange,
    dropdownClassName = "w-[240px]",
    triggerClassName,
    className,
}: UserFilterProps) {
    const value = filters.owner || ''
    const selectedUser = users.find((user) => user.name === value)
    const isAllSelected = !value || value === ALL

    return (
        <FilterCombobox
            className={className}
            triggerClassName={triggerClassName}
            contentClassName={dropdownClassName}
            emptyLabel={_("No users found.")}
            onClear={() => onValueChange?.(ALL)}
            trigger={
                selectedUser && !isAllSelected ? (
                    <UserOption user={selectedUser} compact />
                ) : (
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">
                        {_("From Anyone")}
                    </span>
                )
            }
        >
            {(close) => (
                // Only users in this list — a "Users" heading labels nothing. The group stays
                // for its p-1 gutter; cmdk renders no heading element when the prop is absent.
                <CommandGroup>
                    {users.map((user) => (
                        <FilterComboboxItem
                            key={user.name}
                            value={`${user.name} ${user.full_name ?? ''}`}
                            selected={value === user.name}
                            onSelect={() => { onValueChange?.(user.name); close() }}
                        >
                            <UserOption user={user} />
                        </FilterComboboxItem>
                    ))}
                </CommandGroup>
            )}
        </FilterCombobox>
    )
}

function UserOption({ user, compact = false }: { user: UserData; compact?: boolean }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <UserAvatar
                user={user}
                size={compact ? 'xs' : 'sm'}
                showStatusIndicator={false}
                showBotIndicator={false}
            />
            {/* leading-snug: the UI type scale's 1.15 clips descenders once truncate
                bounds the line box. */}
            <span className="min-w-0 flex-1 truncate text-left leading-snug">{user.full_name}</span>
        </div>
    )
}
