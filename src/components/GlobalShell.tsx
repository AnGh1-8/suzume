'use client';

import { useKey } from 'react-use';
import { usePDFStore } from '@/store/usePDFStore';
import HelpModal from './HelpModal';
import FinderModal from './FinderModal';
import VimInput from './VimInput';
import { useRef, useEffect } from 'react';

export default function GlobalShell({ children }: { children: React.ReactNode }) {
    const {
        helpOpen,
        toggleHelp,
        sidebarOpen,
        focusMode,
        setFocusMode,
        setFile,
        pendingCommand,
        finderOpen,
        toggleFinder,
    } = usePDFStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Hydration - runs only once on mount
    useEffect(() => {
        const init = async () => {
            // Rehydrate the persisted names/settings from localStorage
            await usePDFStore.persist.rehydrate();
            // Then load the actual file blobs from IndexedDB
            await usePDFStore.getState().hydrateRecentFiles();
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFile(file);
        }
    };

    useKey(
        () => true,
        (e) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // Open Finder (Strict 'r' without modifiers)
            if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                toggleFinder();
                return;
            }

            // If finder is open, let it handle its own keys
            if (finderOpen) return;

            // Open File
            if (e.key === 'o') {
                e.preventDefault();
                fileInputRef.current?.click();
                return;
            }

            // Help
            if (e.key === '?') {
                toggleHelp();
                return;
            }

            // Esc Handling
            if (e.key === 'Escape') {
                if (helpOpen) {
                    toggleHelp();
                    return;
                }

                // Do not toggle focus if a Vim command is pending (handled by PDFReader)
                if (pendingCommand) {
                    return;
                }

                // Toggle Focus between PDF and Outline if Sidebar is open
                if (sidebarOpen) {
                    if (focusMode === 'outline') {
                        setFocusMode('pdf');
                    } else {
                        setFocusMode('outline');
                    }
                }
            }
        },
        { event: 'keydown' },
        [helpOpen, focusMode, sidebarOpen, pendingCommand, finderOpen, toggleFinder]
    );

    return (
        <div className="relative w-full h-full">
            {children}
            <HelpModal />
            <FinderModal />
            <VimInput />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleOpenFile}
                className="hidden"
                accept=".pdf"
            />
        </div>
    );
}
