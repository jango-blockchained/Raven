import { useEffect, useRef, useState, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useFrappePostCall, useFrappeFileUpload } from "frappe-react-sdk"
import { toast } from "sonner"
import { ImagePlus, Trash2 } from "lucide-react"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { UserAvatar, getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form"
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

type ProfileFormValues = {
    full_name: string
    availability_status: string
    custom_status: string
    user_image: string
}

/**
 * Bottom sheet for editing the current user's profile. A react-hook-form form is re-seeded
 * from the SWR `my_profile` each time the sheet opens; submit sends a single
 * frappe.client.set_value POST (raven.api.raven_users.update_raven_user is deprecated in v3),
 * then revalidates my_profile and closes. Save is disabled until something changes.
 */
export function EditProfileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")
    const { upload } = useFrappeFileUpload()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const form = useForm<ProfileFormValues>({
        defaultValues: { full_name: "", availability_status: "", custom_status: "", user_image: "" },
    })

    // Re-seed the form from the latest profile every time the sheet opens (also resets dirty state).
    useEffect(() => {
        if (!open || !myProfile) return
        form.reset({
            full_name: myProfile.full_name ?? "",
            availability_status: myProfile.availability_status ?? "",
            custom_status: myProfile.custom_status ?? "",
            user_image: myProfile.user_image ?? "",
        })
    }, [open, myProfile, form])

    // The avatar isn't a standard field — drive its preview off the watched form values.
    const [fullName, availabilityStatus, customStatus, image] = useWatch({
        control: form.control,
        name: ["full_name", "availability_status", "custom_status", "user_image"],
    })

    const onPickImage = async (file: File | undefined) => {
        if (!file || !myProfile?.name) return
        setUploading(true)
        try {
            const res = await upload(file, {
                isPrivate: false,
                doctype: "Raven User",
                docname: myProfile.name,
                fieldname: "user_image",
                otherData: { optimize: "1" },
            })
            form.setValue("user_image", res.file_url, { shouldDirty: true })
        } catch (e) {
            toast.error(_("Couldn't upload image"), { description: getErrorMessage(e as FrappeError) })
        } finally {
            setUploading(false)
        }
    }

    const onSubmit = async (values: ProfileFormValues) => {
        if (!myProfile?.name) return
        try {
            await call({ doctype: "Raven User", name: myProfile.name, fieldname: values })
            await mutate()
            toast.success(_("Profile updated"))
            onOpenChange(false)
        } catch (e) {
            toast.error(_("Couldn't update profile"), { description: getErrorMessage(e as FrappeError) })
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
            availability_status: (availabilityStatus as UserData["availability_status"]) || myProfile.availability_status,
            custom_status: customStatus || myProfile.custom_status,
            contact_number: myProfile.contact_number,
        }
    }, [myProfile, fullName, image, availabilityStatus, customStatus])

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerTitle className="sr-only">{_("Edit profile")}</DrawerTitle>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
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
                                        <DropdownMenuItem variant="destructive" onClick={() => form.setValue("user_image", "", { shouldDirty: true })}>
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
                        <FormField
                            control={form.control}
                            name="full_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Name")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-9 text-xl md:text-base" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Availability */}
                        <FormField
                            control={form.control}
                            name="availability_status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Availability")}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="h-9 text-xl md:text-base">
                                                <SelectValue placeholder={_("Set availability")} />
                                            </SelectTrigger>
                                        </FormControl>
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
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Custom status */}
                        <FormField
                            control={form.control}
                            name="custom_status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Status")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={_("What's your status?")} className="h-9 text-xl md:text-base" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex gap-2 pt-2">
                            <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => onOpenChange(false)}>{_("Cancel")}</Button>
                            <Button type="submit" size="md" className="flex-1" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>{_("Save")}</Button>
                        </div>
                    </form>
                </Form>
            </DrawerContent>
        </Drawer>
    )
}
