'use client';

import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// @ts-ignore
import { List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import React, { memo } from 'react';

const Row = memo(({ index, style, renderScale, theme }: any) => {
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
                    scale={renderScale} // Fixed render scale - never changes
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                />
            </div>
        </div>
    );
});
Row.displayName = 'PDFRow';

import { usePDFStore } from '@/store/usePDFStore';
import { useWindowSize, useKey, useDebounce } from 'react-use';
import { ChevronRight, ChevronDown, Search, Menu, X, HelpCircle } from 'lucide-react';
import PDFOutline, { FlatOutlineItem } from './PDFOutline';
import clsx from 'clsx';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
        setFitMode,
        setFitRatio,
        setVisualScale,
        addToHistory,
        goBackInHistory,
        goForwardInHistory,
        helpOpen,
        toggleHelp,
        rotation,
        setRenderScale,
        setModeAbsolute,
        setModeRelative,
        toggleMode,
        setBaseWidth: setBaseWidthStore,
        setBaseHeight: setBaseHeightStore,
        setAvailableWidth: setAvailableWidthStore,
        setAvailableHeight: setAvailableHeightStore,
    } = usePDFStore();

    const listRef = useRef<any>(null);
    const { width: windowWidth, height: windowHeight } = useWindowSize(); // Clean usage
    const windowScale = { width: windowWidth, height: windowHeight }; // Mock obj for dependency array if needed or just use vars

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

    // Outline Item Click
    function onOutlineItemClick(item: FlatOutlineItem) {
        setSelectedPath(item.path);
        // Navigate PDF logic
        // Need to resolve dest to pageNumber. react-pdf typically gives dest array.
        // For simplicity, we assume simple page usage or handle dest later.
        // Usually: pdf.getDestination(dest).then(...)
        // But react-pdf outline "dest" can be string or array.
        // This is complex. For now, let's assume we can map dest...
        // Wait, current implementation uses recursive outline which passes "dest" to onItemClick.
        // Then previous implementation used "listRef.current.scrollToRow(pageNumber - 1)".
        // THIS IS MISSING. I need to map "dest" to "pageIndex".
        // react-pdf Document has "onLoadSuccess(pdf)". We can access `pdf` instance?
        // Let's store pdf instance? Or use a helper.
        // Reverting to simplistic behavior: IF dest is page index (some PDFs), otherwise log warning.
        // A better way for Outline click is just to set focus.
        // Real implementation of PDF destination is async.
        // For the sake of this task (UI/Vim), let's implement basic selection update.
        // The user didn't complain about dead links, but "browse directory".
    }

    // Since mapping Dest to Page is async and hard without pdf instance reference,
    // we will rely on react-pdf's internal link handling if possible, OR
    // just implement the navigation part for 'j'/'k' within the list.
    // Actually, I can save the `pdf` object in state to use `getPageIndex`.
    const [pdfDocument, setPdfDocument] = useState<any>(null);

    const jumpToDestination = async (dest: any) => {
        if (!pdfDocument) return;
        try {
            // resolve dest
            let explicitDest = dest;
            if (typeof dest === 'string') {
                explicitDest = await pdfDocument.getDestination(dest);
            }
            if (!explicitDest) return;

            const pageIndex = await pdfDocument.getPageIndex(explicitDest[0]);
            addToHistory(currentPage);
            const targetPage = pageIndex + 1;
            setCurrentPage(targetPage);
            addToHistory(targetPage);
        } catch (e) {
            console.error('Jump error', e);
        }
    };

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
                if (currentPage > pdfDocument.numPages) return;
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

    /**
     * DERIVE TRANSFORM RATIO:
     */
    const transformRatio = useMemo(() => {
        if (!baseWidth || !baseHeight) return visualScale / renderScale;
        let scale = visualScale;
        if (fitMode === 'relative') {
            scale = (availableWidth * fitRatio) / baseWidth;
        }
        return scale / renderScale;
    }, [fitMode, fitRatio, visualScale, renderScale, baseWidth, baseHeight, availableWidth]);

    // NOTE: Scroll adjustment for zoom is handled by useLayoutEffect below (lines ~650)
    // using vertical center anchor to preserve current page

    // Keyboard Handling
    // const [pendingCommand, setPendingCommand] = useState<null | 'z' | 'g'>(null); // Moved to global store
    const activeKeys = useRef<Set<string>>(new Set());
    const requestRef = useRef<number | undefined>(undefined);

    // Load success handler
    // We use isLayoutReady to mask the UI until we've decided on the sidebar state to prevent flashing
    const [isLayoutReady, setIsLayoutReady] = useState(false);

    // Reset ready state when file changes
    useEffect(() => {
        setIsLayoutReady(false);
        // Reset scale/mode on new file
        setFitMode('relative');
        setFitRatio(0.9);
        setFocusMode('pdf'); // Ensure focus is on PDF, not outline
        // We don't setScale immediately here as dynamic calc will pick it up
    }, [file, setFitMode, setFitRatio, setFocusMode]);

    async function onDocumentLoadSuccess(pdf: any) {
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            setBaseHeight(viewport.height);
            const outline = await pdf.getOutline();
            setRawOutline(outline);

            // Auto-close sidebar if no outline, otherwise ensure it is open
            if (!outline || outline.length === 0) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
            // Small delay to allow layout to settle before revealing
            setTimeout(() => setIsLayoutReady(true), 50);
        } catch (e) {
            console.error('Error getting pdf metadata', e);
            setIsLayoutReady(true); // Show anyway on error
        }
    }

    // Resolve page numbers for outline items (for breadcrumb based on current page)
    useEffect(() => {
        if (!pdfDocument || !outline || outline.length === 0) {
            setOutlineWithPages([]);
            return;
        }

        const resolvePageNumbers = async (items: any[]): Promise<any[]> => {
            const result = [];
            for (const item of items) {
                let pageNumber = 0;
                try {
                    let dest = item.dest;
                    if (typeof dest === 'string') {
                        dest = await pdfDocument.getDestination(dest);
                    }
                    if (dest && dest[0]) {
                        pageNumber = (await pdfDocument.getPageIndex(dest[0])) + 1;
                    }
                } catch (e) {
                    // Ignore errors
                }

                const children =
                    item.items && item.items.length > 0 ? await resolvePageNumbers(item.items) : [];

                result.push({
                    title: item.title,
                    pageNumber,
                    items: children,
                });
            }
            return result;
        };

        resolvePageNumbers(outline).then(setOutlineWithPages);
    }, [pdfDocument, outline]);

    // Shared Page Update Logic
    // Use refs to access latest state inside stale closures (useEffect/animateScroll/requestAnimationFrame)
    const scaleRef = useRef(renderScale); // Use renderScale since scroll is in logical space
    const currentPageRef = useRef(currentPage);
    const baseHeightRef = useRef(baseHeight);

    // Flag to distinguish between page changes from scrolling (internal)
    // vs page changes from commands (external, e.g. :10)
    const isInternalPageUpdate = useRef(false);

    useEffect(() => {
        scaleRef.current = renderScale; // Use renderScale since scroll is in logical space
    }, [renderScale]);
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);
    useEffect(() => {
        baseHeightRef.current = baseHeight;
    }, [baseHeight]);

    // Sync Scroll to Page Change (e.g. from Command :10)
    useEffect(() => {
        if (!listRef.current || !numPages) return;

        // If the change came from scrolling, don't snap the scroll position
        if (isInternalPageUpdate.current) {
            isInternalPageUpdate.current = false;
            return;
        }

        // Use the imperative API to ensure perfect alignment with virtual rows
        listRef.current.scrollToRow({
            index: currentPage - 1,
            align: 'start',
            behavior: 'instant',
        });
    }, [currentPage, numPages]);

    const updatePageFromScroll = useCallback(
        (scrollTop: number) => {
            // Scroll coordinates are in logical space (renderScale)
            const currentItemHeight = baseHeightRef.current * scaleRef.current + 24; // 24px gap
            if (currentItemHeight <= 0 || !listRef.current?.element) return;

            // viewportHeight in logical space
            const viewportHeight = listRef.current.element.clientHeight;

            // Detection point is the vertical center
            const detectionPoint = scrollTop + viewportHeight / 2;

            let newPage = Math.floor(detectionPoint / currentItemHeight) + 1;

            // Clamp to valid range
            if (numPages) {
                newPage = Math.max(1, Math.min(newPage, numPages));
            }

            if (!isNaN(newPage) && newPage !== currentPageRef.current) {
                isInternalPageUpdate.current = true;
                setCurrentPage(newPage);
            }
        },
        [numPages, setCurrentPage]
    );

    const onScroll = useCallback(
        (props: any) => {
            // Higher-level check: react-window usually passes an object with scrollOffset
            // But we handle both just in case of different versions/event structures
            const offset = props?.scrollOffset ?? props?.target?.scrollTop ?? props?.scrollTop;
            if (typeof offset === 'number') {
                updatePageFromScroll(offset);
            }
        },
        [updatePageFromScroll]
    );

    const animateScroll = () => {
        if (!listRef.current?.element) return;
        if (focusMode !== 'pdf') return;

        const SPEED = 15;
        const FAST_SPEED = 60; // 4x speed for d/u
        const ZOOM_SPEED = 0.02; // Per-frame zoom increment for smooth zooming

        let nextScrollTop = listRef.current.element.scrollTop;
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

        // Mode-specific smooth zoom
        if (activeKeys.current.has('+') || activeKeys.current.has('=')) {
            const state = usePDFStore.getState();
            if (state.fitMode === 'relative') {
                usePDFStore.setState({
                    fitRatio: Math.min(state.fitRatio + 0.01, 2.0),
                });
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
                usePDFStore.setState({
                    fitRatio: Math.max(state.fitRatio - 0.01, 0.1),
                });
            } else {
                usePDFStore.setState({
                    visualScale: Math.max(state.visualScale - ZOOM_SPEED, 0.1),
                });
            }
            changed = true;
        }

        if (changed && nextScrollTop !== listRef.current.element.scrollTop) {
            // Use scrollTo with 'instant' behavior to avoid browser interference
            listRef.current?.element?.scrollTo({
                top: Math.round(nextScrollTop),
                behavior: 'instant',
            });
        }

        if (activeKeys.current.size > 0) {
            requestRef.current = requestAnimationFrame(animateScroll);
        }
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (focusMode !== 'pdf') return;

            if (['j', 'k', 'd', 'u', 'ArrowDown', 'ArrowUp', '+', '=', '-'].includes(e.key)) {
                e.preventDefault(); // Prevent default for zoom keys too
                if (!activeKeys.current.has(e.key)) {
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

        // Strict capture-phase listener to block browser Ctrl+O/I
        const handleCaptureKeyPress = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // ONLY ctrl, NOT meta (Cmd), and small o/i
            if (e.ctrlKey && !e.metaKey && (e.key === 'o' || e.key === 'i')) {
                e.preventDefault();
                e.stopPropagation();

                if (e.key === 'o') {
                    const targetPage = goBackInHistory();
                    if (targetPage) {
                        isInternalPageUpdate.current = false;
                        setCurrentPage(targetPage);
                    }
                } else {
                    const targetPage = goForwardInHistory();
                    if (targetPage) {
                        isInternalPageUpdate.current = false;
                        setCurrentPage(targetPage);
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

    useKey(
        (e) => true,
        (e) => {
            // 1. Ignore if typing in an input or textarea
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // 2. Handle Pending State (Modal Priority)
            if (pendingCommand) {
                e.preventDefault();

                // Cancel on Escape
                if (e.key === 'Escape') {
                    setPendingCommand(null);
                    return;
                }

                // Handle 'z' mode
                if (pendingCommand === 'z') {
                    if (['z', 't', 'b'].includes(e.key)) {
                        if (!listRef.current) return;

                        let align: 'center' | 'start' | 'end' = 'center';
                        if (e.key === 't') align = 'start';
                        else if (e.key === 'b') align = 'end';

                        listRef.current.scrollToRow({
                            index: currentPageRef.current - 1,
                            align,
                            behavior: 'instant',
                        });

                        setPendingCommand(null);
                    }
                    // Any other key: check if modifier. Use whitelist approach or blacklist.
                    // User asked to ignore Ctrl.
                    else if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                        setPendingCommand(null);
                    }
                    return;
                }

                // Handle 'g' mode
                if (pendingCommand === 'g') {
                    if (e.key === 'g') {
                        // gg -> Top
                        if (listRef.current) {
                            addToHistory(currentPage);
                            setCurrentPage(1);
                            addToHistory(1);
                        }
                        setPendingCommand(null);
                    } else if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                        setPendingCommand(null);
                    }
                    return;
                }

                return;
            }

            // 3. Normal Mode Key Bindings

            // Escape Handling (Priority: Help > Pending > Outline focus > Sidebar focus)
            if (e.key === 'Escape') {
                e.preventDefault();
                if (helpOpen) {
                    toggleHelp();
                } else if (focusMode === 'outline') {
                    setFocusMode('pdf');
                } else if (sidebarOpen) {
                    setFocusMode('outline');
                }
                return;
            }

            // Start 'z' mode
            if (e.key === 'z') {
                e.preventDefault();
                setPendingCommand('z');
                return;
            }

            // Start 'g' mode (lowercase only)
            if (e.key === 'g') {
                e.preventDefault();
                setPendingCommand('g');
                return;
            }

            // Immediate G (Shift+g)
            if (e.key === 'G') {
                e.preventDefault();
                if (listRef.current && numPages) {
                    addToHistory(currentPage);
                    setCurrentPage(numPages);
                    addToHistory(numPages);
                }
                return;
            }

            // Toggle Sidebar
            if (e.key === 't') {
                e.preventDefault();
                toggleSidebar();
                return;
            }

            // Toggle Mode (Absolute/Relative)
            if (e.key === 'a') {
                e.preventDefault();
                toggleMode();
                return;
            }

            // +/- zoom is now handled in the RAF animation loop above
            // (see animateScroll function)

            // Global Modes (Outline focus)
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
                        if (item.dest) jumpToDestination(item.dest);
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

            // PDF Mode
            if (focusMode === 'pdf') {
                if (e.key === 'l' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (listRef.current && currentPageRef.current < (numPages || 0)) {
                        const nextPage = currentPageRef.current + 1;
                        setCurrentPage(nextPage);
                    }
                } else if (e.key === 'h' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (listRef.current && currentPageRef.current > 1) {
                        const prevPage = currentPageRef.current - 1;
                        setCurrentPage(prevPage);
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
        ]
    );

    // itemHeight uses FIXED renderScale - layout never changes during zoom
    const itemHeight = baseHeight * renderScale + 24;

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
                    {/* Left Group: Menu + Breadcrumb - Translatable */}
                    <div
                        className={clsx(
                            'flex items-center space-x-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] max-w-full',
                            sidebarOpen ? 'translate-x-80' : 'translate-x-0'
                        )}
                    >
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                'transition-opacity duration-300',
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
                            // ULTRA-WIDE LOGICAL PLANE:
                            // Fixed large width (3000px) as the logical layout plane for horizontal stability.
                            const logicalWidth = 3000;

                            // HEIGHT HYSTERESIS LOGIC:
                            // To prevent "black flashes" during transition, we must ensure the logical height
                            // is large enough to cover the screen even at the SMALLER of the two scale states.

                            // 1. Calculate ratios for both states

                            const getRatio = (isSidebarOpen: boolean) => {
                                if (fitMode === 'absolute' || !baseWidth || !baseHeight)
                                    return visualScale / renderScale;
                                const currentAvailableWidth = isSidebarOpen
                                    ? windowWidth - 320
                                    : windowWidth;
                                return (currentAvailableWidth * fitRatio) / baseWidth / renderScale;
                            };

                            const ratioOpen = getRatio(true);
                            const ratioClosed = getRatio(false);

                            // 2. During transition, use the logical height that corresponds to the SMALLEST ratio
                            // (which is the LARGEST logical height). This ensures full coverage.
                            const transitionHeight = height / Math.min(ratioOpen, ratioClosed);
                            const nominalHeight = height / transformRatio;

                            const logicalHeight = isZoomTransitioning
                                ? transitionHeight
                                : nominalHeight;

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
                                                rowProps={{ renderScale, theme }}
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
