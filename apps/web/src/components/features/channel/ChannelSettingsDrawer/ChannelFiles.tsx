import { UserAvatar } from '@components/features/message/UserAvatar'
import { ArrowDownToLine, LayoutGridIcon, ListIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { useSetAtom } from 'jotai'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { useSqliteSearch, type SearchResult } from '@hooks/useSqliteSearch'
import { useChannelMembers, type ChannelMemberData } from '@hooks/useChannelMembers'
import { formatRelativeDate } from '@lib/date'
import { formatFileSize } from '@utils/fileUtils'
import { Skeleton } from '@components/ui/skeleton'
import _ from '@lib/translate'
import ErrorBanner from '@components/ui/error-banner'
import { Input } from '@components/ui/input'
import { TabsButton, TabsButtonItem } from '@components/ui/tab-buttons'
import { attachmentPreviewAtom, getAttachmentKind, type Attachment } from '@utils/attachmentPreview'
import { getFileExtension } from '@lib/file'
import { TAB_SCROLLER } from './tabPanel'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'

type FilesView = 'list' | 'grid'

/** Search-result file → lightbox attachment (same shape messages produce). */
const toAttachment = (file: SearchResult): Attachment => ({
    id: file.id,
    fileName: file.title,
    fileUrl: new URL(file.internal_link!, window.location.origin).href,
    kind: getAttachmentKind(file.internal_link!),
    size: file.file_size,
    owner: file.author,
    creation: file.creation,
})

const ChannelFiles = ({ channelID }: { channelID: string }) => {
    // Debounced at the INPUT (uncontrolled below): keystrokes render nothing;
    // the tab re-renders once per settled query. The search hooks no longer
    // debounce internally — this is the one debounce.
    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)
    const [view, setView] = useState<FilesView>('grid')
    const { results, isLoading, error } = useSqliteSearch(searchQuery, { channel_id: channelID, message_type: ["File", "Image"] }, 100)
    const { members } = useChannelMembers(channelID)

    // One lookup Map instead of members.find() per file per render
    const membersByName = useMemo(() => new Map(members.map((member) => [member.name, member])), [members])

    // Rows without a file URL can't be previewed or rendered — drop them ONCE so
    // list indexes line up with the attachment set the lightbox pages through.
    const files = useMemo(() => results.filter((result) => result.internal_link), [results])
    const attachments = useMemo(() => files.map(toAttachment), [files])

    const setPreview = useSetAtom(attachmentPreviewAtom)
    // The whole files list is ONE navigable set — open at the clicked file and
    // arrow/swipe through the rest, Drive-style.
    const openPreview = (index: number) => setPreview({ attachments, index, mode: 'view' })

    return (
        // Flex column: the filter row stays pinned; only the list below scrolls.
        <div className="flex flex-1 min-h-0 flex-col gap-2 px-1">
            {/* Search + view toggle */}
            <div className="flex shrink-0 items-center gap-2">
                <InputGroup>
                    <InputGroupAddon>
                        <SearchIcon />
                    </InputGroupAddon>
                    <Input
                        inputSize="sm"
                        placeholder={_("Search...")}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </InputGroup>
                <TabsButton value={view} size="md" onValueChange={(value) => setView(value as FilesView)} aria-label={_("Files view")}>
                    <TabsButtonItem value="grid" iconOnly aria-label={_("Grid view")} title={_("Grid view")}>
                        <LayoutGridIcon />
                    </TabsButtonItem>
                    <TabsButtonItem value="list" iconOnly aria-label={_("List view")} title={_("List view")}>
                        <ListIcon />
                    </TabsButtonItem>
                </TabsButton>
            </div>
            {error && <ErrorBanner error={error} />}
            {/* Files — the tab's one scroller (fade + safe-area padding). */}
            <div className={TAB_SCROLLER}>
                {isLoading ? (view === 'grid' ? <FilesGridSkeleton /> : <FilesListSkeleton />) :
                    files.length === 0 ? <div className="text-p-sm text-ink-gray-4 text-center py-8">{searchQuery ? _("No files found matching your search.") : _("No files shared in this channel yet.")}</div> :
                        view === 'grid' ? (
                            <FilesGrid files={files} membersByName={membersByName} onOpen={openPreview} />
                        ) : (
                            <div className="space-y-2 pb-1">
                                {files.map((file, index) => (
                                    <FileListRow
                                        key={file.id}
                                        file={file}
                                        member={membersByName.get(file.author)}
                                        onOpen={() => openPreview(index)}
                                    />
                                ))}
                            </div>
                        )}
            </div>
        </div>
    )
}

const FileListRow = ({ file, member, onOpen }: {
    file: SearchResult
    member?: ChannelMemberData
    onOpen: () => void
}) => {
    return (
        // div + role="button" (same as LinkPreviewCard): the row holds a real
        // <a> for download, and an anchor inside a <button> is invalid HTML.
        <div
            className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-outline-gray-1 p-1.5 transition-colors hover:bg-surface-gray-1"
            tabIndex={0}
            role="button"
            onClick={onOpen}
            // target check: Enter on the download link bubbles here — only
            // open the preview when the ROW itself has focus.
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
            }}
            aria-label={_("Preview {0}", [file.title])}
        >
            {file.message_type === 'Image' && file.internal_link ? (
                // alt is empty on purpose: the row already announces the file
                // name, so a non-empty alt would read it twice.
                <img
                    src={file.internal_link}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-md border border-outline-gray-1 object-cover"
                />
            ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <FileTypeIcon fileType={file.file_type || getFileExtension(file.title) || "File"} size="lg" />
                </div>
            )}

            <div className="min-w-0 flex-1 gap-0.5 flex flex-col">
                <div className="truncate text-sm-medium leading-4 text-ink-gray-8">{file.title}</div>
                {member && (
                    <>
                        <span className="truncate text-ink-gray-6 text-xs leading-snug">{member.full_name}</span>
                    </>
                )}
                <div className="flex items-center gap-1.5 text-xs text-ink-gray-5">
                    <span className="shrink-0">{formatFileSize(file.file_size ?? 0)}</span>
                    <span>·</span>
                    <span className="shrink-0">{formatRelativeDate(file.creation)}</span>
                </div>
            </div>

            {/* Download is its own control — don't let it open the preview.
                Hover-revealed on desktop, always visible on mobile (no hover
                there). */}
            <a
                href={file.internal_link}
                download
                onClick={(event) => event.stopPropagation()}
                aria-label={_("Download {0}", [file.title])}
                className="shrink-0 rounded p-1.5 text-ink-gray-4 transition-opacity hover:text-ink-gray-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
                <ArrowDownToLine className="h-4 w-4" />
            </a>
        </div>
    )
}

/** Finder-style grid: square thumbnail, then name and size below. Every tile
 *  has the same anatomy, so names are always visible — including image tiles
 *  on mobile, where the old hover scrim never showed. */
const FilesGrid = ({ files, membersByName, onOpen }: {
    files: SearchResult[]
    membersByName: Map<string, ChannelMemberData>
    onOpen: (index: number) => void
}) => {
    return (
        <div className="grid grid-cols-3 gap-3 pb-1">
            {files.map((file, index) => (
                <FileGridTile
                    key={file.id}
                    file={file}
                    member={membersByName.get(file.author)}
                    onOpen={() => onOpen(index)}
                />
            ))}
        </div>
    )
}

const FileGridTile = ({ file, member, onOpen }: {
    file: SearchResult
    member?: ChannelMemberData
    onOpen: () => void
}) => {
    return (
        <button
            type="button"
            onClick={onOpen}
            title={file.title}
            aria-label={_("Preview {0}", [file.title])}
            className="group flex min-w-0 flex-col gap-1 text-left"
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-outline-gray-1 bg-surface-gray-1 transition-colors group-hover:border-outline-gray-3">
                {file.message_type === 'Image' ? (
                    // alt is empty on purpose: the button already announces the
                    // file name, so a non-empty alt would read it twice.
                    <img
                        src={file.internal_link}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <FileTypeIcon fileType={file.file_type || getFileExtension(file.title) || "File"} size="xl" />
                    </div>
                )}
                {/* Who shared it — badge in the thumbnail corner, Drive-style.
                    The ring separates it from photo pixels underneath. Missing
                    member (author left the channel) just means no badge.
                    Hovering the badge names the sharer and the share date; a
                    click still bubbles to the tile and opens the preview. */}
                {member && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="absolute -bottom-0.5 right-1">
                                <UserAvatar
                                    user={member}
                                    size="xs"
                                    showStatusIndicator={false}
                                    avatarClassName="ring ring-surface-base"
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <span className="block">{member.full_name}</span>
                            <span className="block">{_("Shared {0}", [formatRelativeDate(file.creation)])}</span>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="flex min-w-0 flex-col px-0.5">
                <span className="truncate text-xs-medium leading-relaxed text-ink-gray-8">{file.title}</span>
                <span className="truncate text-2xs text-ink-gray-4">
                    {formatFileSize(file.file_size ?? 0)}
                </span>
            </div>
        </button>
    )
}

/* Loading placeholders shaped like the view they stand in for, so the swap
   from skeleton to content doesn't reflow the tab. Caption/text widths vary
   by index to read as real content instead of a uniform block. */

const GRID_SKELETON_WIDTHS = ['w-full', 'w-3/4', 'w-5/6', 'w-2/3', 'w-full', 'w-4/5', 'w-full', 'w-3/4', 'w-2/3']

const FilesGridSkeleton = () => (
    <div className="grid grid-cols-3 gap-3 pb-1" aria-hidden="true">
        {GRID_SKELETON_WIDTHS.map((width, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-1">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <div className="flex flex-col gap-1 px-0.5 py-0.5">
                    <Skeleton className={`h-3 ${width}`} />
                    <Skeleton className="h-2.5 w-1/3" />
                </div>
            </div>
        ))}
    </div>
)

const LIST_SKELETON_WIDTHS = ['w-2/5', 'w-3/5', 'w-1/3', 'w-1/2', 'w-2/5']

const FilesListSkeleton = () => (
    <div className="space-y-2 pb-1" aria-hidden="true">
        {LIST_SKELETON_WIDTHS.map((width, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border border-outline-gray-1 p-1.5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className={`h-3.5 ${width}`} />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
        ))}
    </div>
)

export default ChannelFiles
