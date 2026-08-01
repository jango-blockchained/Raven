import { useMemo } from 'react'
import { CommandGroup } from '@components/ui/command'
import { FilterCombobox, FilterComboboxItem } from './FilterCombobox'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { UserData } from "@db"
import _ from '@lib/translate'

/** Sentinel for "no author filter". Not a real user id. */
const ALL = 'all'

interface UserFilterProps {
    users: UserData[]
    value: string
    onValueChange: (value: string) => void
    /** The trigger's width, which its row decides. The popover doesn't follow it. */
    triggerClassName?: string
    /** Root wrapper — width/shrink control so the filter can flex down in a shared row. */
    className?: string
}

/** Message-author picker for the filter bars. */
export function UserFilter({
    users,
    value,
    onValueChange,
    triggerClassName,
    className,
}: UserFilterProps) {
    const selectedUser = users.find((user) => user.name === value)
    const isAllSelected = !value || value === ALL

    // Three tiers: people you can still hear from, then deactivated accounts, then bots.
    // A bot posts constantly but is rarely who you're filtering for, and a deactivated
    // account has a fixed, finite history — neither should sit above a colleague. Ties
    // break by name so the list is stable between opens rather than in fetch order.
    // Only the browse order: a search hands ranking to cmdk's scoring.
    const orderedUsers = useMemo(() => {
        const rank = (user: UserData) => (user.type === 'Bot' ? 2 : user.enabled ? 0 : 1)
        return [...users].sort((a, b) =>
            rank(a) - rank(b) || (a.full_name ?? a.name).localeCompare(b.full_name ?? b.name),
        )
    }, [users])

    // Two accounts can carry the same full name — this site has four such pairs, including
    // two "Aditya Patil". cmdk can tell the rows apart on its own (the value is the user id),
    // but a reader can't: the email is the only thing distinguishing them, so it's shown on
    // those rows and nowhere else.
    const ambiguousNames = useMemo(() => {
        const seen = new Set<string>()
        const duplicated = new Set<string>()
        for (const user of users) {
            const name = user.full_name ?? user.name
            if (seen.has(name)) duplicated.add(name)
            else seen.add(name)
        }
        return duplicated
    }, [users])

    return (
        <FilterCombobox
            className={className}
            triggerClassName={triggerClassName}
            emptyLabel={_("No users found.")}
            // Only while an author is picked — see ChannelFilter.
            onClear={selectedUser && !isAllSelected ? () => onValueChange(ALL) : undefined}
            trigger={
                selectedUser && !isAllSelected ? (
                    <UserOption user={selectedUser} compact />
                ) : (
                    // Short on purpose: three equal columns leave ~73px of label on a phone,
                    // and "From Anyone" needs 88px — it truncated to "From Anyo…".
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">
                        {_("Person")}
                    </span>
                )
            }
        >
            {(close) => (
                // Only users in this list — a "Users" heading labels nothing. The group stays
                // for its p-1 gutter; cmdk renders no heading element when the prop is absent.
                <CommandGroup>
                    {orderedUsers.map((user) => {
                        const name = user.full_name ?? user.name
                        const isAmbiguous = ambiguousNames.has(name)
                        return (
                            <FilterComboboxItem
                                key={user.name}
                                // The user id is the identity — unique per doctype, so two
                                // people with one name stay separate rows. The name is what
                                // gets ranked.
                                value={user.name}
                                keywords={[name]}
                                selected={value === user.name}
                                onSelect={() => { onValueChange(user.name); close() }}
                            >
                                <UserOption user={user} secondary={isAmbiguous ? user.name : undefined} />
                            </FilterComboboxItem>
                        )
                    })}
                </CommandGroup>
            )}
        </FilterCombobox>
    )
}

function UserOption({ user, compact = false, secondary }: { user: UserData; compact?: boolean; secondary?: string }) {
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
            {/* Only set when another account shares this name: the id is the sole thing
                distinguishing the two rows. */}
            {secondary && (
                <span className="shrink-0 max-w-32 truncate text-sm leading-snug text-ink-gray-4">
                    {secondary}
                </span>
            )}
        </div>
    )
}
