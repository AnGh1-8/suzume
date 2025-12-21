'use client';

import { useRef, useEffect, useState } from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import clsx from 'clsx';

export default function VimInput() {
    const [isVisible, setIsVisible] = useState(false);
    const [mode, setMode] = useState<':' | null>(null);
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        setTheme,
        theme,
        setFitMode,
        setVisualScale,
        setFitRatio,
        setModeAbsolute,
        setModeRelative,
        setCurrentPage,
        addToHistory,
        currentPage,
    } = usePDFStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                if (e.key === 'Escape') {
                    setIsVisible(false);
                    setMode(null);
                    setValue('');
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            if (e.key === ':') {
                e.preventDefault();
                setMode(':');
                setIsVisible(true);
                setTimeout(() => inputRef.current?.focus(), 10);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === ':') {
            const raw = value.trim();
            const parts = raw.split(/\s+/);
            const cmd = parts[0].toLowerCase();
            const arg = parts[1] ? parseInt(parts[1], 10) : null;

            if (cmd === 'light') {
                setTheme('light');
            } else if (cmd === 'dark') {
                setTheme('dark');
            } else if (['fullscreen', 'fs'].includes(cmd)) {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            } else if (cmd === 'a') {
                if (arg && !isNaN(arg)) {
                    setModeAbsolute(arg);
                } else {
                    setModeAbsolute();
                }
            } else if (cmd === 'r') {
                if (arg && !isNaN(arg)) {
                    setModeRelative(arg);
                } else {
                    setModeRelative();
                }
            } else if (['go', 'n'].includes(cmd)) {
                if (arg && !isNaN(arg) && arg > 0) {
                    addToHistory(currentPage);
                    setCurrentPage(arg);
                    addToHistory(arg);
                }
            } else if (!isNaN(parseInt(cmd, 10))) {
                // Handle direct number input (e.g., :42)
                const pageNum = parseInt(cmd, 10);
                if (pageNum > 0) {
                    addToHistory(currentPage);
                    setCurrentPage(pageNum);
                    addToHistory(pageNum);
                }
            }
        }

        setIsVisible(false);
        setMode(null);
        setValue('');
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className={clsx(
                'fixed bottom-0 left-0 right-0 border-t p-1 flex items-center z-50 transition-colors duration-300',
                theme === 'dark'
                    ? 'bg-[#000] border-[#333] text-white'
                    : 'bg-white border-gray-200 text-gray-800 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]'
            )}
        >
            <span
                className={clsx(
                    'font-mono mr-2 pl-2',
                    theme === 'dark' ? 'text-[#aff]' : 'text-purple-600 bg-purple-50 px-1 rounded'
                )}
            >
                {mode}
            </span>
            <form onSubmit={handleSubmit} className="flex-1">
                <input
                    ref={inputRef}
                    type="text"
                    className={clsx(
                        'w-full bg-transparent font-mono outline-none border-none text-sm',
                        theme === 'dark' ? 'text-white' : 'text-gray-800'
                    )}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => {
                        // Optional: close on blur
                        // setIsVisible(false);
                    }}
                    autoFocus
                />
            </form>
        </div>
    );
}
