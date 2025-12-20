import { create } from 'zustand';

interface PDFState {
    file: File | string | null;
    numPages: number | null;
    currentPage: number;
    scale: number;
    rotation: number;
    sidebarOpen: boolean;
    focusMode: 'pdf' | 'outline';
    expandedPaths: Set<string>;
    selectedPath: string | null;
    helpOpen: boolean;
    pendingCommand: null | 'z' | 'g';
    theme: 'light' | 'dark';
    fitMode: 'custom' | 'fit-width' | 'fit-page';
    fitRatio: number; // For fit-width (0.9 default)

    setFile: (file: File | string | null) => void;
    setNumPages: (num: number) => void;
    setCurrentPage: (page: number) => void;
    setScale: (scale: number) => void;
    setRotation: (rotation: number) => void;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void; // Explicit setter

    setFocusMode: (mode: 'pdf' | 'outline') => void;
    toggleOutlineExpand: (path: string) => void;
    setSelectedPath: (path: string | null) => void;
    setPendingCommand: (cmd: null | 'z' | 'g') => void;
    toggleHelp: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
    setFitMode: (mode: 'custom' | 'fit-width' | 'fit-page') => void;
    setFitRatio: (ratio: number) => void;

    // Actions for zoom
    zoomIn: () => void;
    zoomOut: () => void;
}

export const usePDFStore = create<PDFState>((set) => ({
    file: null,
    numPages: null,
    currentPage: 1,
    scale: 1.2,
    rotation: 0,
    sidebarOpen: true,
    focusMode: 'pdf', // 'pdf' | 'outline'

    // Outline State
    expandedPaths: new Set<string>(), // Using string paths "0", "0-1", etc.
    selectedPath: null as string | null,
    helpOpen: false,
    pendingCommand: null,
    theme: 'dark',
    fitMode: 'fit-width',
    fitRatio: 0.9,

    setFile: (file) => set({ file }),
    setNumPages: (numPages) => set({ numPages }),
    setCurrentPage: (currentPage) => set({ currentPage }),
    setScale: (scale) => set({ scale }),
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

    toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),

    zoomIn: () => set((state) => ({ scale: Math.min(state.scale + 0.1, 3), fitMode: 'custom' })),
    zoomOut: () => set((state) => ({ scale: Math.max(state.scale - 0.1, 0.5), fitMode: 'custom' })),
}));
