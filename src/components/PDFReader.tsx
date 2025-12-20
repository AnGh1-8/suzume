'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// @ts-ignore
import { List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const Row = ({ index, style, scale }: any) => (
    <div style={{ ...style, display: 'flex', justifyContent: 'center', padding: '2px' }}>
        <div className="shadow-2xl relative">
            <Page
                pageNumber={index + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={<div className="w-[600px] h-[800px] bg-[#222] animate-pulse rounded" />}
                onRenderSuccess={() => {
                    /* update loaded pages? */
                }}
            />
        </div>
    </div>
);
import { usePDFStore } from '@/store/usePDFStore';
import { useWindowSize, useKey } from 'react-use';
import {
    ChevronRight,
    ChevronDown,
    Search,
    Menu,
    ZoomIn,
    ZoomOut,
    X,
    HelpCircle,
} from 'lucide-react';
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
        scale,
        currentPage,
        numPages,
        sidebarOpen,
        focusMode,
        expandedPaths,
        selectedPath,
        setNumPages,
        setCurrentPage,
        toggleSidebar,
        setSidebarOpen,
        setFocusMode,
        toggleOutlineExpand,
        setSelectedPath,
        zoomIn,
        zoomOut,
        pendingCommand,
        setPendingCommand,
        theme,
        fitMode,
        fitRatio,
        setFitMode,
        setFitRatio,
        setScale,
        addToHistory,
        goBackInHistory,
        goForwardInHistory,
        helpOpen,
        toggleHelp,
    } = usePDFStore();

    const listRef = useRef<any>(null);
    const { width: windowWidth, height: windowHeight } = useWindowSize(); // Clean usage
    const windowScale = { width: windowWidth, height: windowHeight }; // Mock obj for dependency array if needed or just use vars
    // Raw Outline from react-pdf
    const [outline, setRawOutline] = useState<any[]>([]);

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
    useEffect(() => {
        if (!pdfDocument || !numPages) return;

        const calculateScale = async () => {
            try {
                const page = await pdfDocument.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1 });
                const { width: pageWidth, height: pageHeight } = viewport;
                const { width: windowWidth, height: windowHeight } = windowScale; // Use react-use window size

                // Subtract sidebar width if open (approx 320px)
                const availableWidth = sidebarOpen ? windowWidth - 320 : windowWidth;

                let newScale = scale;

                if (fitMode === 'fit-width') {
                    // Use fitRatio (default 0.9)
                    newScale = (availableWidth * fitRatio) / pageWidth;
                } else if (fitMode === 'fit-page') {
                    // Fit entirely within window (max of width/height fits min of window dimensions)
                    const widthScale = availableWidth / pageWidth;
                    const heightScale = windowHeight / pageHeight;
                    newScale = Math.min(widthScale, heightScale) * 0.95; // 0.95 padding
                }

                if (newScale !== scale) {
                    setScale(newScale);
                }
            } catch (err) {
                console.error('Scale calculation error:', err);
            }
        };

        calculateScale();
        // Re-calculate on resize (windowScale changes) or sidebar toggle
    }, [fitMode, fitRatio, windowScale, sidebarOpen, currentPage, pdfDocument, numPages]);

    // --- Key Handling ---
    const prevScale = useRef(scale);
    useEffect(() => {
        if (listRef.current?.element && prevScale.current !== scale) {
            const ratio = scale / prevScale.current;
            const currentScroll = listRef.current.element.scrollTop;
            listRef.current.element.scrollTo({
                top: Math.round(currentScroll * ratio),
                behavior: 'instant',
            });
            prevScale.current = scale;
        }
    }, [scale]);

    // Keyboard Handling
    // const [pendingCommand, setPendingCommand] = useState<null | 'z' | 'g'>(null); // Moved to global store
    const activeKeys = useRef<Set<string>>(new Set());
    const requestRef = useRef<number | undefined>(undefined);
    const [baseHeight, setBaseHeight] = useState(800);

    // Load success handler
    // We use isLayoutReady to mask the UI until we've decided on the sidebar state to prevent flashing
    const [isLayoutReady, setIsLayoutReady] = useState(false);

    // Reset ready state when file changes
    useEffect(() => {
        setIsLayoutReady(false);
        // Reset scale/mode on new file
        setFitMode('fit-width');
        setFitRatio(0.9);
        setFocusMode('pdf'); // Ensure focus is on PDF, not outline
        // We don't setScale immediately here as dynamic calc will pick it up
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

    // Shared Page Update Logic
    // Use refs to access latest state inside stale closures (useEffect/animateScroll/requestAnimationFrame)
    const scaleRef = useRef(scale);
    const currentPageRef = useRef(currentPage);
    const baseHeightRef = useRef(baseHeight);

    // Flag to distinguish between page changes from scrolling (internal)
    // vs page changes from commands (external, e.g. :10)
    const isInternalPageUpdate = useRef(false);

    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);
    useEffect(() => {
        baseHeightRef.current = baseHeight;
    }, [baseHeight]);

    // Sync Scroll to Page Change (e.g. from Command :10)
    useEffect(() => {
        if (!listRef.current?.element || !numPages) return;

        // If the change came from scrolling, don't snap the scroll position
        if (isInternalPageUpdate.current) {
            isInternalPageUpdate.current = false;
            return;
        }

        // Calculate where we should be for this page
        const targetPage = currentPage;
        const itemHeight = baseHeightRef.current * scaleRef.current + 4;
        const targetScrollTop = (targetPage - 1) * itemHeight;

        // Snap to the new page
        listRef.current?.element?.scrollTo({
            top: Math.round(targetScrollTop),
            behavior: 'instant',
        });
    }, [currentPage, numPages]);

    const updatePageFromScroll = useCallback(
        (scrollTop: number) => {
            const currentItemHeight = baseHeightRef.current * scaleRef.current + 4; // 4px gap
            if (currentItemHeight <= 0 || !listRef.current?.element) return;

            // Get the actual height of the scroll container to find the center
            const viewportHeight = listRef.current.element.clientHeight;

            // Detection point is the vertical center of the screen
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

    // We still need itemHeight for the List prop
    const itemHeight = baseHeight * scale + 4;

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

        if (changed) {
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

            if (['j', 'k', 'd', 'u', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                if (!activeKeys.current.has(e.key)) {
                    activeKeys.current.add(e.key);
                    if (!requestRef.current) {
                        requestRef.current = requestAnimationFrame(animateScroll);
                    }
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (['j', 'k', 'd', 'u', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
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
                        if (!listRef.current?.element) return;
                        const vHeight = listRef.current.element.clientHeight;
                        // Use refs for accuracy
                        const pStart =
                            (currentPageRef.current - 1) *
                            (baseHeightRef.current * scaleRef.current + 4);
                        const currentItemHeight = baseHeightRef.current * scaleRef.current + 4;

                        let targetTop = pStart;
                        if (e.key === 'z')
                            targetTop = pStart - (vHeight - currentItemHeight) / 2; // zz
                        else if (e.key === 't')
                            targetTop = pStart; // zt
                        else if (e.key === 'b') targetTop = pStart - (vHeight - currentItemHeight); // zb

                        listRef.current?.element?.scrollTo({
                            top: Math.round(targetTop),
                            behavior: 'instant',
                        });
                        updatePageFromScroll(targetTop);
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

            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
                return;
            }

            if (e.key === '-') {
                e.preventDefault();
                zoomOut();
                return;
            }

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
        ]
    );

    return (
        <div
            className={clsx(
                'flex h-screen w-full transition-opacity duration-500 ease-out',
                theme === 'dark' ? 'bg-[#1a1a1a] text-gray-200' : 'bg-[#f3f4f6] text-gray-800',
                isLayoutReady ? 'opacity-100' : 'opacity-0'
            )}
        >
            {/* Sidebar - Always in DOM but width animates */}
            <aside
                className={clsx(
                    'flex flex-col transition-all duration-300 overflow-hidden',
                    theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white',
                    sidebarOpen
                        ? `w-80 border-r ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200 shadow-sm'}`
                        : 'w-0 border-none',
                    focusMode === 'outline' && 'ring-1 ring-blue-500 z-10'
                )}
            >
                <div className="w-80 flex flex-col h-full">
                    {' '}
                    {/* Inner wrapper to maintain width during transition */}
                    <div
                        className={clsx(
                            'p-4 border-b flex justify-between items-center',
                            theme === 'dark'
                                ? 'border-[#333] bg-[#222]'
                                : 'border-gray-200 bg-white'
                        )}
                    >
                        <h2
                            className={clsx(
                                'font-semibold text-sm tracking-wide',
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
                    <div
                        className={clsx(
                            'flex-1 overflow-y-auto p-2 w-full',
                            theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'
                        )}
                    >
                        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
                            <PDFOutline
                                items={flatOutline}
                                selectedPath={selectedPath}
                                onItemClick={(item: FlatOutlineItem) => {
                                    setSelectedPath(item.path);
                                    if (item.dest) jumpToDestination(item.dest);
                                }}
                                onToggleExpand={toggleOutlineExpand}
                            />
                        </Document>
                    </div>
                </div>
            </aside>

            <div
                className="flex-1 flex flex-col h-full relative"
                onClick={() => setFocusMode('pdf')}
            >
                {/* Toolbar */}
                <header
                    className={clsx(
                        'h-12 border-b flex items-center px-4 justify-between transition-colors',
                        theme === 'dark'
                            ? 'border-[#333] bg-[#222]'
                            : 'border-gray-200 bg-white shadow-sm z-10'
                    )}
                >
                    <div className="flex items-center space-x-4">
                        {!sidebarOpen && (
                            <button onClick={toggleSidebar}>
                                <Menu
                                    size={18}
                                    className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
                                />
                            </button>
                        )}
                        <span
                            className={clsx(
                                'text-sm transition-colors',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}
                        >
                            Page {currentPage} / {numPages || '-'}
                        </span>
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
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={zoomOut}
                            className={clsx(
                                'p-1 rounded',
                                theme === 'dark'
                                    ? 'hover:bg-[#333]'
                                    : 'hover:bg-gray-100 text-gray-700'
                            )}
                        >
                            <ZoomOut size={18} />
                        </button>
                        <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                        <button
                            onClick={zoomIn}
                            className={clsx(
                                'p-1 rounded',
                                theme === 'dark'
                                    ? 'hover:bg-[#333]'
                                    : 'hover:bg-gray-100 text-gray-700'
                            )}
                        >
                            <ZoomIn size={18} />
                        </button>
                    </div>
                </header>

                {/* PDF View */}
                <div
                    className={clsx(
                        'flex-1 relative transition-colors duration-300',
                        theme === 'dark' ? 'bg-[#111]' : 'bg-[#f3f4f6]'
                    )}
                >
                    <AutoSizer>
                        {({ height, width }) => (
                            <div style={{ height, width }}>
                                <Document
                                    file={file}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    loading={
                                        <div className="p-10 text-center text-gray-500">
                                            Loading Document...
                                        </div>
                                    }
                                    className="flex flex-col items-center"
                                >
                                    <List
                                        listRef={listRef}
                                        style={{ height, width }}
                                        rowCount={numPages || 0}
                                        rowHeight={itemHeight}
                                        className="scrollbar-hide outline-none"
                                        rowComponent={Row}
                                        rowProps={{ scale }}
                                        onScroll={onScroll}
                                    />
                                </Document>
                            </div>
                        )}
                    </AutoSizer>
                </div>
            </div>
        </div>
    );
}
