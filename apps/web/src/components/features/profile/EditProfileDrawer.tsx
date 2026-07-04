import { useEffect, useRef, useState, useMemo } from "react"
import { useFrappePostCall, useFrappeFileUpload } from "frappe-react-sdk"
import { toast } from "sonner"
import { ImagePlus, Trash2 } from "lucide-react"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { UserAvatar, getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { Spinner } from "@components/ui/spinner"
import { getErrorMessage } from "@lib/frappe"
import { FrappeError } from "frappe-react-sdk"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { UserData } from "@db"

const STATUS_OPTIONS = [
    { value: "Available", label: _("Available") },
    { value: "Away", label: _("Away") },
    { value: "Do not disturb", label: _("Do not disturb") },
    { value: "Invisible", label: _("Invisible") },
] as const

/**
 * Bottom sheet for editing the current user's profile. Seeds local state from the SWR
 * `my_profile` each time it opens; a single frappe.client.set_value POST saves all fields
 * (raven.api.raven_users.update_raven_user is deprecated in v3), then revalidates
 * my_profile and closes.
 */
export function EditProfileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")
    const { upload } = useFrappeFileUpload()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [fullName, setFullName] = useState("")
    const [status, setStatus] = useState("")
    const [customStatus, setCustomStatus] = useState("")
    const [image, setImage] = useState("")
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Re-seed the form from the latest profile every time the sheet opens.
    useEffect(() => {
        if (!open || !myProfile) return
        setFullName(myProfile.full_name ?? "")
        setStatus(myProfile.availability_status ?? "")
        setCustomStatus(myProfile.custom_status ?? "")
        setImage(myProfile.user_image ?? "")
    }, [open, myProfile])

    const onPickImage = async (file: File | undefined) => {
        if (!file || !myProfile?.name) return
        setUploading(true)
        try {
            const res = await upload(file, {
                isPrivate: false,
                doctype: "Raven User",
                docname: myProfile.name,
                fieldname: "user_image",
            })
            setImage(res.file_url)
        } catch (e) {
            toast.error(_("Couldn't upload image"), { description: getErrorMessage(e as FrappeError) })
        } finally {
            setUploading(false)
        }
    }

    const onSave = async () => {
        if (!myProfile?.name) return
        setSaving(true)
        try {
            await call({
                doctype: "Raven User",
                name: myProfile.name,
                fieldname: {
                    full_name: fullName,
                    availability_status: status,
                    custom_status: customStatus,
                    user_image: image,
                },
            })
            await mutate()
            toast.success(_("Profile updated"))
            onOpenChange(false)
        } catch (e) {
            toast.error(_("Couldn't update profile"), { description: getErrorMessage(e as FrappeError) })
        } finally {
            setSaving(false)
        }
    }

    const previewUser: UserData | undefined = useMemo(() => {
        if (!myProfile) return undefined
        return {
            name: myProfile.name,
            full_name: fullName || myProfile.full_name,
            user_image: image || undefined,
            first_name: myProfile.first_name,
            enabled: myProfile.enabled,
            type: myProfile.type,
            availability_status: (status as UserData["availability_status"]) || myProfile.availability_status,
            custom_status: customStatus || myProfile.custom_status,
            contact_number: myProfile.contact_number,
        }
    }, [myProfile, fullName, image, status, customStatus])

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerTitle className="sr-only">{_("Edit profile")}</DrawerTitle>
                <div className="flex flex-col gap-4 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <h2 className="text-xl font-medium text-ink-gray-8">{_("Edit profile")}</h2>

                    {/* Avatar — the pic itself opens a menu (Upload / Remove) */}
                    <div className="flex flex-col items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={_("Change photo")}
                                    className="relative flex rounded-xl outline-none focus-visible:outline-none active:opacity-90 [&_[data-slot=avatar-fallback]]:rounded-xl"
                                >
                                    {previewUser && <UserAvatar user={previewUser} size="xl" avatarClassName="rounded-xl size-28" />}
                                    {uploading && (
                                        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                                            <Spinner className="text-white" />
                                        </span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-44">
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                    <ImagePlus />
                                    {_("Upload a photo")}
                                </DropdownMenuItem>
                                {image && (
                                    <DropdownMenuItem variant="destructive" onClick={() => setImage("")}>
                                        <Trash2 />
                                        {_("Remove photo")}
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = "" }}
                        />
                    </div>

                    {/* Full name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="profile-full-name">{_("Name")}</Label>
                        <Input id="profile-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-xl md:text-base" />
                    </div>

                    {/* Availability */}
                    <div className="flex flex-col gap-1.5">
                        <Label>{_("Availability")}</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-9 text-xl md:text-base">
                                <SelectValue placeholder={_("Set availability")} />
                            </SelectTrigger>
                            <SelectContent align="start">
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        <span className="flex items-center gap-2">
                                            <span className={cn("size-2 rounded-full", getStatusIndicatorColor(o.value))} />
                                            {o.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom status */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="profile-custom-status">{_("Status")}</Label>
                        <Input id="profile-custom-status" value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder={_("What's your status?")} className="h-9 text-xl md:text-base" />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => onOpenChange(false)}>{_("Cancel")}</Button>
                        <Button type="button" size="md" className="flex-1" onClick={onSave} loading={saving}>{_("Save")}</Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
