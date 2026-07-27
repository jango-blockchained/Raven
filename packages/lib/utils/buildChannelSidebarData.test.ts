import { describe, expect, it } from "vitest"
import { buildChannelSidebarData } from "./buildChannelSidebarData"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { RavenUser } from "@raven/types/Raven/RavenUser"

const channel = (name: string, last_message_timestamp?: string) =>
    ({
        name,
        channel_name: name,
        workspace: "ws",
        type: "Public",
        is_archived: 0,
        member_id: "m",
        last_message_timestamp,
    } as unknown as ChannelListItem)

const profile = (overrides: Partial<RavenUser>) => ({ ...overrides } as RavenUser)

describe("buildChannelSidebarData", () => {
    it("sorts channels inside a group by that group's own sort_by", () => {
        const result = buildChannelSidebarData(
            [channel("zebra", "2026-07-01 00:00:00.000000"), channel("apple", "2026-01-01 00:00:00.000000")],
            profile({
                channel_groups: [{ group_name: "Design", sort_by: "Alphabetical Order" }],
                grouped_channels: [
                    { channel_id: "zebra", channel_group: "Design" },
                    { channel_id: "apple", channel_group: "Design" },
                ],
                sort_channels_by: "Recent Activity",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("falls back to the global preference when sort_by is blank", () => {
        const result = buildChannelSidebarData(
            [channel("zebra", "2026-07-01 00:00:00.000000"), channel("apple", "2026-01-01 00:00:00.000000")],
            profile({
                channel_groups: [{ group_name: "Design", sort_by: "" }],
                grouped_channels: [
                    { channel_id: "zebra", channel_group: "Design" },
                    { channel_id: "apple", channel_group: "Design" },
                ],
                sort_channels_by: "Alphabetical Order",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("sorts Favorites by the global preference", () => {
        const result = buildChannelSidebarData(
            [channel("zebra"), channel("apple")],
            profile({
                pinned_channels: [{ channel_id: "zebra" }, { channel_id: "apple" }],
                sort_channels_by: "Alphabetical Order",
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels[0][0]).toBe("Favorites")
        expect(result.groupedChannels[0][1].map((c) => c.channel_name)).toEqual(["apple", "zebra"])
    })

    it("drops groups that have no visible channels", () => {
        const result = buildChannelSidebarData(
            [channel("apple")],
            profile({
                channel_groups: [{ group_name: "Design" }, { group_name: "Empty" }],
                grouped_channels: [{ channel_id: "apple", channel_group: "Design" }],
            } as Partial<RavenUser>),
            "ws",
        )
        expect(result.groupedChannels.map(([name]) => name)).toEqual(["Design"])
    })

    it("excludes channels from other workspaces and archived channels", () => {
        const other = { ...channel("other"), workspace: "elsewhere" } as ChannelListItem
        const archived = { ...channel("archived"), is_archived: 1 } as unknown as ChannelListItem
        const result = buildChannelSidebarData([channel("apple"), other, archived], profile({}), "ws")
        expect(result.ungroupedChannels.map((c) => c.channel_name)).toEqual(["apple"])
    })
})
