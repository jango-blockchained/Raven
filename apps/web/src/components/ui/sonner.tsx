import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"
import { useTheme } from "@components/theme-provider"
import { Spinner } from "./spinner"

/**
 * Styled to match frappe-ui's CURRENT toast — the sonner-based one (verified
 * against its rendered markup: inverted surface-gray-9 card, monochrome
 * ink-base icons, text-p-base medium title, py-2.5/px-4 at w-[360px] with
 * shadow-xl, and a close button). The reka-ui Toast.vue still in the frappe-ui
 * repo is the OLD component — don't align to it. Icon colors follow their
 * per-type scheme: neutral ink-base normally, tinted for problems (their error
 * markup carries [&_[data-icon]]:text-ink-red-5; warning's amber is inferred
 * from the same vocabulary, and our own `info` type gets the parallel blue).
 * Deliberate departures: lucide glyphs (their success is a filled heroicon)
 * and the `info` type they don't have.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            position="bottom-right"
            closeButton
            icons={{
                success: (
                    <CircleCheckIcon className="size-4 text-ink-base" />
                ),
                info: (
                    <InfoIcon className="size-4 text-ink-blue-5" />
                ),
                warning: (
                    <TriangleAlertIcon className="size-4 text-ink-amber-5" />
                ),
                error: (
                    <OctagonXIcon className="size-4 text-ink-red-5" />
                ),
                loading: (
                    <Spinner className="size-4 text-ink-base" />
                ),
            }}
            style={
                {
                    "--normal-bg": "var(--surface-gray-9)",
                    "--normal-text": "var(--ink-base)",
                    "--normal-border": "var(--surface-gray-9)",
                    "--border-radius": "var(--radius-md)",
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: "!py-2.5 !px-4 !w-[360px] !items-center !shadow-xl",
                    title: "!break-words !text-p-base !font-medium !text-ink-base",
                    description: "!text-p-base !break-words !text-ink-base",
                    // Inline at the row's END (frappe-ui's placement) — sonner's
                    // styled default is an absolutely-positioned top-left bubble
                    // nudged with a literal `transform: translate(-35%,-35%)`, so
                    // it needs transform-none (Tailwind's translate-* utilities
                    // set the separate `translate` property and would NOT override
                    // it — the button rides 35% high, off the row's centerline).
                    // [&_svg]:!size-4: sonner's close × renders at its native 12px
                    // svg attributes — frappe-ui upsizes it to 16px in the 20px button.
                    closeButton:
                        "!static !order-1 !ml-auto !transform-none !size-5 !rounded-sm !border-0 !bg-transparent !text-ink-base hover:!bg-surface-gray-8 [&_svg]:!size-4",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
