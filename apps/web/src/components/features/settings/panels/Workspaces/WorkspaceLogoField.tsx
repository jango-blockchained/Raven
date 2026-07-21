import { useState } from "react"
import { useController, useFormContext } from "react-hook-form"
import { useFrappeFileUpload } from "frappe-react-sdk"
import { ImagePlus, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@components/ui/dialog"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { FileDropzone } from "@components/ui/file-dropzone"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import _ from "@lib/translate"
import type { WorkspaceFormData } from "./WorkspaceDetailView"

/**
 * Logo display + upload/remove controls; writes the file URL into the form's `logo`
 * field (persisted on Save). Tapping the logo opens an Upload / Remove menu — the
 * same interaction the Profile panel's avatar uses.
 */
const WorkspaceLogoField = () => {
    const { control, watch } = useFormContext<WorkspaceFormData>()
    const name = watch("name")
    const { field: { value, onChange } } = useController({ control, name: "logo" })
    const [uploadOpen, setUploadOpen] = useState(false)

    const avatar = (
        <Avatar className="h-24 w-24 rounded-xl">
            {value && <AvatarImage src={value} alt={_("Workspace Logo")} className="object-cover" />}
            <AvatarFallback className="rounded-xl text-2xl">
                {name?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
        </Avatar>
    )

    return (
        <>
            {value ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={_("Change logo")}
                            className="rounded-xl outline-none focus-visible:outline-none active:opacity-90"
                        >
                            {avatar}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-44">
                        <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                            <ImagePlus />
                            {_("Upload logo")}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => onChange("")}>
                            <Trash2 />
                            {_("Remove logo")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    aria-label={_("Upload logo")}
                    className="rounded-xl outline-none focus-visible:outline-none active:opacity-90"
                >
                    {avatar}
                </button>
            )}
            <UploadLogoDialog
                workspaceID={name}
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploaded={onChange}
            />
        </>
    )
}

const UploadLogoDialog = ({
    workspaceID, open, onOpenChange, onUploaded,
}: {
    workspaceID: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onUploaded: (url: string) => void
}) => {
    const [files, setFiles] = useState<File[]>([])
    const { upload, loading, error, reset } = useFrappeFileUpload()

    const handleOpenChange = (next: boolean) => {
        onOpenChange(next)
        if (!next) {
            setFiles([])
            reset()
        }
    }

    const onUpload = () => {
        const file = files[0]
        if (!file) return
        upload(file, {
            doctype: "Raven Workspace",
            docname: workspaceID,
            fieldname: "logo",
            otherData: { optimize: "1" },
            isPrivate: false,
        }).then((res) => {
            onUploaded(res.file_url)
            handleOpenChange(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{_("Upload logo")}</DialogTitle>
                </DialogHeader>
                {error && <ErrorBanner error={error} />}
                <FileDropzone
                    files={files}
                    setFiles={setFiles}
                    multiple={false}
                    accept={{ "image/*": [".jpeg", ".jpg", ".png", ".svg", ".webp"] }}
                />
                <DialogFooter>
                    <Button type="button" onClick={onUpload} disabled={files.length === 0 || loading}>
                        {loading && <Spinner />}
                        {_("Upload")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default WorkspaceLogoField
