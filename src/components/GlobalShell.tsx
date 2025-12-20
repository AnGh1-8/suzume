'use client';

import { useKey } from 'react-use';
import { usePDFStore } from '@/store/usePDFStore';
import HelpModal from './HelpModal';
import VimInput from './VimInput';
import { useRef } from 'react';

export default function GlobalShell({ children }: { children: React.ReactNode }) {
    const {
        helpOpen,
        toggleHelp,
        sidebarOpen,
        toggleSidebar,
        focusMode,
        setFocusMode,
        setFile,
        pendingCommand,
    } = usePDFStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFile(file);
        }
    };

    useKey(
        (e) => true,
        (e) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

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
        [helpOpen, focusMode, sidebarOpen, pendingCommand]
    );

    return (
        <div className="relative w-full h-full">
            {children}
            <HelpModal />
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
