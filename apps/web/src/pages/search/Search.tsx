import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounceValue } from 'usehooks-ts'
import { useEscHotkey } from '@hooks/useEscHotkey'
import { ChevronDown, Search as SearchIcon, X } from 'lucide-react'

import SearchTabsBar, { SearchTab } from '@components/features/search/SearchTabsBar'
import { SearchFiltersBar } from '@components/features/search/SearchFiltersBar'
import { SearchActiveBadges } from '@components/features/search/SearchActiveBadges'
import SearchMessageResults from '@components/features/search/results/SearchMessageResults'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'

// Messages is the landing tab, so its results stay in the page's own chunk —
// the other tabs' renderers load on first visit to that tab. Their chunks are
// tiny individually, but each pulls its own preview machinery (file previews,
// poll cards), and most searches never leave the messages tab.
const SearchFileResults = lazy(() => import('@components/features/search/results/SearchFileResults'))
const SearchLinkResults = lazy(() => import('@components/features/search/results/SearchLinkResults'))
const SearchPollResults = lazy(() => import('@components/features/search/results/SearchPollResults'))
import { NotificationsEmptyState, type SelectedNotification } from '@pages/notifications/NotificationChat'
import AppMobileFooter from '@components/features/header/AppMobileFooter'
import { PageHeader } from '@components/layout/PageHeader'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import { SearchFilters } from '@components/features/search/types'

import { useChannelList } from "@stores/channels/useChannelList"
import { useUsers } from '@hooks/useUsers'
import { Input } from '@components/ui/input'
import { Button } from '@components/ui/button'
import { useIsMobile } from '@hooks/use-mobile'
import { cn } from '@lib/utils'
import _ from '@lib/translate'

/** Ties the toggle's aria-controls to the row it reveals. */
const FILTERS_ROW_ID = 'search-filters-row'

export default function Search() {
    // All search state lives in URL params so links like /search?q=foo&channel=general work.
    const [searchParams, setSearchParams] = useSearchParams()
    const searchValue = searchParams.get('q') ?? ''

    // The ONE debounce for all result tabs (the search hooks don't debounce
    // internally anymore). The URL is the source of truth and updates per
    // keystroke by design (deep-linkable state), so this page re-renders per
    // keystroke regardless — the debounce here is about not FETCHING per
    // keystroke. Synced from the URL value via effect because useDebounceValue
    // doesn't track its initial value.
    const [debouncedQuery, setDebouncedQuery] = useDebounceValue(searchValue, 200)
    useEffect(() => {
        setDebouncedQuery(searchValue)
    }, [searchValue, setDebouncedQuery])

    const setSearchValue = (value: string) => {
        setSearchParams(prev => {
            if (value) prev.set('q', value)
            else prev.delete('q')
            return prev
        }, { replace: true })
    }

    const channelFromURL = searchParams.get('channel') ?? ''
    const userFromURL = searchParams.get('user') ?? ''
    const fileTypeFromURL = searchParams.get('file_type')?.split(',').filter(Boolean) ?? []
    const tabFromURL = (searchParams.get('tab') as SearchTab) || 'messages'

    const [activeTab, setActiveTab] = useState<SearchTab>(tabFromURL)
    const isMobile = useIsMobile()

    // Collapsed by default, but a link that arrives WITH filters opens on the row that
    // explains its results. Initializer only — toggling later is the user's call, and
    // clearing the last filter shouldn't yank the row out from under them.
    const [showFilters, setShowFilters] = useState(() =>
        !!channelFromURL || !!userFromURL || fileTypeFromURL.length > 0
    )

    // The open result is ROUTE-driven (same as notifications): `/search/:channelID/:messageID`
    // renders NotificationChatRoute in the right pane's Outlet. Being a history entry means
    // the mobile back chevron / OS back-swipe pop to this list, and refresh restores the chat.
    const navigate = useNavigate()
    const selectedMessageID = useMatch("/search/:channelID/:messageID")?.params.messageID
    const hasSelection = !!selectedMessageID

    const onSelect = (selection: SelectedNotification) => {
        navigate(
            {
                pathname: `/search/${encodeURIComponent(selection.channelID)}/${encodeURIComponent(selection.messageID)}`,
                // Keep the query/filters in the URL while the chat is open.
                search: searchParams.toString(),
            },
            {
                // Thread/DM context for the pane — a cold deep-link derives it instead.
                state: {
                    isThread: selection.isThread,
                    isDirectMessage: selection.isDirectMessage,
                    peerID: selection.peer?.name,
                },
                // First open pushes (one back closes the chat); switching between
                // results replaces, so back never walks through every chat viewed.
                replace: hasSelection,
            },
        )
    }

    // Esc closes the open chat — the static right pane falls back to its empty state.
    useEscHotkey(() => {
        if (hasSelection) navigate({ pathname: '/search', search: searchParams.toString() })
    }, { enableOnFormTags: true }, [hasSelection, searchParams])

    const filters: SearchFilters = {
        query: debouncedQuery || '',
        channel_id: channelFromURL,
        owner: userFromURL,
        file_type: fileTypeFromURL,
    }

    const { channels, dmChannels } = useChannelList()
    const users = useUsers()

    // Don't fetch until there's something to search for — an empty query with no filters would
    // otherwise pull the whole corpus. Gating the render here means the result components (and
    // their fetch hooks) never mount, so no request fires.
    const hasActiveSearch =
        (filters.query ?? '').trim().length > 0 ||
        !!filters.channel_id ||
        !!filters.owner ||
        (filters.file_type?.length ?? 0) > 0

    const onTabChange = (tab: SearchTab) => {
        setActiveTab(tab)
        setSearchParams((prev) => {
            prev.set('tab', tab)
            return prev
        }, { replace: true })
    }

    const setChannelFilter = (channelId: string) => {
        setSearchParams((prev) => {
            if (channelId !== '*all') prev.set('channel', channelId)
            else prev.delete('channel')
            return prev
        }, { replace: true })
    }

    const setFileTypeFilter = (fileTypes: string[]) => {
        setSearchParams((prev) => {
            if (fileTypes.length) prev.set('file_type', fileTypes.join(','))
            else prev.delete('file_type')
            return prev
        }, { replace: true })
    }

    const setUserFilter = (userId: string) => {
        setSearchParams((prev) => {
            if (userId && userId !== 'all') prev.set('user', userId)
            else prev.delete('user')
            return prev
        }, { replace: true })
    }

    const searchInput = (
        <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-gray-4 pointer-events-none" />
                <Input
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={_('Search messages, files, links, polls')}
                    className="pl-9 pr-9 h-9 md:h-8 text-xl md:text-base"
                    autoFocus={!isMobile}
                />
                {searchValue && (
                    <button
                        type="button"
                        onClick={() => setSearchValue('')}
                        aria-label={_('Clear search')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-gray-4 hover:text-ink-gray-8"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            {/* The filter row is collapsed by default so the results start higher up.
                Matches the input's height, not the filters' — it belongs to this row. */}
            <Button
                variant="outline"
                size="md"
                isIconButton
                onClick={() => setShowFilters(open => !open)}
                aria-expanded={showFilters}
                aria-controls={FILTERS_ROW_ID}
                aria-label={showFilters ? _('Hide filters') : _('Show filters')}
                className="shrink-0 size-9 md:size-8 text-ink-gray-7"
            >
                <ChevronDown className={cn("transition-transform", showFilters && "rotate-180")} />
            </Button>
        </div>
    )


    return (
        // relative on the OUTER column: the mobile chat layer (absolute inset-0 below)
        // covers list + footer, sliding over the tab bar like a native detail page.
        // The footer stays MOUNTED and is inerted while covered (see AppMobileFooter).
        <div className="relative flex flex-col h-dvh overflow-hidden">
            <div className="flex flex-1 min-h-0 flex-row overflow-hidden">
                {/* Left pane: full width on mobile (the open chat covers it as a layer);
                    pinned at 45% on desktop beside the static chat pane — mirrors the
                    threads / notifications split. */}
                <div
                    className="relative flex flex-col overflow-hidden min-w-0 w-full md:w-[45%] md:max-w-[50%] md:shrink-0 bg-surface-base md:bg-surface-sidebar"
                    // While covered by the mobile chat layer, keep the list out of
                    // focus / accessibility order.
                    inert={isMobile && hasSelection ? true : undefined}
                >
                    <PageHeader title={_('Search')} />
                    <div className="shrink-0">
                        {/* p-2 + space-y-3 mirrors the threads page so the search-bar → tabs → list
                            spacing is identical across pages. */}
                        <div className="mx-auto w-full p-2 pb-0 space-y-3">
                            {searchInput}
                            {showFilters && (
                                <div id={FILTERS_ROW_ID}>
                                    <SearchFiltersBar
                                        filters={filters}
                                        channels={channels}
                                        dmChannels={dmChannels}
                                        onChannelChange={setChannelFilter}
                                        onUserChange={setUserFilter}
                                        onFileTypeChange={setFileTypeFilter}
                                        showFileTypeFilter={activeTab === 'files'}
                                    />
                                </div>
                            )}
                            <SearchTabsBar activeTab={activeTab} setActiveTab={onTabChange} />
                            <SearchActiveBadges
                                filters={filters}
                                channels={channels}
                                dmChannels={dmChannels}
                                users={users}
                            />
                        </div>
                    </div>

                    {/* Empty prompt centers over the whole pane (absolute) so it lands at the same
                        height as the right pane's empty state, not offset below the header/tabs/filters.
                        pointer-events-none keeps the search input + filters clickable underneath. */}
                    {!hasActiveSearch && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <Empty>
                                <EmptyMedia><SearchIcon /></EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>{_('Search Raven')}</EmptyTitle>
                                    <EmptyDescription>{_('Find messages, files, links and polls. Type a query or pick a filter to start.')}</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        </div>
                    )}

                    <div className="flex-1 min-h-0 px-3 md:px-0 pb-2">
                        <div className="mx-auto w-full h-full">
                            {hasActiveSearch && (
                                <>
                                    {activeTab === 'messages' && <SearchMessageResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    {/* Tab switches are plain state updates (not router
                                        transitions), so a first visit to a lazy tab shows
                                        this skeleton while its chunk loads — same rows the
                                        results themselves show while fetching. */}
                                    <Suspense fallback={<MessageListSkeleton />}>
                                        {activeTab === 'files' && <SearchFileResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                        {activeTab === 'links' && <SearchLinkResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                        {activeTab === 'polls' && <SearchPollResults searchValue={filters.query} filters={filters} onSelect={onSelect} selectedID={selectedMessageID} />}
                                    </Suspense>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right pane: static on desktop — empty state until a result is selected
                    (mirrors threads / notifications). On mobile it's a full-screen layer over
                    list + tab bar (inset-0 of the OUTER column) while a result is open, so the
                    list underneath keeps its scroll position. */}
                <div className={cn(
                    "flex flex-col min-w-0 min-h-0 bg-surface-gray-1",
                    "max-md:absolute max-md:inset-0 max-md:z-20 animate-layer-in",
                    !hasSelection && "max-md:hidden",
                    "md:flex-1",
                )}>
                    {hasSelection
                        ? <Outlet />
                        : <NotificationsEmptyState message={_("Select a result to view the message.")} />}
                </div>
            </div>
            <AppMobileFooter inert={isMobile && hasSelection ? true : undefined} />
        </div>
    )
}
