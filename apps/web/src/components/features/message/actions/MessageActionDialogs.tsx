import { useRef } from "react"
import { useAtom } from "jotai"
import { messageDialogAtom } from "@utils/channelAtoms"
import { DeleteMessageDialog } from "./dialogs/DeleteMessageDialog"
import { ReactionsDialog } from "./dialogs/ReactionsDialog"
import { ForwardMessageDialog } from "./dialogs/ForwardMessageDialog"
import type { Message } from "@raven/types/common/Message"

/**
 * Orchestrator for message dialogs: mounted once per stream, it reads
 * `messageDialogAtom` and mounts each dialog — so menu items, the hover toolbar,
 * and keyboard shortcuts all open the same instances without per-message mounting.
 *
 * Each real dialog lives in ./dialogs/<Name>.tsx (extracted as its layer lands).
 * Delete, reactions and forward are done; edit is inline (see EditMessageComposer, no dialog).
 */
export const MessageActionDialogs = () => {
    const [dialog, setDialog] = useAtom(messageDialogAtom)
    const close = () => setDialog(null)

    // Render the delete / reactions dialogs from the LAST target so their content stays put
    // through the close animation instead of flashing empty (same trick as the menu).
    const lastDeleteRef = useRef<Message | null>(null)
    if (dialog?.type === "delete") lastDeleteRef.current = dialog.message
    const lastReactionsRef = useRef<Message | null>(null)
    if (dialog?.type === "reactions") lastReactionsRef.current = dialog.message
    const lastForwardRef = useRef<Message | null>(null)
    if (dialog?.type === "forward") lastForwardRef.current = dialog.message

    return (
        <>
            <DeleteMessageDialog
                open={dialog?.type === "delete"}
                message={dialog?.type === "delete" ? dialog.message : lastDeleteRef.current}
                onClose={close}
            />

            <ReactionsDialog
                open={dialog?.type === "reactions"}
                message={dialog?.type === "reactions" ? dialog.message : lastReactionsRef.current}
                onClose={close}
            />

            <ForwardMessageDialog
                open={dialog?.type === "forward"}
                message={dialog?.type === "forward" ? dialog.message : lastForwardRef.current}
                onClose={close}
            />
        </>
    )
}
