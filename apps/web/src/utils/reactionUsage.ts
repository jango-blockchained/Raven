import { useFrappeGetCall } from "frappe-react-sdk"
import type { QuickEmoji } from "./preferences"

/** A row of raven.api.reactions.most_used_reactions — the user's most-used
 *  reactions of the past 3 months, counted server-side across devices.
 *  Removed reactions don't count (un-reacting deletes the row). */
export type ReactionUsageRow = { reaction: string; is_custom: 0 | 1; reaction_escaped?: string | null; uses: number }

/** Server rows → QuickEmoji list; empty unless a FULL set of `n` exists (the
 *  suggestion row applies as one unit). Custom emojis carry the image URL in
 *  `reaction` and their name in `reaction_escaped`. */
export const toSuggestedSet = (rows: ReactionUsageRow[] | undefined, n: number): QuickEmoji[] => {
    const mapped = (rows ?? []).slice(0, n).map((row): QuickEmoji =>
        row.is_custom
            ? { id: row.reaction_escaped || row.reaction, src: row.reaction }
            : { id: row.reaction, native: row.reaction },
    )
    return mapped.length === n ? mapped : []
}

/** Same emojis regardless of order — an equal suggestion has nothing to offer.
 *  Compares by native char (falling back to id): picker entries carry slug ids
 *  ("heart") while server rows carry the char, so ids alone can't match. */
const identity = (emoji: QuickEmoji) => emoji.native ?? emoji.id
export const sameEmojiSet = (a: QuickEmoji[], b: QuickEmoji[]): boolean =>
    a.length === b.length && a.every((emoji) => b.some((other) => identity(other) === identity(emoji)))

/** The user's `n` most-used reactions, fetched once per preferences surface
 *  and cached by SWR (no focus revalidation — this changes slowly). */
export const useSuggestedReactions = (n: number): QuickEmoji[] => {
    const { data } = useFrappeGetCall<{ message: ReactionUsageRow[] }>(
        "raven.api.reactions.most_used_reactions",
        { limit: n },
        undefined,
        { revalidateOnFocus: false },
    )
    return toSuggestedSet(data?.message, n)
}
