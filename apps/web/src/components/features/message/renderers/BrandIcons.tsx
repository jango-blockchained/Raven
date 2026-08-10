import { cn } from "@lib/utils"

/**
 * Brand glyphs served by the backend (raven/public/brand_icons). Most are
 * monochrome simple-icons paths, painted in the brand colour via CSS mask
 * (an <img> can't be tinted). `color: null` = full-colour logo, rendered
 * as a plain <img>. Black brand marks (X, GitHub, Wikipedia) are painted
 * with the ink token instead of #000 — a true black mark disappears on a
 * dark background.
 */
const BRAND_ICON_BASE = "/assets/raven/brand_icons/"
export type BrandSpec = { file: string; color: string | null }
export const BRAND = {
    youtube: { file: "youtube.svg", color: "#FF0000" },
    youtubeMusic: { file: "youtubemusic.svg", color: "#FF0000" },
    spotify: { file: "spotify.svg", color: "#1ED760" },
    appleMusic: { file: "applemusic.svg", color: "#FA243C" },
    applePodcasts: { file: "applepodcasts.svg", color: "#9933CC" },
    soundcloud: { file: "soundcloud.svg", color: "#FF5500" },
    loom: { file: "loom.svg", color: "#625DF5" },
    vimeo: { file: "vimeo.svg", color: "#1AB7EA" },
    reddit: { file: "reddit.svg", color: "#FF4500" },
    zoom: { file: "zoom.svg", color: "#0B5CFF" },
    googleMeet: { file: "Google_Meet.svg", color: null },
    wikipedia: { file: "wikipedia.svg", color: "var(--ink-gray-9)" },
    figma: { file: "Figma.svg", color: null },
    frappeMeet: { file: "frappemeet.svg", color: null },
    frappe: { file: "frappe.svg", color: null },
    // The app's own tile (black square, white bird) — used for Raven links.
    raven: { file: "raven.svg", color: null },
    x: { file: "x.svg", color: "var(--ink-gray-9)" },
    github: { file: "github.svg", color: "var(--ink-gray-9)" },
    hackerNews: { file: "ycombinator.svg", color: "#FF6600" },
} satisfies Record<string, BrandSpec>

/** Server provider names (Raven Link Preview.provider) → brand glyph. */
export const PROVIDER_BRAND: Record<string, BrandSpec> = {
    Wikipedia: BRAND.wikipedia,
    Frappe: BRAND.frappe,
    X: BRAND.x,
    GitHub: BRAND.github,
    "Hacker News": BRAND.hackerNews,
    Reddit: BRAND.reddit,
    Figma: BRAND.figma,
    YouTube: BRAND.youtube,
    "YouTube Music": BRAND.youtubeMusic,
    Spotify: BRAND.spotify,
    Vimeo: BRAND.vimeo,
    Loom: BRAND.loom,
    SoundCloud: BRAND.soundcloud,
    "Apple Music": BRAND.appleMusic,
    "Apple Podcasts": BRAND.applePodcasts,
}

export const BrandIcon = ({ brand, className }: { brand: BrandSpec; className?: string }) =>
    brand.color ? (
        <span
            aria-hidden
            className={cn("inline-block size-12", className)}
            style={{
                backgroundColor: brand.color,
                maskImage: `url(${BRAND_ICON_BASE}${brand.file})`,
                maskRepeat: "no-repeat",
                maskPosition: "center",
                maskSize: "contain",
                WebkitMaskImage: `url(${BRAND_ICON_BASE}${brand.file})`,
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                WebkitMaskSize: "contain",
            }}
        />
    ) : (
        <img src={`${BRAND_ICON_BASE}${brand.file}`} alt="" className={cn("size-12", className)} />
    )
