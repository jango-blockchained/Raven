import { useRef, useState } from "react"
import { Plus, Camera, Images, BarChart3, FileBox, type LucideIcon, FilesIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@components/ui/drawer"
import { useAttachFile } from "./useFileInput"
import { CreatePollDialog } from "./CreatePollDialog"
import AttachFrappeDocumentDialog from "./AttachFrappeDocumentDialog"
import _ from "@lib/translate"

/**
 * Mobile composer overflow: a single "+" opens a bottom sheet. Three source
 * tiles on top (camera / photo library / files), action rows below (poll,
 * document). The poll/document dialogs are driven in controlled mode (their
 * triggers live here as sheet rows); every attach path funnels through the
 * shared useAttachFile, so size/type validation still applies.
 *
 * The tiles are three hidden file inputs whose ATTRIBUTES steer the OS picker:
 *   - camera:  accept="image/*,video/*" + capture — straight to the camera,
 *     with the OS camera UI offering both photo and video modes (one capture
 *     per trip; capture inputs don't support multiple)
 *   - photos:  accept="image/*,video/*", no capture — straight to the library
 *   - files:   unrestricted. iOS insists on its camera/library/file chooser
 *     here — WebKit's accept handling is broken (rdar 36726477) and no accept
 *     value skips the sheet, so restricting types only costs Android's direct
 *     picker its media files. One extra tap on iOS is a platform limitation.
 */
export const MobileComposerActions = ({
    channelID,
}: {
    channelID: string
}) => {
    const [sheetOpen, setSheetOpen] = useState(false)
    const [pollOpen, setPollOpen] = useState(false)
    const [docOpen, setDocOpen] = useState(false)
    const onAddFile = useAttachFile(channelID)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) onAddFile(e.target.files)
        e.target.value = ""
    }

    const sources: { icon: LucideIcon; label: string; inputRef: React.RefObject<HTMLInputElement | null> }[] = [
        { icon: Camera, label: _("Camera"), inputRef: cameraInputRef },
        { icon: Images, label: _("Photos"), inputRef: galleryInputRef },
        { icon: FilesIcon, label: _("Files"), inputRef: fileInputRef },
    ]

    const rows: { icon: LucideIcon; label: string; onClick: () => void }[] = [
        { icon: BarChart3, label: _("Create a poll"), onClick: () => setPollOpen(true) },
        { icon: FileBox, label: _("Attach a document"), onClick: () => setDocOpen(true) },
    ]

    return (
        <>
            <input type="file" accept="image/*,video/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={onPicked} />
            <input type="file" accept="image/*,video/*" multiple ref={galleryInputRef} className="hidden" onChange={onPicked} />
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={onPicked} />

            <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
                <DrawerTrigger asChild>
                    <Button type="button" variant="ghost" size="lg" isIconButton aria-label={_("More actions")} className="rounded-full">
                        <Plus className="size-8" />
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <DrawerTitle className="sr-only">{_("Composer actions")}</DrawerTitle>
                    <div className="flex flex-col gap-1 p-3 pb-10">
                        {/* Attachment sources — tiles, WhatsApp-style */}
                        <div className="grid grid-cols-3 gap-2 pb-2">
                            {sources.map((source) => (
                                <button
                                    key={source.label}
                                    type="button"
                                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-gray-1 py-5 transition-colors active:bg-surface-gray-3 dark:bg-surface-elevation-2 dark:active:bg-surface-elevation-3"
                                    onClick={() => {
                                        setSheetOpen(false)
                                        source.inputRef.current?.click()
                                    }}
                                >
                                    <source.icon className="size-6 text-ink-gray-7" />
                                    <span className="text-sm text-ink-gray-7">{source.label}</span>
                                </button>
                            ))}
                        </div>

                        {rows.map((row) => (
                            <Button
                                key={row.label}
                                variant="ghost"
                                size="lg"
                                className="w-full justify-start gap-3 text-xl-normal py-5 active:bg-surface-gray-3 dark:active:bg-surface-elevation-3 text-ink-gray-7 font-normal"
                                onClick={() => {
                                    setSheetOpen(false)
                                    row.onClick()
                                }}
                            >
                                <row.icon />
                                {row.label}
                            </Button>
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Controlled dialogs opened from the sheet rows (triggers hidden). */}
            <CreatePollDialog channelID={channelID} open={pollOpen} onOpenChange={setPollOpen} hideTrigger />
            <AttachFrappeDocumentDialog open={docOpen} onOpenChange={setDocOpen} hideTrigger />
        </>
    )
}
