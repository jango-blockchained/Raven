import { describe, expect, it } from "vitest"
import { sameEmojiSet, toSuggestedSet, type ReactionUsageRow } from "./reactionUsage"
import type { QuickEmoji } from "./preferences"

const row = (reaction: string, uses: number, custom = false, name?: string): ReactionUsageRow => ({
    reaction,
    is_custom: custom ? 1 : 0,
    reaction_escaped: name,
    uses,
})

describe("toSuggestedSet", () => {
    it("maps native and custom rows, keeping server order", () => {
        const set = toSuggestedSet([row("👍", 5), row("/files/party.png", 3, true, "party-blob")], 2)
        expect(set).toEqual([
            { id: "👍", native: "👍" },
            { id: "party-blob", src: "/files/party.png" },
        ])
    })

    it("returns nothing unless a FULL set exists (applied as one unit)", () => {
        expect(toSuggestedSet([row("👍", 5)], 2)).toEqual([])
        expect(toSuggestedSet(undefined, 2)).toEqual([])
    })

    it("caps at n", () => {
        expect(toSuggestedSet([row("a", 3), row("b", 2), row("c", 1)], 2)).toHaveLength(2)
    })
})

describe("sameEmojiSet", () => {
    const set = (...ids: string[]): QuickEmoji[] => ids.map((id) => ({ id }))

    it("matches regardless of order", () => {
        expect(sameEmojiSet(set("a", "b"), set("b", "a"))).toBe(true)
    })

    it("matches a picker slug id against a char id via native", () => {
        expect(sameEmojiSet([{ id: "❤️", native: "❤️" }], [{ id: "heart", native: "❤️" }])).toBe(true)
    })

    it("differs on any member or length", () => {
        expect(sameEmojiSet(set("a", "b"), set("a", "c"))).toBe(false)
        expect(sameEmojiSet(set("a"), set("a", "b"))).toBe(false)
    })
})
