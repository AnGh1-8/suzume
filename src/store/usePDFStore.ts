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
    jumpHistory: number[];
    historyIndex: number;
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
    addToHistory: (page: number) => void;
    goBackInHistory: () => number | null;
    goForwardInHistory: () => number | null;

    // Recent Files & Finder
    addToRecentFiles: (file: File) => void;
    toggleFinder: () => void;
    setFinderOpen: (open: boolean) => void;
    hydrateRecentFiles: () => Promise<void>;

    // Actions for zoom (modify visualScale only, no re-render)
    zoomIn: () => void;
    zoomOut: () => void;
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
            recentFiles: [],
            recentFileNames: [],
            finderOpen: false,
            baseWidth: 600,
            baseHeight: 800,
            availableWidth: 1000,
            availableHeight: 800,

            setFile: (file) =>
                set((state) => {
                    if (file && file instanceof File) {
                        // Add to recent files
                        state.addToRecentFiles(file);
                    }
                    return { file, currentPage: 1, jumpHistory: [], historyIndex: -1 };
                }),
            setNumPages: (numPages) => set({ numPages }),
            setCurrentPage: (currentPage) => set({ currentPage }),
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

            addToHistory: (page) =>
                set((state) => {
                    const currentHistory = state.jumpHistory;
                    const currentIndex = state.historyIndex;

                    // If we are navigating in the middle, truncate the "future"
                    // But keep current item if we're moving past it
                    const newHistory = currentHistory.slice(0, currentIndex + 1);

                    // Avoid consecutive duplicates
                    if (newHistory.length > 0 && newHistory[newHistory.length - 1] === page) {
                        // If we are at the end already, just return
                        if (currentIndex === currentHistory.length - 1) return state;
                        // Otherwise move index to the match
                        return { historyIndex: newHistory.length - 1 };
                    }

                    const updatedHistory = [...newHistory, page];
                    if (updatedHistory.length > 50) {
                        updatedHistory.shift();
                    }

                    return {
                        jumpHistory: updatedHistory,
                        historyIndex: updatedHistory.length - 1,
                    };
                }),

            goBackInHistory: () => {
                let page: number | null = null;
                set((state) => {
                    if (state.historyIndex > 0) {
                        const newIndex = state.historyIndex - 1;
                        page = state.jumpHistory[newIndex];
                        return { historyIndex: newIndex };
                    }
                    return state;
                });
                return page;
            },

            goForwardInHistory: () => {
                let page: number | null = null;
                set((state) => {
                    if (state.historyIndex < state.jumpHistory.length - 1) {
                        const newIndex = state.historyIndex + 1;
                        page = state.jumpHistory[newIndex];
                        return { historyIndex: newIndex };
                    }
                    return state;
                });
                return page;
            },

            addToRecentFiles: (file) => {
                saveFileToIdb(file); // Fire and forget save to IDB

                set((state) => {
                    const currentFiles = state.recentFiles;
                    const filteredFiles = currentFiles.filter((f) => f.name !== file.name);
                    const updatedFiles = [file, ...filteredFiles].slice(0, 10);

                    const currentNames = state.recentFileNames;
                    const filteredNames = currentNames.filter((n) => n !== file.name);
                    const updatedNames = [file.name, ...filteredNames].slice(0, 10);

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
                fitMode: state.fitMode,
                fitRatio: state.fitRatio,
            }),
            skipHydration: true, // Crucial for Next.js to avoid hydration errors & SSR storage access
        }
    )
);
