import { useState } from "react"
import { NavLink, Navigate } from "react-router"
import { toast } from "sonner"
import { Bookmark, Bell, LogOut, Sun, Moon, SunMoon, ChevronDown, Edit } from "lucide-react"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { useTheme } from "@components/theme-provider"
import { useLogout } from "@hooks/useLogout"
import { useIsMobile } from "@hooks/use-mobile"
import { useIsPushNotificationEnabled } from "@hooks/fetchers/useIsPushNotificationEnabled"
import { ProfileRow } from "@components/features/profile/ProfileRow"
import { EditProfileDrawer } from "@components/features/profile/EditProfileDrawer"
import { ProfileImageMenu } from "@components/features/profile/ProfileImageMenu"
import { PageHeader } from "@components/layout/PageHeader"
import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { cn } from "@lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Switch } from "@components/ui/switch"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import { getErrorMessage } from "@lib/frappe"
import { FrappeError } from "frappe-react-sdk"
import _ from "@lib/translate"

const Profile = () => {
    const { myProfile } = useCurrentRavenUser()
    const { theme, setTheme } = useTheme()
    const { logout, isLoggingOut } = useLogout()
    const isMobile = useIsMobile()
    const isPushAvailable = useIsPushNotificationEnabled()
    const [editOpen, setEditOpen] = useState(false)
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)

    // Seed from the injected push helper; toggling calls enable/disable and re-reads.
    const [pushOn, setPushOn] = useState<boolean>(() => {
        // @ts-expect-error - frappePushNotification is injected in main.tsx
        return Boolean(window.frappePushNotification?.isNotificationEnabled?.())
    })

    const togglePush = (next: boolean) => {
        // @ts-expect-error - frappePushNotification is injected in main.tsx
        const helper = window.frappePushNotification
        if (!helper) return
        if (next) {
            toast.promise(
                helper.enableNotification().then((data: { permission_granted: boolean }) => {
                    if (!data.permission_granted) { setPushOn(false); throw new Error(_("Permission denied for push notifications")) }
                    setPushOn(true)
                }),
                { loading: _("Enabling…"), success: _("Push notifications enabled"), error: (e: Error) => e.message },
            )
        } else {
            helper.disableNotification()
                .then(() => { setPushOn(false); toast.info(_("Push notifications disabled")) })
                .catch((e: unknown) => toast.error(_("There was an error"), { description: getErrorMessage(e as FrappeError) }))
        }
    }

    // Mobile/PWA-only page — desktop has the settings dialog instead. Redirect home if
    // somehow reached on desktop (e.g. direct URL). Checked after hooks to keep hook order.
    if (!isMobile) return <Navigate to="/" replace />

    return (
        <div className="flex h-dvh flex-col overflow-hidden">
            <PageHeader title={_("Profile")} />

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* Identity card */}
                <div className="gap-1">
                    {myProfile && (
                        <div className="flex flex-col w-full items-center gap-4 px-4 py-4 text-left">
                            {/* Tapping the avatar opens the Upload / Remove photo menu */}
                            <ProfileImageMenu />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <span className="truncate text-4xl-semibold text-center text-ink-gray-9">{myProfile.full_name}</span>
                                {myProfile.availability_status && (
                                    <span className="flex items-center justify-center gap-1.5 text-base md:text-sm text-ink-gray-5">
                                        <span className={cn("size-2 shrink-0 rounded-full", getStatusIndicatorColor(myProfile.availability_status))} />
                                        <span className="truncate">{myProfile.availability_status}</span>
                                    </span>
                                )}
                                <div>
                                    {myProfile?.custom_status && <span className="truncate text-center text-lg md:text-sm text-ink-gray-6">{myProfile.custom_status}</span>}
                                </div>
                            </div>

                        </div>
                    )}

                </div>
                <div className="flex flex-col px-1 gap-2">
                    {/* Appearance — whole row opens the theme menu; icon + label reflect the choice */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <ProfileRow
                                icon={theme === "dark" ? Moon : theme === "system" ? SunMoon : Sun}
                                label={_("Appearance")}
                                trailing={
                                    <span className="flex items-center gap-1 text-base text-ink-gray-7">
                                        {theme === "dark" ? _("Dark") : theme === "system" ? _("System") : _("Light")}
                                        <ChevronDown className="size-4" />
                                    </span>
                                }
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setTheme("light")}><Sun />{_("Light")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}><Moon />{_("Dark")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("system")}><SunMoon />{_("System")}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Push notifications — only when the server can deliver them. asLabel
                        makes a tap anywhere on the row toggle the switch. */}
                    {isPushAvailable && (
                        <ProfileRow
                            icon={Bell}
                            label={_("Push notifications")}
                            asLabel
                            trailing={<Switch size="md" checked={pushOn} onCheckedChange={togglePush} />}
                        />
                    )}
                    {/* Saved messages */}
                    <NavLink to="/saved-messages">
                        <ProfileRow icon={Bookmark} label={_("Saved messages")} chevron />
                    </NavLink>

                    <ProfileRow icon={Edit} label={_("Edit profile")} onClick={() => setEditOpen(true)} />

                    {/* Log out */}
                    <ProfileRow icon={LogOut} label={_("Log out")} destructive onClick={() => setConfirmLogoutOpen(true)} />
                </div>

                <div className="px-4 py-16 text-center w-full flex items-center justify-center flex-col gap-2">
                    <span className="text-sm text-ink-gray-4">Raven <span className="font-numeric">v{window?.frappe?.boot.versions.raven}</span></span>
                    <img src="/assets/frappe/images/frappe-comp-logo.svg" alt="Frappe" className="h-4.5 w-auto dark:invert" />
                </div>
            </div>

            <EditProfileDrawer open={editOpen} onOpenChange={setEditOpen} />

            <AlertDialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">
                            {_("Log out of your account?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="sr-only">
                            {_("Are you sure you want to log out of your account?")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoggingOut}>{_("Cancel")}</AlertDialogCancel>
                        {/* Plain Button (not AlertDialogAction) so the dialog stays open with a
                            spinner while logging out; on failure the toast shows and it remains. */}
                        <Button type="button" variant="solid" theme="red" size="md" loading={isLoggingOut} loadingText={_("Logging out…")} onClick={logout}>
                            {_("Log out")}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AppMobileFooter />
        </div>
    )
}

export default Profile
