'use client';

import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// @ts-ignore
import { List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { usePDFStore } from '@/store/usePDFStore';
import { useWindowSize, useKey } from 'react-use';
import { ChevronRight, Menu, X, HelpCircle } from 'lucide-react';
import PDFOutline, { FlatOutlineItem } from './PDFOutline';
import clsx from 'clsx';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface RowProps {
    index: number;
    style: React.CSSProperties;
    renderScale: number;
    theme: 'light' | 'dark';
}

const Row = memo(({ index, style, renderScale, theme }: RowProps) => {
    return (
        <div
            style={{
                ...style,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '12px 0',
            }}
        >
            <div
                className={clsx(
                    'shadow-2xl relative',
                    theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'
                )}
            >
                <Page
                    pageNumber={index + 1}
                    scale={renderScale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyItems: 'center',
                            }}
                        >
                            Loading...
                        </div>
                    }
                />
            </div>
        </div>
    );
});
Row.displayName = 'PDFRow';

interface PDFReaderProps {
    file: File | string;
}

export default function PDFReader({ file }: PDFReaderProps) {
    const {
        renderScale,
        visualScale,
        currentPage,
        numPages,
        sidebarOpen,
        focusMode,
        expandedPaths,
        selectedPath,
        setNumPages,
        setCurrentPage,
        toggleSidebar: storeToggleSidebar,
        setSidebarOpen,
        setFocusMode,
        toggleOutlineExpand,
        setSelectedPath,
        pendingCommand,
        setPendingCommand,
        theme,
        fitMode,
        fitRatio,
        addToHistory,
        goBackInHistory,
        goForwardInHistory,
        helpOpen,
        toggleHelp,
        toggleMode,
        setBaseWidth: setBaseWidthStore,
        setBaseHeight: setBaseHeightStore,
        setAvailableWidth: setAvailableWidthStore,
        setAvailableHeight: setAvailableHeightStore,
        fileProgress,
        updateProgress,
        setCurrentScrollTop,
    } = usePDFStore();

    const hasRestoredPosition = useRef(false);

    useEffect(() => {
        hasRestoredPosition.current = false;
    }, [file]);

    const listRef = useRef<any>(null);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const { width: windowWidth, height: windowHeight } = useWindowSize();

    // Raw Outline from react-pdf
    const [outline, setRawOutline] = useState<any[]>([]);
    // Outline with resolved page numbers for breadcrumb
    const [outlineWithPages, setOutlineWithPages] = useState<any[]>([]);

    // Zoom transition state - only enable transition when sidebar toggles
    const [isZoomTransitioning, setIsZoomTransitioning] = useState(false);

    // Wrapper for toggleSidebar to ensure transition state is set synchronously with layout change
    const toggleSidebar = useCallback(() => {
        setIsZoomTransitioning(true);
        storeToggleSidebar();
    }, [storeToggleSidebar]);

    useEffect(() => {
        const timer = setTimeout(() => setIsZoomTransitioning(false), 300);
        return () => clearTimeout(timer);
    }, [sidebarOpen]);

    // Flattened Outline Logic
    const flattenOutline = (items: any[], depth = 0, parentPath = ''): FlatOutlineItem[] => {
        let result: FlatOutlineItem[] = [];
        items.forEach((item, index) => {
            const currentPath = parentPath ? `${parentPath}-${index}` : `${index}`;
            const hasChildren = item.items && item.items.length > 0;
            const expanded = expandedPaths.has(currentPath);

            result.push({
                title: item.title,
                dest: item.dest,
                depth,
                path: currentPath,
                hasChildren,
                expanded,
            });

            if (hasChildren && expanded) {
                result = result.concat(flattenOutline(item.items, depth + 1, currentPath));
            }
        });
        return result;
    };

    const flatOutline = flattenOutline(outline || []);

    // Since mapping Dest to Page is async and hard without pdf instance reference,
    // we will rely on react-pdf's internal link handling if possible, OR
    // just implement the navigation part for 'j'/'k' within the list.
    // Actually, I can save the `pdf` object in state to use `getPageIndex`.
    const [pdfDocument, setPdfDocument] = useState<any>(null);

    const jumpToDestination = useCallback(
        async (dest: any) => {
            if (!pdfDocument) return;
            try {
                // resolve dest
                let explicitDest = dest;
                if (typeof dest === 'string') {
                    explicitDest = await pdfDocument.getDestination(dest);
                }
                if (!explicitDest) return;

                const pageIndex = await pdfDocument.getPageIndex(explicitDest[0]);
                const currentScroll = listRef.current?.element?.scrollTop || 0;
                addToHistory(currentPageRef.current, currentScroll);
                const targetPage = pageIndex + 1;

                // Bypass snap-to-top for precise destination jumps
                isInternalPageUpdate.current = true;
                setCurrentPage(targetPage);

                // Standard logical height jump
                const logicalItemHeight = baseHeightRef.current * scaleRef.current + 24;
                const targetScroll = (targetPage - 1) * logicalItemHeight;
                addToHistory(targetPage, targetScroll);

                if (listRef.current?.element) {
                    listRef.current.element.scrollTo({
                        top: targetScroll,
                        behavior: 'instant',
                    });
                    targetScrollTopRef.current = targetScroll;
                    // Explicitly sync after jump completes
                    updateProgress(targetPage, targetScroll);
                    // Return focus to PDF viewer after jump
                    setFocusMode('pdf');
                    window.focus();
                }
            } catch (e) {
                console.error('Jump error', e);
            }
        },
        [pdfDocument, addToHistory, setCurrentPage, updateProgress, setFocusMode]
    );

    // --- Dynamic Scaling Logic ---
    // Base dimensions for synchronous scale calculation
    const [baseWidth, setBaseWidth] = useState(0);
    const [baseHeight, setBaseHeight] = useState(800);

    const availableWidth = sidebarOpen ? windowWidth - 320 : windowWidth;

    // Synchronize dimensions to store for VimInput conversion logic
    useLayoutEffect(() => {
        if (baseWidth) setBaseWidthStore(baseWidth);
    }, [baseWidth, setBaseWidthStore]);

    useLayoutEffect(() => {
        if (baseHeight) setBaseHeightStore(baseHeight);
    }, [baseHeight, setBaseHeightStore]);

    useLayoutEffect(() => {
        setAvailableWidthStore(availableWidth);
    }, [availableWidth, setAvailableWidthStore]);

    useLayoutEffect(() => {
        setAvailableHeightStore(windowHeight - 48); // Subtract header height for precise :fp
    }, [windowHeight, setAvailableHeightStore]);

    // Load page dimensions on change
    useEffect(() => {
        if (!pdfDocument || !numPages) return;
        const loadPageDims = async () => {
            try {
                if (currentPage < 1 || currentPage > (pdfDocument.numPages || 0)) return;
                const page = await pdfDocument.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1 });
                if (viewport.width !== baseWidth) setBaseWidth(viewport.width);
                if (viewport.height !== baseHeight) setBaseHeight(viewport.height);
            } catch (err) {
                console.error('Dim load error:', err);
            }
        };
        loadPageDims();
    }, [currentPage, pdfDocument, numPages, baseWidth, baseHeight]);

    // itemHeight uses FIXED renderScale - layout never changes during zoom
    const itemHeight = baseHeight * renderScale + 24;

    // Handle initial selection and auto-scroll for outline
    useEffect(() => {
        if (focusMode === 'outline' && flatOutline.length > 0 && !selectedPath) {
            setSelectedPath(flatOutline[0].path);
        }
    }, [focusMode, flatOutline, selectedPath, setSelectedPath]);

    // Auto-scroll selected item into view (handles navigation and expansion visibility)
    useEffect(() => {
        if (focusMode === 'outline' && selectedPath) {
            // Use a small timeout to let the DOM update (important for expansion)
            const timer = setTimeout(() => {
                const element = document.getElementById(`outline-item-${selectedPath}`);
                if (!element) return;

                // Find the index of the selected item in the flat list
                const currentIndex = flatOutline.findIndex((i) => i.path === selectedPath);
                if (currentIndex === -1) return;

                const currentItem = flatOutline[currentIndex];

                // If expanded, we want to ensure the LAST descendant is also in view (so children are visible)
                if (currentItem.expanded && currentItem.hasChildren) {
                    // Find the last item that belongs to this parent (highest index with the same path prefix)
                    let lastVisibleIndex = currentIndex;
                    for (let i = currentIndex + 1; i < flatOutline.length; i++) {
                        if (flatOutline[i].path.startsWith(currentItem.path)) {
                            lastVisibleIndex = i;
                        } else {
                            break;
                        }
                    }

                    if (lastVisibleIndex > currentIndex) {
                        const lastChild = document.getElementById(
                            `outline-item-${flatOutline[lastVisibleIndex].path}`
                        );
                        if (lastChild) {
                            // Scrolling the last child with 'nearest' will push the parent up
                            // if there isn't enough room below.
                            lastChild.scrollIntoView({
                                behavior: 'auto',
                                block: 'nearest',
                            });
                            // Also ensure the parent is still in view (usually it will be if children fit)
                            element.scrollIntoView({
                                behavior: 'auto',
                                block: 'nearest',
                            });
                            return;
                        }
                    }
                }

                // Default: just scroll the item itself
                element.scrollIntoView({
                    behavior: 'auto',
                    block: 'nearest',
                });
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [selectedPath, focusMode, flatOutline]); // Re-run when flatOutline changes (expansion)

    /**
     * DERIVE TRANSFORM RATIO:
     */
    const transformRatio = useMemo(() => {
        if (!baseWidth || !baseHeight || !renderScale)
            return (visualScale || 1.2) / (renderScale || 1.5);
        let scale = visualScale || 1.2;
        if (fitMode === 'relative') {
            // Ensure availableWidth and baseWidth are sanitized
            const safeAvail = Math.max(100, availableWidth);
            const safeBase = Math.max(100, baseWidth);
            scale = (safeAvail * (fitRatio || 0.9)) / safeBase;
        }
        return Math.max(0.01, scale / (renderScale || 1.5));
    }, [fitMode, fitRatio, visualScale, renderScale, baseWidth, baseHeight, availableWidth]);

    const activeKeys = useRef<Set<string>>(new Set());
    const requestRef = useRef<number | undefined>(undefined);

    const [isLayoutReady, setIsLayoutReady] = useState(false);

    // Reset ready state when file changes
    useEffect(() => {
        setIsLayoutReady(false);
        setRawOutline([]);
        setOutlineWithPages([]);
    }, [file]);

    async function onDocumentLoadSuccess(pdf: any) {
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            setBaseHeight(viewport.height);
            const outline = await pdf.getOutline();
            setRawOutline(outline);

            // Smart Sidebar Logic:
            // "If opening a NEW file, open directory if exists, otherwise close it."
            // We identify a "new" file by checking if it lacks a record in fileProgress.
            // If it HAS a record, we respect the persisted user preference (do nothing).
            const fileName = file instanceof File ? file.name : file;
            if (fileName && !fileProgress[fileName]) {
                if (!outline || outline.length === 0) {
                    setSidebarOpen(false);
                } else {
                    setSidebarOpen(true);
                }
            }
            setTimeout(() => {
                setIsLayoutReady(true);
                window.focus(); // Ensure we have focus to capture keys
            }, 50);
        } catch (e) {
            console.error('Error getting pdf metadata', e);
            setIsLayoutReady(true);
            window.focus();
        }
    }

    // Resolve page numbers for outline items
    useEffect(() => {
        if (!pdfDocument || !outline || outline.length === 0) {
            setOutlineWithPages([]);
            return;
        }

        let active = true;

        const resolvePageNumbers = async (items: any[]): Promise<any[]> => {
            // Use Promise.all to resolve sibling items in parallel for major speedup
            const resolvedItems = await Promise.all(
                items.map(async (item) => {
                    let pageNumber = 0;
                    try {
                        let dest = item.dest;
                        if (typeof dest === 'string') {
                            dest = await pdfDocument.getDestination(dest);
                        }
                        if (Array.isArray(dest) && dest.length > 0) {
                            // dest[0] is typically a reference to the page object
                            // but some PDFs might have the index directly
                            pageNumber = (await pdfDocument.getPageIndex(dest[0])) + 1;
                        }
                    } catch {
                        // Suppress individual resolution errors to prevent blocking the entire tree
                    }

                    const children =
                        item.items && item.items.length > 0
                            ? await resolvePageNumbers(item.items)
                            : [];

                    return {
                        title: item.title,
                        pageNumber,
                        items: children,
                    };
                })
            );
            return resolvedItems;
        };

        resolvePageNumbers(outline).then((result) => {
            if (active) setOutlineWithPages(result);
        });

        return () => {
            active = false;
        };
    }, [pdfDocument, outline]);

    const scaleRef = useRef(renderScale);
    const currentPageRef = useRef(currentPage);
    const baseHeightRef = useRef(baseHeight);
    const numPagesRef = useRef(numPages);
    const targetScrollTopRef = useRef<number>(0);
    const isInternalPageUpdate = useRef(false);

    // Sync refs
    useEffect(() => {
        scaleRef.current = renderScale;
    }, [renderScale]);
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);
    useEffect(() => {
        baseHeightRef.current = baseHeight;
    }, [baseHeight]);
    useEffect(() => {
        numPagesRef.current = numPages;
    }, [numPages]);

    // Initialize targetScrollTopRef
    useEffect(() => {
        if (listRef.current?.element) {
            targetScrollTopRef.current = listRef.current.element.scrollTop;
        }
    }, [isLayoutReady]);

    // Sync Scroll to Page Change
    useEffect(() => {
        if (!listRef.current || !numPages) return;
        if (isInternalPageUpdate.current) {
            isInternalPageUpdate.current = false;
            return;
        }
        // If it's the very first page of a newly loaded document, we want to stay at itemHeight (Doc Top)
        // rather than potentially being snapped higher by a generic "start" align.
        listRef.current.scrollToRow({
            index: currentPage - 1, // 0-based index
            align: currentPage === 1 ? 'start' : 'start', // Always start is fine now? Or auto
            behavior: 'instant',
        });
    }, [currentPage, numPages]);

    // Ensure we start at the document top (skipping spacer) if we are on page 1,
    // OR restore the exact previous position if available.
    useLayoutEffect(() => {
        if (isLayoutReady && listRef.current?.element && numPages && !hasRestoredPosition.current) {
            const fileName = typeof file === 'string' ? file : file.name;
            const restored = fileProgress[fileName];

            if (restored && restored.scrollTop > 0) {
                listRef.current.element.scrollTop = restored.scrollTop;
                targetScrollTopRef.current = restored.scrollTop;
                hasRestoredPosition.current = true;
            } else if (currentPage === 1) {
                listRef.current.element.scrollTop = 0; // Top is 0 now
                hasRestoredPosition.current = true;
            } else {
                // If we have a currentPage > 1 but no scrollTop progress,
                // the existing Sync Scroll to Page Change useEffect will take us to the top of that page.
                hasRestoredPosition.current = true;
            }
        }
    }, [isLayoutReady, numPages, itemHeight, file, fileProgress, currentPage]);

    const [lastSyncScroll, setLastSyncScroll] = useState(0);

    // Periodically sync scroll progress to store (Debounced)
    useEffect(() => {
        if (!isLayoutReady || !listRef.current?.element || isZoomTransitioning) return;

        const timer = setTimeout(() => {
            if (listRef.current?.element) {
                const currentScroll = listRef.current.element.scrollTop;
                // Don't save if we are at the very top (spacer height) unless it's intended
                // This prevents accidentally saving the 'loading' position
                if (currentScroll > 0) {
                    updateProgress(currentPageRef.current, currentScroll);
                }
            }
        }, 1500); // Slightly longer debounce for stability

        return () => clearTimeout(timer);
    }, [
        currentPage,
        lastSyncScroll,
        updateProgress,
        isLayoutReady,
        isZoomTransitioning,
        visualScale,
        renderScale,
        fitMode,
        fitRatio,
        sidebarOpen,
    ]);

    const updatePageFromScroll = useCallback(
        (scrollTop: number) => {
            const currentItemHeight = baseHeightRef.current * scaleRef.current + 24;
            if (currentItemHeight <= 0 || !listRef.current?.element) return;
            const viewportHeight = listRef.current.element.clientHeight;
            // Simple logic: floor( (scrollTop + halfView) / itemHeight )
            // But Page 1 is at 0.
            const detectionPoint = scrollTop + viewportHeight / 2;
            let newPage = Math.floor(detectionPoint / currentItemHeight) + 1; // 0-index + 1
            newPage = Math.max(1, Math.min(newPage, numPagesRef.current || 1));

            if (!isNaN(newPage) && newPage !== currentPageRef.current) {
                isInternalPageUpdate.current = true;
                setCurrentPage(newPage);
            }
        },
        [setCurrentPage]
    );

    // Track scroll changes for sync trigger
    const onScroll = useCallback(
        (props: any) => {
            const offset = props?.scrollOffset ?? props?.target?.scrollTop ?? props?.scrollTop;
            if (typeof offset === 'number') {
                updatePageFromScroll(offset);
                // Sync scroll position to store for VimInput access
                setCurrentScrollTop(offset);
                if (activeKeys.current.size === 0) {
                    targetScrollTopRef.current = offset;
                    setLastSyncScroll(offset);
                }
            }
        },
        [updatePageFromScroll, setCurrentScrollTop]
    );

    const animateScroll = () => {
        if (!listRef.current?.element) return;
        if (focusMode !== 'pdf') return;

        const SPEED = 15;
        const FAST_SPEED = 60;
        const ZOOM_SPEED = 0.02;

        let nextScrollTop = targetScrollTopRef.current;
        let changed = false;

        if (activeKeys.current.has('j') || activeKeys.current.has('ArrowDown')) {
            nextScrollTop += SPEED;
            changed = true;
        }
        if (activeKeys.current.has('k') || activeKeys.current.has('ArrowUp')) {
            nextScrollTop -= SPEED;
            changed = true;
        }
        if (activeKeys.current.has('d')) {
            nextScrollTop += FAST_SPEED;
            changed = true;
        }
        if (activeKeys.current.has('u')) {
            nextScrollTop -= FAST_SPEED;
            changed = true;
        }

        if (activeKeys.current.size > 0) {
            requestRef.current = requestAnimationFrame(animateScroll);
        }

        if (activeKeys.current.has('+') || activeKeys.current.has('=')) {
            const state = usePDFStore.getState();
            if (state.fitMode === 'relative') {
                usePDFStore.setState({ fitRatio: Math.min(state.fitRatio + 0.01, 2.0) });
            } else {
                usePDFStore.setState({
                    visualScale: Math.min(state.visualScale + ZOOM_SPEED, 3.0),
                });
            }
            changed = true;
        }
        if (activeKeys.current.has('-')) {
            const state = usePDFStore.getState();
            if (state.fitMode === 'relative') {
                usePDFStore.setState({ fitRatio: Math.max(state.fitRatio - 0.01, 0.1) });
            } else {
                usePDFStore.setState({
                    visualScale: Math.max(state.visualScale - ZOOM_SPEED, 0.1),
                });
            }
            changed = true;
        }

        if (changed) {
            const currentNumPages = numPagesRef.current;
            const currentItemHeight = baseHeightRef.current * scaleRef.current + 24;

            if (!currentNumPages || !listRef.current?.element) return;
            const viewportHeight = listRef.current.element.clientHeight;
            if (viewportHeight <= 0) return; // Wait for layout

            // Document boundaries in logical pixels
            const docTop = 0;
            const docBottom = currentNumPages * currentItemHeight - viewportHeight;

            // Clamp: Stop manual scrolling at docTop/docBottom
            // We use Math.max(docTop, docBottom) for the high bound to handle cases where
            // the document is shorter than the viewport.
            let clampedScroll = Math.max(
                docTop,
                Math.min(nextScrollTop, Math.max(docTop, docBottom))
            );
            targetScrollTopRef.current = clampedScroll;

            if (clampedScroll !== listRef.current.element.scrollTop) {
                listRef.current?.element?.scrollTo({
                    top: Math.round(clampedScroll),
                    behavior: 'instant',
                });
            }
        }
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            if (focusMode !== 'pdf') return;

            if (['j', 'k', 'd', 'u', 'ArrowDown', 'ArrowUp', '+', '=', '-'].includes(e.key)) {
                e.preventDefault();
                if (!activeKeys.current.has(e.key)) {
                    // Sync targetScrollTopRef to actual position before starting animation
                    if (activeKeys.current.size === 0 && listRef.current?.element) {
                        targetScrollTopRef.current = listRef.current.element.scrollTop;
                    }
                    activeKeys.current.add(e.key);
                    if (!requestRef.current) {
                        requestRef.current = requestAnimationFrame(animateScroll);
                    }
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (['j', 'k', 'd', 'u', 'ArrowDown', 'ArrowUp', '+', '=', '-'].includes(e.key)) {
                activeKeys.current.delete(e.key);
                if (activeKeys.current.size === 0) {
                    if (requestRef.current) {
                        cancelAnimationFrame(requestRef.current);
                        requestRef.current = undefined;
                    }
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const handleCaptureKeyPress = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            if (e.ctrlKey && !e.metaKey && (e.key === 'o' || e.key === 'i')) {
                e.preventDefault();
                e.stopPropagation();

                const historyItem = e.key === 'o' ? goBackInHistory() : goForwardInHistory();

                if (historyItem) {
                    const pageChanged = historyItem.page !== currentPageRef.current;
                    if (pageChanged) {
                        isInternalPageUpdate.current = true; // Bypass generic scroll effects
                    }
                    setCurrentPage(historyItem.page);

                    // Restoration of exact scroll top
                    if (listRef.current?.element) {
                        listRef.current.element.scrollTo({
                            top: historyItem.scrollTop,
                            behavior: 'instant',
                        });
                        targetScrollTopRef.current = historyItem.scrollTop;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleCaptureKeyPress, { capture: true });

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('keydown', handleCaptureKeyPress, { capture: true });
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [focusMode, goBackInHistory, goForwardInHistory, setCurrentPage]);

    // Keyboard handling - use useKey from react-use for Normal Mode commands
    useKey(
        () => true, // Match all keys
        (e) => {
            // Ignore if typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;

            // 1. Pending Command Handling (Multi-key sequences like gg, zz)
            if (pendingCommand === 'g') {
                if (e.key === 'g') {
                    e.preventDefault();
                    if (focusMode === 'outline' && flatOutline.length > 0) {
                        setSelectedPath(flatOutline[0].path);
                    } else if (listRef.current) {
                        const currentScroll = listRef.current.element.scrollTop;
                        addToHistory(currentPageRef.current, currentScroll);
                        isInternalPageUpdate.current = true;
                        setCurrentPage(1);
                        const targetScroll = 0; // Page 1 top
                        addToHistory(1, targetScroll);

                        listRef.current.element.scrollTo({
                            top: targetScroll,
                            behavior: 'instant',
                        });
                        targetScrollTopRef.current = targetScroll;
                        updateProgress(1, targetScroll);
                    }
                    setPendingCommand(null);
                    return;
                }
                // Any other key cancels 'g' mode (unless it's a modifier)
                if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                    setPendingCommand(null);
                }
            }

            if (pendingCommand === 'z') {
                if (e.key === 'z' || e.key === 't' || e.key === 'b') {
                    e.preventDefault();
                    const align = e.key === 'z' ? 'center' : e.key === 't' ? 'start' : 'end';

                    if (focusMode === 'outline' && sidebarScrollRef.current) {
                        const selectedEl = sidebarScrollRef.current.querySelector(
                            `#outline-item-${selectedPath?.replace(/[^a-zA-Z0-9-]/g, '\\$&')}`
                        );
                        if (selectedEl) {
                            selectedEl.scrollIntoView({ behavior: 'auto', block: align });
                        }
                    } else if (listRef.current) {
                        listRef.current.scrollToRow({
                            index: currentPageRef.current - 1,
                            align,
                            behavior: 'instant',
                        });
                    }
                    setPendingCommand(null);
                    return;
                }
                if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                    setPendingCommand(null);
                }
                return;
            }

            // 2. Immediate Global Shortcuts
            if (e.key === 'Escape') {
                e.preventDefault();
                setPendingCommand(null);
                if (helpOpen) {
                    toggleHelp();
                } else if (focusMode === 'outline') {
                    setFocusMode('pdf');
                } else if (sidebarOpen) {
                    setFocusMode('outline');
                }
                return;
            }

            if (e.key === 'g') {
                e.preventDefault();
                setPendingCommand('g');
                return;
            }

            if (e.key === 'G') {
                e.preventDefault();
                if (focusMode === 'outline' && flatOutline.length > 0) {
                    setSelectedPath(flatOutline[flatOutline.length - 1].path);
                } else if (listRef.current && typeof numPagesRef.current === 'number') {
                    const currentScroll = listRef.current.element.scrollTop;
                    addToHistory(currentPageRef.current, currentScroll);
                    const targetPage = numPagesRef.current;
                    isInternalPageUpdate.current = true;
                    setCurrentPage(targetPage);
                    const logicalItemHeight = baseHeightRef.current * scaleRef.current + 24;
                    const targetScroll = targetPage * logicalItemHeight;
                    addToHistory(targetPage, targetScroll);

                    listRef.current.element.scrollTo({
                        top: targetScroll,
                        behavior: 'instant',
                    });
                    targetScrollTopRef.current = targetScroll;
                    updateProgress(targetPage, targetScroll);
                }
                return;
            }

            if (e.key === 'z') {
                e.preventDefault();
                setPendingCommand('z');
                return;
            }

            if (e.key === 't') {
                e.preventDefault();
                toggleSidebar();
                return;
            }

            if (e.key === 'a') {
                e.preventDefault();
                toggleMode();
                return;
            }

            if (e.key === '?') {
                e.preventDefault();
                toggleHelp();
                return;
            }

            // 3. Mode-Specific Shortcuts
            if (focusMode === 'outline' && flatOutline.length > 0) {
                const currentIndex = flatOutline.findIndex((i) => i.path === selectedPath);

                if (e.key === 'j' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = Math.min(currentIndex + 1, flatOutline.length - 1);
                    setSelectedPath(flatOutline[nextIndex]?.path || flatOutline[0].path);
                } else if (e.key === 'k' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = Math.max(currentIndex - 1, 0);
                    setSelectedPath(flatOutline[prevIndex]?.path || flatOutline[0].path);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        const item = flatOutline[currentIndex];
                        if (item.dest) {
                            const currentScroll = listRef.current?.element?.scrollTop || 0;
                            addToHistory(currentPageRef.current, currentScroll);
                            jumpToDestination(item.dest);
                        }
                    }
                } else if (e.key === 'l' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        const item = flatOutline[currentIndex];
                        if (item.hasChildren && !item.expanded) toggleOutlineExpand(item.path);
                    }
                } else if (e.key === 'h' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (currentIndex >= 0) {
                        const item = flatOutline[currentIndex];
                        if (item.hasChildren && item.expanded) toggleOutlineExpand(item.path);
                    }
                }
                return;
            }

            if (focusMode === 'pdf') {
                if (e.key === 'l' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (listRef.current && currentPageRef.current < (numPages || 0)) {
                        setCurrentPage(currentPageRef.current + 1);
                    }
                } else if (e.key === 'h' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (listRef.current && currentPageRef.current > 1) {
                        setCurrentPage(currentPageRef.current - 1);
                    }
                }
            }
        },
        { event: 'keydown' },
        [
            focusMode,
            flatOutline,
            selectedPath,
            numPages,
            pdfDocument,
            pendingCommand,
            helpOpen,
            toggleHelp,
            sidebarOpen,
            toggleSidebar,
            addToHistory,
            setCurrentPage,
            setPendingCommand,
            setSelectedPath,
            toggleOutlineExpand,
            jumpToDestination,
            fitMode,
            currentPage,
        ]
    );

    // Breadcrumb: filename > current heading path based on currentPage
    const breadcrumb = useMemo(() => {
        // Get filename
        let filename = '';
        if (typeof file === 'string') {
            filename = file.split('/').pop() || file;
        } else if (file instanceof File) {
            filename = file.name;
        }
        // Remove .pdf extension for cleaner display
        filename = filename.replace(/\.pdf$/i, '');

        if (!outlineWithPages || outlineWithPages.length === 0) {
            return { filename, path: [] as string[] };
        }

        // Find active path based on currentPage
        // At each level, find the last item whose pageNumber <= currentPage
        const titles: string[] = [];

        const findActivePath = (items: any[]): void => {
            let activeItem: any = null;
            for (const item of items) {
                if (item.pageNumber > 0 && item.pageNumber <= currentPage) {
                    activeItem = item;
                }
            }
            if (activeItem) {
                titles.push(activeItem.title);
                if (activeItem.items && activeItem.items.length > 0) {
                    findActivePath(activeItem.items);
                }
            }
        };

        findActivePath(outlineWithPages);

        return { filename, path: titles };
    }, [file, outlineWithPages, currentPage]);

    return (
        <div
            className={clsx(
                'flex flex-col h-screen w-full transition-opacity duration-500 ease-out overflow-hidden',
                theme === 'dark' ? 'bg-[#1a1a1a] text-gray-200' : 'bg-[#f3f4f6] text-gray-800',
                isLayoutReady ? 'opacity-100' : 'opacity-0'
            )}
        >
            {/* Header Row - relative container for stacking */}
            <div className="relative h-12 shrink-0 z-30 overflow-hidden">
                {/* Sidebar Header - Overlay with transform */}
                <div
                    className={clsx(
                        'absolute top-0 left-0 w-80 h-full flex items-center justify-between px-4 border-b z-20 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                        theme === 'dark' ? 'border-[#333] bg-[#222]' : 'border-gray-200 bg-white',
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    )}
                >
                    <h2
                        className={clsx(
                            'font-semibold text-sm tracking-wide whitespace-nowrap',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}
                    >
                        OUTLINE{' '}
                        {focusMode === 'outline' && (
                            <span className="text-blue-500 ml-2 text-xs">[FOCUSED]</span>
                        )}
                    </h2>
                    <button onClick={toggleSidebar}>
                        <X
                            size={16}
                            className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}
                        />
                    </button>
                </div>

                {/* Main Header - Full Width Underneath */}
                <header
                    className={clsx(
                        'absolute inset-0 flex items-center justify-between px-4 border-b z-10 transition-colors',
                        theme === 'dark'
                            ? 'border-[#333] bg-[#222]'
                            : 'border-gray-200 bg-white shadow-sm'
                    )}
                >
                    {/* Left Group: Menu + Breadcrumb - Shifted when sidebar open */}
                    <div
                        className={clsx(
                            'flex items-center space-x-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] min-w-0 flex-1',
                            sidebarOpen ? 'pl-80' : 'pl-0'
                        )}
                    >
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                'transition-opacity duration-300 shrink-0',
                                sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
                            )}
                        >
                            <Menu
                                size={18}
                                className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
                            />
                        </button>
                        {/* Breadcrumb: filename > path items */}
                        <div className="flex items-center text-sm min-w-0 flex-1">
                            <span
                                className={clsx(
                                    'font-medium shrink-0',
                                    theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                                )}
                            >
                                {breadcrumb.filename || 'Document'}
                            </span>
                            {breadcrumb.path.map((title, index) => (
                                <span key={index} className="flex items-center min-w-0">
                                    <ChevronRight
                                        size={14}
                                        className="mx-1 text-gray-400 shrink-0"
                                    />
                                    <span
                                        className={clsx(
                                            'truncate',
                                            index === breadcrumb.path.length - 1
                                                ? 'max-w-[300px]'
                                                : 'max-w-[150px]',
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                        )}
                                    >
                                        {title}
                                    </span>
                                </span>
                            ))}
                        </div>
                        {pendingCommand && (
                            <span
                                className={clsx(
                                    'ml-2 px-2 py-0.5 rounded text-xs font-mono border animate-pulse',
                                    theme === 'dark'
                                        ? 'bg-blue-600/20 text-blue-400 border-blue-600/50'
                                        : 'bg-blue-100 text-blue-700 border-blue-300'
                                )}
                            >
                                {pendingCommand}...
                            </span>
                        )}
                    </div>
                    {/* Right side: Info */}
                    <div
                        className={clsx(
                            'flex items-center space-x-3 text-xs z-10 pl-4 relative',
                            theme === 'dark' ? 'bg-[#222]' : 'bg-white'
                        )}
                    >
                        {/* Status indicators */}
                        <div className="flex items-center space-x-1 font-mono">
                            <span
                                className={clsx(
                                    'px-2 py-0.5 rounded',
                                    theme === 'dark' ? 'bg-[#333]' : 'bg-gray-100 text-gray-600'
                                )}
                            >
                                {fitMode === 'absolute' ? 'A' : 'R'}{' '}
                                {Math.round(
                                    (fitMode === 'absolute' ? visualScale : fitRatio) * 100
                                )}
                                %
                            </span>
                            <span
                                className={clsx(
                                    'px-2 py-0.5 rounded',
                                    theme === 'dark' ? 'bg-[#333]' : 'bg-gray-100 text-gray-600'
                                )}
                            >
                                {currentPage}/{numPages || '-'}
                            </span>
                        </div>

                        {/* Help hint */}
                        <button
                            onClick={toggleHelp}
                            className={clsx(
                                'px-2 py-0.5 rounded flex items-center gap-1',
                                theme === 'dark'
                                    ? 'hover:bg-[#333] text-gray-400'
                                    : 'hover:bg-gray-100 text-gray-500'
                            )}
                        >
                            <HelpCircle size={14} />
                            <span className="font-mono">?</span>
                        </button>
                    </div>
                </header>
            </div>

            {/* Content Row - relative container for sidebar overlay */}
            <div className="flex-1 relative overflow-hidden" onClick={() => setFocusMode('pdf')}>
                {/* Sidebar Body - Overlay with transform animation */}
                <aside
                    ref={sidebarScrollRef}
                    className={clsx(
                        'absolute top-0 left-0 h-full w-80 z-20',
                        'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-y-auto',
                        theme === 'dark'
                            ? 'bg-[#1a1a1a] border-r border-[#333]'
                            : 'bg-white border-r border-gray-200 shadow-lg',
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                        focusMode === 'outline' && 'ring-1 ring-blue-500'
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        setFocusMode('outline');
                    }}
                >
                    <div className="p-2">
                        {/* Use the shared flatOutline state - no need for nested Document here */}
                        <PDFOutline
                            items={flatOutline}
                            selectedPath={selectedPath}
                            onItemClick={(item: FlatOutlineItem) => {
                                setSelectedPath(item.path);
                                if (item.dest) jumpToDestination(item.dest);
                            }}
                            onToggleExpand={toggleOutlineExpand}
                        />
                    </div>
                </aside>

                {/* PDF View - Container applies CSS transform for zoom */}
                <div
                    className={clsx(
                        'absolute inset-0 transition-colors duration-300 overflow-hidden',
                        theme === 'dark' ? 'bg-[#111]' : 'bg-[#f3f4f6]' // Ensure root has theme background
                    )}
                    style={{ backgroundColor: theme === 'dark' ? '#111' : '#f3f4f6' }}
                >
                    <AutoSizer>
                        {({ height, width }) => {
                            if (!height || !width || isNaN(height) || isNaN(width)) return null;
                            // ULTRA-WIDE LOGICAL PLANE:
                            // Fixed large width (3000px) as the logical layout plane for horizontal stability.
                            const logicalWidth = 3000;

                            // HEIGHT HYSTERESIS LOGIC:
                            // To prevent "black flashes" during transition, we must ensure the logical height
                            // is large enough to cover the screen even at the SMALLER of the two scale states.

                            // 1. Calculate ratios for both states

                            const getRatio = (isSidebarOpen: boolean) => {
                                if (
                                    fitMode === 'absolute' ||
                                    !baseWidth ||
                                    !baseHeight ||
                                    !renderScale
                                )
                                    return (visualScale || 1.2) / (renderScale || 1.5);

                                const currentAvailableWidth = isSidebarOpen
                                    ? Math.max(100, windowWidth - 320)
                                    : Math.max(100, windowWidth);

                                const ratio =
                                    (currentAvailableWidth * (fitRatio || 0.9)) /
                                    (baseWidth || 1) /
                                    (renderScale || 1.5);
                                return Math.max(0.01, ratio);
                            };

                            const ratioOpen = getRatio(true);
                            const ratioClosed = getRatio(false);

                            // 2. During transition, use the logical height that corresponds to the SMALLEST ratio
                            // (which is the LARGEST logical height). This ensures full coverage.
                            const safeMinRatio = Math.max(0.01, Math.min(ratioOpen, ratioClosed));
                            const transitionHeight = height / safeMinRatio;
                            const nominalHeight = height / (transformRatio || 1);

                            let logicalHeight = isZoomTransitioning
                                ? transitionHeight
                                : nominalHeight;

                            if (isNaN(logicalHeight)) logicalHeight = height;

                            return (
                                <div
                                    style={{
                                        height,
                                        width,
                                        overflow: 'hidden',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        backgroundColor: theme === 'dark' ? '#111' : '#f3f4f6',
                                    }}
                                >
                                    <div
                                        style={{
                                            transform: `translateX(${sidebarOpen ? 160 : 0}px) scale(${transformRatio}) translateZ(0)`,
                                            transformOrigin: 'center top',
                                            transition: isZoomTransitioning
                                                ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                                                : 'none',
                                            width: logicalWidth,
                                            height: logicalHeight,
                                            willChange: 'transform',
                                            backfaceVisibility: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            backgroundColor: theme === 'dark' ? '#111' : '#f3f4f6',
                                        }}
                                    >
                                        <Document
                                            file={file}
                                            onLoadSuccess={onDocumentLoadSuccess}
                                            externalLinkTarget="_blank"
                                            onItemClick={({ pageNumber, dest }) => {
                                                // Use pageNumber directly since react-pdf has already resolved it
                                                if (pageNumber) {
                                                    const currentScroll =
                                                        listRef.current?.element?.scrollTop || 0;
                                                    addToHistory(
                                                        currentPageRef.current,
                                                        currentScroll
                                                    );
                                                    isInternalPageUpdate.current = true;
                                                    setCurrentPage(pageNumber);
                                                    const logicalItemHeight =
                                                        baseHeightRef.current * scaleRef.current +
                                                        24;
                                                    const targetScroll =
                                                        (pageNumber - 1) * logicalItemHeight;
                                                    addToHistory(pageNumber, targetScroll);
                                                    if (listRef.current?.element) {
                                                        listRef.current.element.scrollTo({
                                                            top: targetScroll,
                                                            behavior: 'instant',
                                                        });
                                                        targetScrollTopRef.current = targetScroll;
                                                        updateProgress(pageNumber, targetScroll);
                                                    }
                                                } else if (dest) {
                                                    // Fallback: resolve dest if pageNumber is not available
                                                    jumpToDestination(dest);
                                                }
                                            }}
                                            className="flex flex-col items-center"
                                            loading={
                                                <div
                                                    style={{
                                                        height: height,
                                                        width: width,
                                                        backgroundColor:
                                                            theme === 'dark' ? '#111' : '#f3f4f6',
                                                    }}
                                                />
                                            }
                                        >
                                            <List
                                                listRef={listRef}
                                                style={{
                                                    height: logicalHeight,
                                                    width: logicalWidth,
                                                    backgroundColor:
                                                        theme === 'dark' ? '#111' : '#f3f4f6',
                                                }}
                                                rowCount={numPages || 0}
                                                rowHeight={itemHeight}
                                                className="scrollbar-hide outline-none"
                                                rowComponent={Row as any}
                                                rowProps={{ renderScale, theme, numPages }}
                                                onScroll={onScroll}
                                            />
                                        </Document>
                                    </div>
                                </div>
                            );
                        }}
                    </AutoSizer>
                </div>
            </div>
        </div>
    );
}
