import { lazy, Suspense } from 'react';
import { Hash } from '@components/common/ChannelIcon/ChannelIcon';
import { Dialog } from '@components/ui/dialog';
import { SettingsDialog, SettingsPanel, SettingsPanels, SettingsTabGroup, SettingsTabItem, SettingsTabs } from '@components/ui/settings-dialog';
import { Spinner } from '@components/ui/spinner';
import _ from '@lib/translate'
import { atom, useAtom } from 'jotai'
import { BellDotIcon, BellRingIcon, BotIcon, BrainCogIcon, Building2Icon, CalendarSyncIcon, CommandIcon, CpuIcon, FileTextIcon, FolderIcon, FunctionSquareIcon, IdCardIcon, InfoIcon, KeyboardIcon, PaletteIcon, PanelLeftIcon, SlidersHorizontalIcon, SmartphoneIcon, SmilePlusIcon, UserIcon, UsersIcon, WebhookIcon, ZapIcon } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook';
import useCurrentRavenUser from '@raven/lib/hooks/useCurrentRavenUser';
import { UserAvatar } from '../message/UserAvatar';
import { UserData } from '@db';

// Panels are CODE-SPLIT: the dialog shell ships with the app (its atom +
// hotkey must exist at boot), but a panel's chunk loads only when its tab is
// first opened — only the active panel is mounted (Radix Tabs unmounts the
// rest), so each Suspense below triggers exactly one load. Add new panels as
// lazy() consts here — an eager import drags the panel into the main bundle.
const Appearance = lazy(() => import('./panels/Appearance'));
const Preferences = lazy(() => import('./panels/Preferences'));
const CustomizeSidebarPanel = lazy(() =>
    import('../channel/CustomizeSidebar/CustomizeSidebarDialog').then((m) => ({ default: m.CustomizeSidebarDialog })),
);

const SETTINGS_TAB_GROUPS: { id: string, label: string }[] = [
    { id: "settings", label: _("Settings") },
    { id: "workspace", label: _("Workspace") },
    { id: "integrations", label: _("Integrations") },
    { id: "ai", label: _("AI") },
    { id: "other", label: _("Other") },
]

const HR_ICON = <svg width="61" height="61" viewBox="0 0 61 61" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M42.9279 0H17.1712C7.6878 0 0 7.6878 0 17.1712V42.9279C0 52.4113 7.6878 60.0991 17.1712 60.0991H42.9279C52.4113 60.0991 60.0991 52.4113 60.0991 42.9279V17.1712C60.0991 7.6878 52.4113 0 42.9279 0Z" fill="#06B58B" />
    <path d="M18.2228 47.2172L15.3252 44.0405C19.3819 40.3702 24.5976 38.3311 30.028 38.3311C35.4584 38.3311 40.6956 40.3487 44.7309 44.0405L41.8332 47.2172C38.5706 44.2551 34.3852 42.6238 30.028 42.6238C25.6708 42.6238 21.464 44.2551 18.2014 47.2172H18.2228Z" fill="white" />
    <path d="M32.0243 12.8762H19.4463V17.169H32.0243C34.3853 17.169 36.3171 19.1008 36.3171 21.4618V25.4541C36.3171 27.8151 34.3853 29.7469 32.0243 29.7469H28.0319C25.6708 29.7469 23.7391 27.8151 23.7391 25.4541V22.7496H19.4463V25.4541C19.4463 30.1976 23.2883 34.0397 28.0319 34.0397H32.0243C36.7678 34.0397 40.6099 30.1976 40.6099 25.4541V21.4618C40.6099 16.7183 36.7678 12.8762 32.0243 12.8762Z" fill="white" />
</svg>


const SETTINGS_TABS: {
    id: string
    group: (typeof SETTINGS_TAB_GROUPS)[number]["id"]
    label: string
    icon: React.ElementType
    /** The panel, as a LAZY component type (see the lazy() block above) —
     *  not an element, so nothing evaluates until the tab is opened.
     *  Absent = panel not built yet (renders a placeholder). */
    component?: React.ComponentType
}[] = [
    // Core settings
    {
        id: "profile",
        group: "settings",
        label: _("Profile"),
        icon: UserIcon,
    },
    {
        id: "appearance",
        group: "settings",
        label: _("Appearance"),
        icon: PaletteIcon,
        component: Appearance
    },
    {
        id: "preferences",
        group: "settings",
        label: _("Preferences"),
        icon: SlidersHorizontalIcon,
        component: Preferences
    },
    {
        id: "sidebar",
        group: "settings",
        label: _("Sidebar"),
        icon: PanelLeftIcon,
        component: CustomizeSidebarPanel
    },
    // Workspace settings
    {
        id: "users",
        group: "workspace",
        label: _("Users"),
        icon: UsersIcon,
    },
    {
        id: "workspaces",
        group: "workspace",
        label: _("Workspaces"),
        icon: Building2Icon,
    },
    {
        id: "channels",
        group: "workspace",
        label: _("Channels"),
        icon: Hash,
    },
    {
        id: "emojis",
        group: "workspace",
        label: _("Emojis"),
        icon: SmilePlusIcon,
    },
    // Integrations settings
    {
        id: "hr",
        group: "integrations",
        label: "Frappe HR",
        icon: () => HR_ICON,
    },
    {
        id: "document-notifications",
        group: "integrations",
        label: _("Document Notifications"),
        icon: BellDotIcon,
    },
    {
        id: "document-previews",
        group: "integrations",
        label: _("Document Previews"),
        icon: IdCardIcon,
    },
    {
        id: "message-actions",
        group: "integrations",
        label: _("Message Actions"),
        icon: ZapIcon,
    },
    {
        id: "scheduled-messages",
        group: "integrations",
        label: _("Scheduled Messages"),
        icon: CalendarSyncIcon,
    },
    {
        id: "webhooks",
        group: "integrations",
        label: _("Webhooks"),
        icon: WebhookIcon,
    },
    {
        id: "agents",
        group: "ai",
        label: _("Agents"),
        icon: BotIcon,
    },
    {
        id: "functions",
        group: "ai",
        label: _("Functions"),
        icon: FunctionSquareIcon,
    },
    {
        id: "file-sources",
        group: "ai",
        label: _("File Sources"),
        icon: FolderIcon,
    },
    {
        id: "instructions",
        group: "ai",
        label: _("Instructions"),
        icon: FileTextIcon,
    },
    {
        id: "document-processors",
        group: "ai",
        label: _("Document Processors"),
        icon: CpuIcon,
    },
    {
        id: "commands",
        group: "ai",
        label: _("Commands"),
        icon: CommandIcon,
    },
    {
        id: "ai-settings",
        group: "ai",
        label: _("AI Settings"),
        icon: BrainCogIcon,
    },
    {
        id: "push-notifications",
        group: "other",
        label: _("Notifications"),
        icon: BellRingIcon,
    },
    {
        id: "mobile-app",
        group: "other",
        label: _("Mobile App"),
        icon: SmartphoneIcon,
    },
    {
        id: "keyboard-shortcuts",
        group: "other",
        label: _("Keyboard Shortcuts"),
        icon: KeyboardIcon,
    },
    {
        id: "about",
        group: "other",
        label: _("About"),
        icon: InfoIcon,
    }
]

export const settingsDialogOpenTab = atom<"" | (typeof SETTINGS_TABS)[number]["id"]>("")

const RavenSettingsDialog = () => {

    const [openTab, setOpenTab] = useAtom(settingsDialogOpenTab)

    const onOpenChange = (open: boolean) => {
        if (!open) {
            setOpenTab("")
        }
    }

    useHotkeys("mod+slash", () => setOpenTab("profile"), { enableOnFormTags: true, preventDefault: true })

    const { myProfile } = useCurrentRavenUser()


    return (
        <Dialog open={openTab !== ""} onOpenChange={onOpenChange}>
            <SettingsDialog
                onClose={() => setOpenTab("")}
                defaultValue={"profile"} value={openTab}
                onValueChange={(value) => setOpenTab(value as (typeof SETTINGS_TABS)[number]["id"])}>
                <SettingsTabs>
                    {SETTINGS_TAB_GROUPS.map((group) => (
                        <SettingsTabGroup key={group.id} header={group.label}>
                            {SETTINGS_TABS.filter((tab) => tab.group === group.id).map((tab) => {

                                if (tab.id === "profile") {
                                    return <SettingsTabItem key={tab.id} value={tab.id}
                                        icon={<div className='flex items-center justify-center'><UserAvatar
                                            avatarClassName='h-4.5 w-4.5'
                                            user={{
                                                name: myProfile?.name || "",
                                                full_name: myProfile?.full_name || "",
                                                user_image: myProfile?.user_image || "",
                                                type: myProfile?.type || "",
                                                availability_status: myProfile?.availability_status || "",
                                                custom_status: myProfile?.custom_status || "",
                                                enabled: myProfile?.enabled || 1,
                                                first_name: myProfile?.first_name || "",
                                            } as UserData} size="xs" showStatusIndicator={false} /></div>} label={tab.label} />
                                }

                                return (
                                    <SettingsTabItem key={tab.id} value={tab.id} icon={<tab.icon />} label={tab.label} />
                                )
                            })}
                        </SettingsTabGroup>

                    ))}
                </SettingsTabs>
                <SettingsPanels>
                    {SETTINGS_TABS.map((tab) => (
                        <SettingsPanel key={tab.id} value={tab.id}>
                            <Suspense fallback={<PanelLoading />}>
                                {tab.component ? <tab.component /> : <PanelPlaceholder label={tab.label} />}
                            </Suspense>
                        </SettingsPanel>
                    ))}
                </SettingsPanels>

            </SettingsDialog>


        </Dialog>

    )
}

/** Chunk-load state while a panel's code fetches — one flash, first visit only. */
const PanelLoading = () => (
    <div className="flex h-full items-center justify-center">
        <Spinner />
    </div>
)

/** Stand-in for tabs whose panel isn't built yet. */
const PanelPlaceholder = ({ label }: { label: string }) => (
    <div className="flex h-full items-center justify-center text-sm text-ink-gray-4">
        {label}
    </div>
)

export default RavenSettingsDialog