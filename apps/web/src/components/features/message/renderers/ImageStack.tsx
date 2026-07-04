import { cn } from "@lib/utils"
import { Badge } from "@components/ui/badge"
import { type ImageFile } from "./ImageMessage"
import { ReservedImage } from "./ReservedImage"

/** Tiny deterministic string hash — same input always yields the same index. */
const hashString = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return Math.abs(h)
}

/**
 * Normalizes each image into a unit square (longest side = 1), aspect preserved,
 * with a 4:3 fallback for old messages. The pile is then laid out as percentages
 * of a responsive container, so cards keep their own width AND height (the
 * width-peek) and scale together across breakpoints — all from stored dims, no
 * DOM measurement.
 */
const unitDims = (image: ImageFile) => {
    const w = image.width || 4
    const h = image.height || 3
    const s = 1 / Math.max(w, h)
    return { w: w * s, h: h * s }
}

/**
 * EXPERIMENT — iOS-style stacked photos.
 *
 * Instead of a grid/carousel, a group of images is rendered as a small pile of
 * cards: the first image on top with a hint of tilt, the ones beneath peeking out
 * with seeded offset + rotation and their own shadow, like a stack of physical
 * photos. On hover the pile fans open a touch. Clicking opens the existing viewer
 * at the top (first) image — the rest are reachable from there as before.
 *
 * The container's size is derived from the cards' stored dimensions (responsive
 * width by breakpoint + a bounding-box aspect ratio), so message heights are
 * deterministic — no resize after paint, no DOM measurement. Only the first four
 * images are drawn; a badge counts the rest.
 */
export const ImageStack = ({ images, onImageClick }: { images: ImageFile[]; onImageClick: (image: ImageFile) => void }) => {
    const cards = images.slice(0, 4)
    const top = cards[0]
    const remaining = images.length - cards.length

    // Normalize every card, then the bounding box is the widest × tallest extent.
    // The container takes that aspect ratio (responsive width set in className);
    // each card is sized as a % of it, so the widest card fills the width and the
    // tallest fills the height — peek in both axes, nothing cut off.
    const norm = cards.map(unitDims)
    const boxW = Math.max(...norm.map((n) => n.w))
    const boxH = Math.max(...norm.map((n) => n.h))

    // Only stacking order is tied to depth.
    const zByDepth = ["z-30", "z-20", "z-10", "z-0"]

    // Side ALTERNATES by depth so the pile always spreads both ways (never ends
    // up lopsided); only the MAGNITUDE is seeded off the image name, so it stays
    // varied yet balanced. Rotation follows the same side — a card tossed right
    // tilts right, which reads naturally. Literal class strings so Tailwind's JIT
    // keeps them. Each palette is indexed by a 0–2 magnitude bucket.
    const xRight = ["translate-x-4 group-hover:translate-x-8", "translate-x-6 group-hover:translate-x-10", "translate-x-8 group-hover:translate-x-12"]
    const xLeft = ["-translate-x-4 group-hover:-translate-x-8", "-translate-x-6 group-hover:-translate-x-10", "-translate-x-8 group-hover:-translate-x-12"]
    const rotRight = ["rotate-3 group-hover:rotate-6", "rotate-6 group-hover:rotate-12", "rotate-6 group-hover:rotate-12"]
    const rotLeft = ["-rotate-3 group-hover:-rotate-6", "-rotate-6 group-hover:-rotate-12", "-rotate-6 group-hover:-rotate-12"]
    // Vertical is a depth LADDER, not jitter (iMessage/Instagram-style): each card
    // steps progressively further down in the order it was sent, so every under-card's
    // bottom edge peeks out below the one above it. Indexed by depth, not seeded —
    // order is the whole point here.
    const yByDepth = [
        "translate-y-0",
        "translate-y-3 group-hover:translate-y-5",
        "translate-y-6 group-hover:translate-y-9",
        "translate-y-9 group-hover:translate-y-12",
    ]
    // Top card gets just a hint of tilt (seeded) so it reads natural, not rigid.
    const topTilt = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2"]

    return (
        // generous padding so the tilted/jittered corners + shadow have room and
        // aren't clipped by neighbouring message rows. Sized for the HOVER extents,
        // not the resting pile: the deepest card fans 48px down (y-12) and a 12°
        // rotation adds ~25px of corner overhang on a box-filling card, plus the
        // shadow. Asymmetric vertically — the ladder only steps DOWN; the top only
        // sees rotation overhang + the top card's small lift.
        <div className="px-12 pt-8 pb-20">
            <div
                data-message-id={top.message_id}
                // responsive width by breakpoint (standard scale); height follows
                // from the bounding-box aspect ratio below
                className="group relative w-56 cursor-pointer sm:w-64 md:w-72 lg:w-80"
                style={{ aspectRatio: boxW / boxH }}
                onClick={() => onImageClick(top)}
            >
                {cards.map((image, index) => {
                    const n = norm[index]
                    const isTop = index === 0
                    // Horizontal side alternates by depth (balanced) with seeded magnitude
                    // (varied); vertical is the depth ladder — deeper card, lower peek.
                    const right = index % 2 === 1
                    const mag = hashString(image.name) % 3
                    const x = isTop ? "translate-x-0" : right ? xRight[mag] : xLeft[mag]
                    const r = isTop ? topTilt[hashString(image.name + ":t") % topTilt.length] : right ? rotRight[mag] : rotLeft[mag]
                    const y = yByDepth[index]
                    // Top card lifts gently on hover; the rest fan via their palettes.
                    const hover = isTop ? "group-hover:-translate-y-1.5" : ""
                    return (
                        <div
                            key={image.name}
                            // inset-0 m-auto centers each card within the container; no frame
                            // border — depth comes from the shadow. will-change promotes a card
                            // to its own layer ONLY while its stack is hovered (so the shadow
                            // doesn't repaint mid-animation), and the browser frees that layer
                            // afterwards — no permanent per-card layers piling up memory.
                            className={cn(
                                "absolute inset-0 m-auto overflow-hidden rounded-lg bg-surface-gray-2 shadow-lg transition-transform duration-300 ease-out group-hover:will-change-transform",
                                zByDepth[index],
                                x,
                                r,
                                y,
                                hover,
                            )}
                            style={{ width: `${(n.w / boxW) * 100}%`, height: `${(n.h / boxH) * 100}%` }}
                        >
                            <ReservedImage src={image.file_thumbnail || image.file_url} alt={image.file_name} />
                        </div>
                    )
                })}

                {remaining > 0 && (
                    <Badge size="md" variant="solid" theme="gray" className="absolute bottom-2 right-2 z-40">
                        +{remaining}
                    </Badge>
                )}
            </div>
        </div>
    )
}
