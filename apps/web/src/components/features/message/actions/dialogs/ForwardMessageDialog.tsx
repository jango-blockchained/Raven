import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { CommandGroup } from "@components/ui/command"
import { FilterCombobox, FilterComboboxItem } from "@components/common/filters/FilterCombobox"
import { ChannelOption, getChannelLabel } from "@components/common/filters/ChannelFilter"
import { UserOption, getAmbiguousNames } from "@components/common/filters/UserFilter"
import { useChannels } from "@stores/channels/useChannelList"
import { useUsers } from "@hooks/useUsers"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { useCreateDM } from "@hooks/useCreateDM"
import { errorResponseToast } from "@components/ui/error-banner"
import { buildForwardPayload } from "./forwardPayload"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { UserData } from "@db"

/**
 * Where a forward is going. A person is NOT pre-resolved to their DM channel: the DM may
 * not exist yet, and creating one just because a row was highlighted would litter the
 * sidebar with empty conversations. Resolution happens on Send.
 */
type Recipient =
    | { kind: "channel"; channel: ChannelListItem }
    | { kind: "user"; user: UserData }

/**
 * cmdk needs one unique value per row, and this list mixes two doctypes, so each id is
 * namespaced with a sigil. The sigil must stay non-alphabetic: scoreFilterRow falls back
 * to `value.includes(needle)` so ids/emails stay searchable, and an alphabetic prefix
 * like "channel:" or "user:" would itself match early keystrokes ("a", "ch", "us"...),
 * keeping the whole list alive instead of narrowing it. `@` costs nothing extra for
 * users since it's already inherent to every email.
 */
const recipientValue = (recipient: Recipient): string =>
    recipient.kind === "channel" ? `#${recipient.channel.name}` : `@${recipient.user.name}`

/**
 * Single-recipient picker for the forward dialog. Structurally ChannelFilter: same shell,
 * same two tiers (channels by workspace, then Direct Messages), same rows, same
 * flatten-on-search rule — so a row here reads exactly like a row there.
 *
 * The one difference is who fills the Direct Messages group. ChannelFilter lists DM
 * CHANNELS, which shows only people you have already messaged; this lists USERS, so
 * every colleague is reachable. It costs nothing downstream: onSend resolves a person to
 * their DM channel anyway (creating it if needed), which is the same id a DM-channel row
 * would have carried.
 */
const RecipientCombobox = ({
    value,
    onChange,
}: {
    value: Recipient | null
    onChange: (recipient: Recipient) => void
}) => {
    const { channels: allChannels } = useChannels()
    const users = useUsers()
    const { workspaces } = useWorkspaces()

    // Diverges from ChannelFilter here on purpose. ChannelFilter is a search filter —
    // browsing an archived channel's history is legitimate — but this is a destination
    // picker, and archived/non-member channels can't actually receive a post: archived
    // is blocked client-side only (there is no server check), so leaving it unfiltered
    // would let a forward succeed into a channel the product says is read-only. Mirrors
    // useCanInteractInChannel's exact condition (@stores/channels/useChannelList) rather
    // than inventing a new predicate; duplicated instead of reused because that hook is
    // useSyncExternalStore-shaped for one channel id, not a list filter.
    const channels = useMemo(
        () => allChannels.filter((channel) => !channel.is_archived && (channel.type === "Open" || Boolean(channel.member_id))),
        [allChannels],
    )

    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.name, workspace.workspace_name])),
        [workspaces],
    )

    const channelsByWorkspace = useMemo(() => {
        const groups = new Map<string, ChannelListItem[]>()
        for (const channel of channels) {
            const key = channel.workspace ?? ""
            const list = groups.get(key)
            if (list) list.push(channel)
            else groups.set(key, [channel])
        }
        return Array.from(groups.entries())
    }, [channels])

    // Bots stay — a bot DM is a real destination. Deactivated accounts go: forwarding
    // into a dead account's DM helps nobody.
    const people = useMemo(() => users.filter((user) => user.enabled), [users])
    const ambiguousNames = useMemo(() => getAmbiguousNames(people), [people])

    const selectedValue = value ? recipientValue(value) : null

    return (
        <FilterCombobox
            // Inside a modal dialog — see FilterCombobox's `modal` prop. Without it the
            // dialog's scroll lock swallows this list's wheel events entirely.
            modal
            triggerClassName="w-full"
            emptyLabel={_("No channels or people found.")}
            trigger={
                value ? (
                    value.kind === "channel" ? (
                        <ChannelOption channel={value.channel} compact />
                    ) : (
                        <UserOption user={value.user} compact />
                    )
                ) : (
                    <span className="min-w-0 flex-1 truncate text-left leading-snug text-ink-gray-4">
                        {_("Select a channel or person")}
                    </span>
                )
            }
        >
            {(close, search) => {
                const channelItem = (channel: ChannelListItem, workspaceName?: string) => {
                    const recipient: Recipient = { kind: "channel", channel }
                    const rowValue = recipientValue(recipient)
                    return (
                        <FilterComboboxItem
                            key={channel.name}
                            value={rowValue}
                            keywords={[getChannelLabel(channel)]}
                            selected={selectedValue === rowValue}
                            onSelect={() => {
                                onChange(recipient)
                                close()
                            }}
                        >
                            <ChannelOption channel={channel} workspaceName={workspaceName} />
                        </FilterComboboxItem>
                    )
                }

                // `secondary` is the same right-hand slot ChannelFilter puts the workspace
                // name in. A duplicate full name takes priority over the group label,
                // because two identical rows are unusable while a missing "Direct Message"
                // tag is merely less tidy.
                const userItem = (user: UserData, groupLabel?: string) => {
                    const recipient: Recipient = { kind: "user", user }
                    const rowValue = recipientValue(recipient)
                    const name = user.full_name ?? user.name
                    return (
                        <FilterComboboxItem
                            key={user.name}
                            value={rowValue}
                            keywords={[name]}
                            selected={selectedValue === rowValue}
                            onSelect={() => {
                                onChange(recipient)
                                close()
                            }}
                        >
                            <UserOption user={user} secondary={ambiguousNames.has(name) ? user.name : groupLabel} />
                        </FilterComboboxItem>
                    )
                }

                // Searching flattens everything into one group. cmdk ranks items within a
                // group but leaves group order alone, so grouped results let a weak match
                // in an early group outrank an exact one later — the same reason
                // ChannelFilter flattens. Each row then carries the heading it lost.
                if (search) {
                    return (
                        <CommandGroup>
                            {channels.map((channel) =>
                                channelItem(
                                    channel,
                                    channel.workspace
                                        ? (workspaceNames.get(channel.workspace) ?? channel.workspace)
                                        : undefined,
                                ),
                            )}
                            {people.map((user) => userItem(user, _("Direct Message")))}
                        </CommandGroup>
                    )
                }

                return (
                    <>
                        {channelsByWorkspace.map(([workspaceID, workspaceChannels]) => (
                            <CommandGroup key={workspaceID} heading={workspaceNames.get(workspaceID) ?? workspaceID}>
                                {/* Arrow, not a bare reference: map would pass the index as
                                    the workspace name. */}
                                {workspaceChannels.map((channel) => channelItem(channel))}
                            </CommandGroup>
                        ))}
                        {people.length > 0 && (
                            <CommandGroup heading={_("Direct Messages")}>
                                {people.map((user) => userItem(user))}
                            </CommandGroup>
                        )}
                    </>
                )
            }}
        </FilterCombobox>
    )
}

/**
 * Forward a message to ONE channel or person.
 *
 * The recipient is resolved to a channel id BEFORE the API call — creating the DM if it
 * doesn't exist — rather than handing the backend a `type: "User"` receiver. The backend
 * supports that and creates the DM itself, but it returns only "messages forwarded", so
 * the client would have no id to offer a "View" link to.
 *
 * Nothing is applied to the destination's message store: you're almost never looking at
 * the channel you forwarded into, and where you are, the `message_created` realtime event
 * delivers the copy on the same path as any other incoming message.
 *
 * Mounted once by MessageActionDialogs and driven by messageDialogAtom; stays mounted
 * (open toggles) so it animates closed, with `message` held from the last target so the
 * body doesn't flash empty mid-animation.
 */
export const ForwardMessageDialog = ({
    open,
    message,
    onClose,
}: {
    open: boolean
    message: Message | null
    onClose: () => void
}) => {
    const navigate = useNavigate()
    const { createDM } = useCreateDM()
    const { call: forwardMessage } = useFrappePostCall("raven.api.raven_message.forward_message")

    const [recipient, setRecipient] = useState<Recipient | null>(null)
    const [sending, setSending] = useState(false)

    // Clear the picked recipient whenever the target changes. The dialog stays mounted for
    // the open/close animation, so this can't live in useState initialisation — without it
    // the next forward opens pre-filled with the last one's destination.
    useEffect(() => {
        if (!open) return
        setRecipient(null)
        setSending(false)
    }, [open, message?.name])

    const onSend = async () => {
        if (!message || !recipient || sending) return
        setSending(true)

        // A person resolves to their DM channel — existing ones cost no API call.
        const destination =
            recipient.kind === "channel"
                ? recipient.channel.name
                : await createDM(recipient.user.name, { navigate: false })

        // createDM already toasted its own failure; keep the dialog open so Send can be
        // retried with the recipient still picked.
        if (!destination) {
            setSending(false)
            return
        }

        const target =
            recipient.kind === "channel"
                ? `/${encodeURIComponent(recipient.channel.workspace ?? "")}/${encodeURIComponent(destination)}`
                : `/dm-channel/${encodeURIComponent(destination)}`

        forwardMessage({
            message_receivers: [{ type: "Channel", name: destination }],
            forwarded_message: buildForwardPayload(message),
        })
            .then(() => {
                onClose()
                toast.success(_("Message forwarded"), {
                    action: { label: _("View"), onClick: () => navigate(target) },
                })
            })
            .catch((error) => {
                errorResponseToast(_("Could not forward message"), error)
            })
            .finally(() => setSending(false))
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{_("Forward message")}</DialogTitle>
                    <DialogDescription>{_("Choose where to forward this message.")}</DialogDescription>
                </DialogHeader>

                <RecipientCombobox value={recipient} onChange={setRecipient} />

                <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
                    <Button variant="outline" size="md" onClick={onClose} disabled={sending}>
                        {_("Cancel")}
                    </Button>
                    <Button variant="solid" size="md" onClick={onSend} disabled={!recipient || sending}>
                        {sending ? _("Sending") : _("Send")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
