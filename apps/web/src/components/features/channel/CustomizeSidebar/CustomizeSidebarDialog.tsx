import { Button } from "@components/ui/button"
import { SidebarPreview } from "./SidebarPreview"
import { useGroupedChannels } from "@raven/lib/hooks/useGroupedChannels"
import { useChannels } from "@stores/channels/useChannelList"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { ChannelTable } from "./ChannelTable"
import { RavenUser } from "@raven/types/Raven/RavenUser"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import _ from "@lib/translate"
import { GroupDnd } from "./GroupDnd"
import { useParams } from "react-router"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { WorkspaceSelect } from "@components/common/WorkspaceSelect"
import { H3 } from "@components/ui/typography"
import { SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle } from "@components/ui/settings-dialog"
import { errorResponseToast } from "@components/ui/error-banner"
import { DialogClose } from "@components/ui/dialog"

export const CustomizeSidebarDialog = () => {

    const { channels } = useChannels()
    const { myProfile, mutate } = useCurrentRavenUser()
    const [activeTab, setActiveTab] = useState('channels')

    const { updateDoc } = useFrappeUpdateDoc()


    const methods = useForm<RavenUser>({
        defaultValues: {
            ...myProfile
        }
    })
    const ravenUser = useWatch<RavenUser>({
        control: methods.control
    })
    const { workspaceID } = useParams()
    const { workspaces } = useWorkspaces()
    // Routes like /saved-messages, /search or /threads carry no :workspaceID, so
    // fall back to the first available workspace and let the user switch. Without
    // this the grouping filters to workspace `undefined` and the dialog is empty.
    const [pickedWorkspace, setPickedWorkspace] = useState<string | undefined>(undefined)
    const activeWorkspace = pickedWorkspace ?? workspaceID ?? workspaces?.[0]?.name ?? ''
    const channelSidebarData = useGroupedChannels(channels, ravenUser as RavenUser, activeWorkspace)

    const { handleSubmit } = methods

    const onSubmit = (data: RavenUser) => {
        if (myProfile) {
            updateDoc("Raven User", myProfile.name, data).then(() => {
                toast.success(_("Sidebar updated"))
                mutate()
            }).catch((error) => {
                errorResponseToast(_("Failed to update sidebar"), error)
            })
        }
    }

    const TABS: { key: 'channels' | 'groups'; label: string }[] = [
        { key: 'channels', label: _("Channels") },
        { key: 'groups', label: _("Groups") },
    ]

    return (
        <FormProvider {...methods}>
            <div className="flex flex-col h-full">
                <SettingsPanelHeader
                    actions={
                        <Button
                            type="button"
                            size="md"
                            onClick={handleSubmit(onSubmit)}
                        >
                            {_("Save")}
                        </Button>}>
                    <SettingsPanelTitle>{_("Customize Sidebar")}</SettingsPanelTitle>
                    <SettingsPanelDescription>
                        {_("Customize your sidebar channels and groups")}
                    </SettingsPanelDescription>
                </SettingsPanelHeader>
                <SettingsPanelContent>
                    {/* flex-1 min-h-0: fill the space between header and footer and DON'T grow
                        with content, so the table and preview columns get a bounded height and
                        scroll internally (otherwise the tall preview makes the whole panel scroll). */}
                    <div className="flex flex-1 min-h-0 w-full py-2">
                        {/* Left Column - Customization */}
                        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-surface-base pb-0">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <div className="flex items-center gap-2">
                                    <TabsList variant="subtle" size="sm" style={{ width: "fit-content" }}>
                                        {TABS.map(tab => (
                                            <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <WorkspaceSelect
                                        value={activeWorkspace}
                                        onValueChange={setPickedWorkspace}
                                        className="w-64"
                                        workspaces={workspaces}
                                    />
                                </div>
                                <div className="flex-1 flex flex-col min-h-0">
                                    <TabsContent value="channels" className="group-data-[orientation=horizontal]/tabs:py-0 flex-1 min-h-0 flex flex-col">
                                        <ChannelTable data={channelSidebarData} />
                                    </TabsContent>
                                    <TabsContent value="groups" className="group-data-[orientation=horizontal]/tabs:py-0 flex-1 min-h-0 flex flex-col">
                                        <div className="h-full overflow-y-auto pr-2">
                                            <GroupDnd />
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                        {/* Right Column - Preview (hidden on mobile) */}
                        <div className="hidden md:flex flex-none w-64 flex-col min-h-0 bg-surface-sidebar/40 border border-outline-gray-2 rounded overflow-hidden">
                            <div className="px-4 py-3 border-b shrink-0">
                                <H3 className="text-sm font-semibold">{_("Preview")}</H3>
                            </div>
                            <SidebarPreview data={channelSidebarData} />
                        </div>
                    </div>

                </SettingsPanelContent>
            </div>
        </FormProvider>
    )
}