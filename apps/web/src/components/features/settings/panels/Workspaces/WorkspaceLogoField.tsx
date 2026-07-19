import { useState } from "react"
import { useController, useFormContext } from "react-hook-form"
import { useFrappeFileUpload } from "frappe-react-sdk"
import { CameraIcon, Trash2Icon } from "lucide-react"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "@components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@components/ui/dialog"
import { FileDropzone } from "@components/ui/file-dropzone"
import ErrorBanner from "@components/ui/error-banner"
import { Spinner } from "@components/ui/spinner"
import _ from "@lib/translate"
import type { WorkspaceFormData } from "./WorkspaceDetailView"

/** Logo display + upload/remove controls; writes the file URL into the form's `logo` field. */
const WorkspaceLogoField = () => {
    const { control, watch } = useFormContext<WorkspaceFormData>()
    const name = watch("name")
    const { field: { value, onChange } } = useController({ control, name: "logo" })

    return (
        <div className="relative">
            <Avatar className="h-24 w-24 rounded-xl">
                {value && <AvatarImage src={value} alt={_("Workspace Logo")} className="object-cover" />}
                <AvatarFallback className="rounded-xl text-2xl">
                    {name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <UploadLogoDialog workspaceID={name} onUploaded={onChange} />
            {value && <RemoveLogoDialog onRemove={() => onChange("")} />}
        </div>
    )
}

const UploadLogoDialog = ({
    workspaceID, onUploaded,
}: { workspaceID: string; onUploaded: (url: string) => void }) => {
    const [open, setOpen] = useState(false)
    const [files, setFiles] = useState<File[]>([])
    const { upload, loading, error, reset } = useFrappeFileUpload()

    const onOpenChange = (next: boolean) => {
        setOpen(next)
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
            onOpenChange(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    type="button" size="sm" isIconButton
                    className="absolute -right-2 -bottom-1 rounded-md shadow-md"
                    aria-label={_("Upload logo")}
                >
                    <CameraIcon />
                </Button>
            </DialogTrigger>
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

const RemoveLogoDialog = ({ onRemove }: { onRemove: () => void }) => (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button
                type="button" variant="outline" size="sm" isIconButton
                className="absolute -right-2 bottom-7 rounded-md shadow-md"
                aria-label={_("Remove logo")}
            >
                <Trash2Icon className="text-ink-red-3" />
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{_("Remove logo")}</AlertDialogTitle>
                <AlertDialogDescription>
                    {_("Are you sure you want to remove the logo?")}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>{_("Remove")}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)

export default WorkspaceLogoField
