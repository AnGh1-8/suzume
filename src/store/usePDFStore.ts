import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { saveFileToIdb, getFileFromIdb } from '@/lib/persistence';

interface PDFState {
    file: File | string | null;
    numPages: number | null;
    currentPage: number;
    renderScale: number; // Fixed scale for PDF canvas rendering (higher = sharper but more memory)
    visualScale: number; // CSS transform scale for instant zoom (no re-render)
    rotation: number;
    sidebarOpen: boolean;
    focusMode: 'pdf' | 'outline';
    expandedPaths: Set<string>;
    selectedPath: string | null;
    helpOpen: boolean;
    pendingCommand: null | 'z' | 'g';
    theme: 'light' | 'dark';
    fitMode: 'absolute' | 'relative';
    fitRatio: number; // For relative mode (e.g. 0.9 for 90%)
    jumpHistory: { page: number; scrollTop: number }[];
    historyIndex: number;
    fileProgress: Record<
        string,
        {
            page: number;
            scrollTop: number;
            renderScale: number;
            visualScale: number;
            fitMode: 'absolute' | 'relative';
            fitRatio: number;
            jumpHistory: { page: number; scrollTop: number }[];
            historyIndex: number;
            sidebarOpen: boolean;
        }
    >;
    recentFiles: File[];
    recentFileNames: string[]; // For persistence
    finderOpen: boolean;
    baseWidth: number; // PDF page width at scale 1
    baseHeight: number; // PDF page height at scale 1
    availableWidth: number; // Viewport width minus sidebar (if applicable)
    availableHeight: number; // Viewport height minus header (if applicable)

    setFile: (file: File | string | null) => void;
    setNumPages: (num: number) => void;
    setCurrentPage: (page: number) => void;
    setRenderScale: (scale: number) => void;
    setVisualScale: (scale: number) => void;
    setRotation: (rotation: number) => void;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void; // Explicit setter

    setFocusMode: (mode: 'pdf' | 'outline') => void;
    toggleOutlineExpand: (path: string) => void;
    setSelectedPath: (path: string | null) => void;
    setPendingCommand: (cmd: null | 'z' | 'g') => void;
    toggleHelp: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
    setFitMode: (mode: 'absolute' | 'relative') => void;
    setFitRatio: (ratio: number) => void;
    toggleMode: () => void;

    setBaseWidth: (width: number) => void;
    setBaseHeight: (height: number) => void;
    setAvailableWidth: (width: number) => void;
    setAvailableHeight: (height: number) => void;
    setModeAbsolute: (val?: number) => void;
    setModeRelative: (val?: number) => void;

    // History Actions
    addToHistory: (page: number, scrollTop: number) => void;
    goBackInHistory: () => { page: number; scrollTop: number } | null;
    goForwardInHistory: () => { page: number; scrollTop: number } | null;

    // Recent Files & Finder
    addToRecentFiles: (file: File) => void;
    toggleFinder: () => void;
    setFinderOpen: (open: boolean) => void;
    hydrateRecentFiles: () => Promise<void>;

    // Actions for zoom (modify visualScale only, no re-render)
    zoomIn: () => void;
    zoomOut: () => void;
    updateProgress: (page: number, scrollTop: number) => void;
}

export const usePDFStore = create<PDFState>()(
    persist(
        (set, get) => ({
            file: null,
            numPages: null,
            currentPage: 1,
            renderScale: 1.5, // Fixed: render at 1.5x for good quality
            visualScale: 1.2, // CSS transform scale (user-adjustable)
            rotation: 0,
            sidebarOpen: true,
            focusMode: 'pdf', // 'pdf' | 'outline'

            // Outline State
            expandedPaths: new Set<string>(), // Using string paths "0", "0-1", etc.
            selectedPath: null as string | null,
            helpOpen: false,
            pendingCommand: null,
            theme: 'dark',
            fitMode: 'relative',
            fitRatio: 0.9,
            jumpHistory: [],
            historyIndex: -1,
            fileProgress: {},
            recentFiles: [],
            recentFileNames: [],
            finderOpen: false,
            baseWidth: 600,
            baseHeight: 800,
            availableWidth: 1000,
            availableHeight: 800,

            setFile: (file) =>
                set((state) => {
                    const fileName = file ? (typeof file === 'string' ? file : file.name) : null;
                    const lastFileName = state.recentFileNames[0];
                    const isSameFile =
                        file && state.recentFileNames.length > 0 && fileName === lastFileName;

                    const updatedProgress = { ...state.fileProgress };

                    // 1. Snapshot current file's state before switching
                    // We do this even if isSameFile is true, because we want to capture
                    // the *very latest* state (e.g. sidebar just toggled) before re-rendering or "re-opening".
                    if (lastFileName) {
                        const previousProgress = updatedProgress[lastFileName];
                        updatedProgress[lastFileName] = {
                            page: Math.max(1, state.currentPage),
                            // Preserve scrollTop from last sync (best effort) since we don't have live DOM access here
                            scrollTop: previousProgress?.scrollTop || 0,
                            renderScale: state.renderScale,
                            visualScale: state.visualScale,
                            fitMode: state.fitMode,
                            fitRatio: state.fitRatio,
                            sidebarOpen: state.sidebarOpen,
                            jumpHistory: state.jumpHistory,
                            historyIndex: state.historyIndex,
                        };
                    }
                    let updatedFiles = state.recentFiles;
                    let updatedNames = state.recentFileNames;

                    if (file && file instanceof File) {
                        saveFileToIdb(file);
                        updatedFiles = [
                            file,
                            ...state.recentFiles.filter((f) => f.name !== file.name),
                        ].slice(0, 10);
                        updatedNames = [
                            file.name,
                            ...state.recentFileNames.filter((n) => n !== file.name),
                        ].slice(0, 10);
                    } else if (typeof file === 'string') {
                        updatedNames = [
                            file,
                            ...state.recentFileNames.filter((n) => n !== file),
                        ].slice(0, 10);
                    }

                    // Look up new file's progress
                    const restoredProgress = fileName ? updatedProgress[fileName] : null;

                    return {
                        file,
                        fileProgress: updatedProgress, // Use existing progress, don't overwrite with stale data
                        recentFiles: updatedFiles,
                        recentFileNames: updatedNames,
                        currentPage: restoredProgress
                            ? Math.max(1, restoredProgress.page)
                            : isSameFile
                              ? state.currentPage
                              : 1,
                        renderScale:
                            restoredProgress?.renderScale && !isNaN(restoredProgress.renderScale)
                                ? restoredProgress.renderScale
                                : isSameFile
                                  ? state.renderScale
                                  : 1.5,
                        visualScale:
                            restoredProgress?.visualScale && !isNaN(restoredProgress.visualScale)
                                ? restoredProgress.visualScale
                                : isSameFile
                                  ? state.visualScale
                                  : 1.2,
                        fitMode: restoredProgress
                            ? restoredProgress.fitMode
                            : isSameFile
                              ? state.fitMode
                              : 'relative',
                        sidebarOpen:
                            restoredProgress && restoredProgress.sidebarOpen !== undefined
                                ? restoredProgress.sidebarOpen
                                : isSameFile
                                  ? state.sidebarOpen
                                  : true,
                        fitRatio:
                            restoredProgress?.fitRatio && !isNaN(restoredProgress.fitRatio)
                                ? restoredProgress.fitRatio
                                : isSameFile
                                  ? state.fitRatio
                                  : 0.9,
                        numPages: isSameFile ? state.numPages : null,
                        jumpHistory: restoredProgress
                            ? restoredProgress.jumpHistory
                            : isSameFile
                              ? state.jumpHistory
                              : [],
                        historyIndex: restoredProgress
                            ? restoredProgress.historyIndex
                            : isSameFile
                              ? state.historyIndex
                              : -1,
                        selectedPath: isSameFile ? state.selectedPath : null,
                        expandedPaths: isSameFile ? state.expandedPaths : new Set<string>(),
                    };
                }),
            setNumPages: (numPages) => set({ numPages }),
            setCurrentPage: (currentPage) =>
                set((state) => ({
                    currentPage: Math.max(1, Math.min(currentPage, state.numPages || currentPage)),
                })),
            setRenderScale: (renderScale: number) => set({ renderScale }),
            setVisualScale: (visualScale: number) => set({ visualScale }),
            setRotation: (rotation) => set({ rotation }),
            toggleSidebar: () =>
                set((state) => {
                    const newOpen = !state.sidebarOpen;
                    return {
                        sidebarOpen: newOpen,
                        focusMode: newOpen ? 'outline' : 'pdf',
                    };
                }),
            setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }), // Do NOT switch focus mode here
            setFocusMode: (mode: 'pdf' | 'outline') => set({ focusMode: mode }),

            toggleOutlineExpand: (path: string) =>
                set((state) => {
                    const newExpanded = new Set(state.expandedPaths);
                    if (newExpanded.has(path)) {
                        newExpanded.delete(path);
                    } else {
                        newExpanded.add(path);
                    }
                    return { expandedPaths: newExpanded };
                }),
            setSelectedPath: (path: string | null) => set({ selectedPath: path }),
            setPendingCommand: (cmd) => set({ pendingCommand: cmd }),
            setTheme: (theme) => set({ theme }),
            setFitMode: (mode) => set({ fitMode: mode }),
            setFitRatio: (ratio) => set({ fitRatio: ratio }),

            addToHistory: (page, scrollTop) =>
                set((state) => {
                    const currentHistory = state.jumpHistory;
                    const currentIndex = state.historyIndex;
                    const newItem = { page, scrollTop };

                    // If we are navigating in the middle, truncate the "future"
                    // But keep current item if we're moving past it
                    const newHistory = currentHistory.slice(0, currentIndex + 1);

                    // Avoid consecutive duplicates
                    if (newHistory.length > 0) {
                        const last = newHistory[newHistory.length - 1];
                        if (last.page === page && Math.abs(last.scrollTop - scrollTop) < 50) {
                            if (currentIndex === currentHistory.length - 1) return state;
                            return { historyIndex: newHistory.length - 1 };
                        }
                    }

                    const updatedHistory = [...newHistory, newItem];
                    if (updatedHistory.length > 50) {
                        updatedHistory.shift();
                    }

                    return {
                        jumpHistory: updatedHistory,
                        historyIndex: updatedHistory.length - 1,
                    };
                }),

            goBackInHistory: () => {
                let item: { page: number; scrollTop: number } | null = null;
                set((state) => {
                    if (state.historyIndex > 0) {
                        const newIndex = state.historyIndex - 1;
                        item = state.jumpHistory[newIndex];
                        return { historyIndex: newIndex };
                    }
                    return state;
                });
                return item;
            },

            goForwardInHistory: () => {
                let item: { page: number; scrollTop: number } | null = null;
                set((state) => {
                    if (state.historyIndex < state.jumpHistory.length - 1) {
                        const newIndex = state.historyIndex + 1;
                        item = state.jumpHistory[newIndex];
                        return { historyIndex: newIndex };
                    }
                    return state;
                });
                return item;
            },

            addToRecentFiles: (file) => {
                saveFileToIdb(file); // Fire and forget save to IDB

                set((state) => {
                    const updatedFiles = [
                        file,
                        ...state.recentFiles.filter((f) => f.name !== file.name),
                    ].slice(0, 10);
                    const updatedNames = [
                        file.name,
                        ...state.recentFileNames.filter((n) => n !== file.name),
                    ].slice(0, 10);

                    return {
                        recentFiles: updatedFiles,
                        recentFileNames: updatedNames,
                    };
                });
            },

            hydrateRecentFiles: async () => {
                const names = get().recentFileNames;
                const files: File[] = [];
                for (const name of names) {
                    const file = await getFileFromIdb(name);
                    if (file) files.push(file);
                }
                set({ recentFiles: files });
            },

            toggleFinder: () => set((state) => ({ finderOpen: !state.finderOpen })),
            setFinderOpen: (open) => set({ finderOpen: open }),

            toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),

            zoomIn: () =>
                set((state) => ({
                    visualScale: Math.min(state.visualScale + 0.05, 3),
                    fitMode: 'absolute',
                })),
            zoomOut: () =>
                set((state) => ({
                    visualScale: Math.max(state.visualScale - 0.05, 0.5),
                    fitMode: 'absolute',
                })),

            toggleMode: () => {
                const { fitMode } = get();
                if (fitMode === 'relative') {
                    get().setModeAbsolute();
                } else {
                    get().setModeRelative();
                }
            },

            setBaseWidth: (width: number) => set({ baseWidth: width }),
            setBaseHeight: (height: number) => set({ baseHeight: height }),
            setAvailableWidth: (availableWidth: number) => set({ availableWidth }),
            setAvailableHeight: (availableHeight: number) => set({ availableHeight }),

            setModeAbsolute: (val?: number) =>
                set((state) => {
                    if (val !== undefined) {
                        return { fitMode: 'absolute', visualScale: val / 100 };
                    }
                    // Conversion: Keep visual size same
                    // scale = (availableWidth * ratio) / baseWidth
                    const currentScale =
                        (state.availableWidth * state.fitRatio) / (state.baseWidth || 1);
                    return { fitMode: 'absolute', visualScale: currentScale };
                }),

            setModeRelative: (val?: number) =>
                set((state) => {
                    if (val !== undefined) {
                        return { fitMode: 'relative', fitRatio: val / 100 };
                    }
                    // Conversion: Keep visual size same
                    // ratio = (visualScale * baseWidth) / availableWidth
                    const currentRatio =
                        (state.visualScale * (state.baseWidth || 1)) / (state.availableWidth || 1);
                    return { fitMode: 'relative', fitRatio: currentRatio };
                }),

            updateProgress: (page, scrollTop) =>
                set((state) => {
                    const fileName = state.recentFileNames[0];
                    const safePage = Math.max(1, page);
                    if (!fileName) return { currentPage: safePage };

                    const updatedProgress = { ...state.fileProgress };
                    const lastProgress = updatedProgress[fileName];

                    updatedProgress[fileName] = {
                        page: safePage,
                        scrollTop: !isNaN(scrollTop) ? scrollTop : lastProgress?.scrollTop || 0,
                        renderScale:
                            state.renderScale && !isNaN(state.renderScale)
                                ? state.renderScale
                                : lastProgress?.renderScale || 1.5,
                        visualScale:
                            state.visualScale && !isNaN(state.visualScale)
                                ? state.visualScale
                                : lastProgress?.visualScale || 1.2,
                        fitMode: state.fitMode || lastProgress?.fitMode || 'relative',
                        fitRatio:
                            state.fitRatio && !isNaN(state.fitRatio)
                                ? state.fitRatio
                                : lastProgress?.fitRatio || 0.9,
                        jumpHistory: state.jumpHistory,
                        historyIndex: state.historyIndex,
                        sidebarOpen: state.sidebarOpen,
                    };
                    return {
                        currentPage: safePage,
                        fileProgress: updatedProgress,
                    };
                }),
        }),
        {
            name: 'suzume-storage',
            storage: createJSONStorage(() => {
                // Return a dummy storage if window is not defined (SSR)
                if (typeof window === 'undefined') {
                    return {
                        getItem: () => null,
                        setItem: () => {},
                        removeItem: () => {},
                    };
                }
                return window.localStorage;
            }),
            partialize: (state) => ({
                recentFileNames: state.recentFileNames,
                theme: state.theme,
                sidebarOpen: state.sidebarOpen,
                fitMode: state.fitMode,
                fitRatio: state.fitRatio,
                renderScale: state.renderScale,
                visualScale: state.visualScale,
                rotation: state.rotation,
                jumpHistory: state.jumpHistory,
                historyIndex: state.historyIndex,
                currentPage: state.currentPage,
                fileProgress: state.fileProgress,
            }),
            skipHydration: true, // Crucial for Next.js to avoid hydration errors & SSR storage access
        }
    )
);
