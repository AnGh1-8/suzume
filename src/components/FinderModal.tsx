'use client';

import { FileText, Search, CornerDownLeft } from 'lucide-react';
import { usePDFStore } from '@/store/usePDFStore';
import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import clsx from 'clsx';
import { useKey } from 'react-use';

export default function FinderModal() {
    const { finderOpen, setFinderOpen, recentFiles, setFile, theme } = usePDFStore();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Filter files
    const filteredFiles = useMemo(() => {
        if (!search) return recentFiles;
        return recentFiles.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
    }, [recentFiles, search]);

    // Reset state on open
    useEffect(() => {
        if (finderOpen) {
            setSearch('');
            setSelectedIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [finderOpen]);

    // Focus Trap & Click Outside
    useEffect(() => {
        if (!finderOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setFinderOpen(false);
            }
        };

        const handleFocusLoss = (e: MouseEvent) => {
            if (
                modalRef.current?.contains(e.target as Node) &&
                (e.target as HTMLElement).tagName !== 'INPUT'
            ) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('click', handleFocusLoss);

        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('click', handleFocusLoss);
        };
    }, [finderOpen, setFinderOpen]);

    // Soft Edge Scroll Engine
    useLayoutEffect(() => {
        if (!finderOpen || filteredFiles.length === 0 || !listRef.current) return;

        const container = listRef.current;
        const item = document.getElementById(`finder-item-${selectedIndex}`);

        if (item) {
            const containerRect = container.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const padding = 60;

            if (itemRect.bottom > containerRect.bottom - padding) {
                const newScroll =
                    container.scrollTop + (itemRect.bottom - (containerRect.bottom - padding));
                container.scrollTop = newScroll;
            } else if (itemRect.top < containerRect.top + padding) {
                const newScroll =
                    container.scrollTop - (containerRect.top + padding - itemRect.top);
                container.scrollTop = newScroll;
            }
        }
    }, [selectedIndex, finderOpen, filteredFiles.length]);

    // Navigation Logic
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Guard against empty filtered files to prevent division by zero
        if (filteredFiles.length === 0 && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setFinderOpen(false);
            return;
        }

        const isDown = e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j');
        const isUp = e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k');
        const isEnter = e.key === 'Enter';

        if (isDown) {
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % filteredFiles.length);
        } else if (isUp) {
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length);
        } else if (isEnter) {
            e.preventDefault();
            const file = filteredFiles[selectedIndex];
            if (file) {
                setFile(file);
                setFinderOpen(false);
            }
        }
    };

    if (!finderOpen) return null;

    const isDark = theme === 'dark';

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh]">
            {/* Soft Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
                onClick={() => setFinderOpen(false)}
            />

            {/* Modal Container */}
            <div
                ref={modalRef}
                className={clsx(
                    'relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col mx-4',
                    isDark
                        ? 'bg-[#27272a] text-gray-100 ring-1 ring-white/10' // Zinc-800
                        : 'bg-white text-gray-900 ring-1 ring-black/5'
                )}
                onKeyDown={handleKeyDown}
            >
                {/* Search Header */}
                <div
                    className={clsx(
                        'flex items-center px-4 py-4 border-b',
                        isDark ? 'border-white/5' : 'border-gray-100'
                    )}
                >
                    <Search
                        className={clsx('w-5 h-5 mr-3', isDark ? 'text-gray-400' : 'text-gray-400')}
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setSelectedIndex(0);
                        }}
                        placeholder="Search files..."
                        className={clsx(
                            'flex-1 bg-transparent border-none outline-none text-base font-medium',
                            isDark
                                ? 'text-white placeholder:text-gray-500'
                                : 'text-gray-900 placeholder:text-gray-400'
                        )}
                        autoFocus
                    />
                    <kbd
                        className={clsx(
                            'hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium opacity-60',
                            isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'
                        )}
                    >
                        <span className="text-xs">ESC</span>
                    </kbd>
                </div>

                {/* File List */}
                <div
                    ref={listRef}
                    className="max-h-[400px] overflow-y-auto px-2 pt-2 pb-4" // Added pb-4 for bottom breathing room
                >
                    {filteredFiles.length === 0 ? (
                        <div className="py-12 text-center opacity-50 text-sm">No files found</div>
                    ) : (
                        <div className="space-y-1">
                            {filteredFiles.map((file, idx) => {
                                const isSelected = idx === selectedIndex;
                                return (
                                    <div
                                        key={`${file.name}-${idx}`}
                                        id={`finder-item-${idx}`}
                                        className={clsx(
                                            'px-3 py-3 rounded-lg cursor-pointer flex items-center gap-3 transition-all duration-75', // Increased py-3
                                            isSelected
                                                ? isDark
                                                    ? 'bg-white/10'
                                                    : 'bg-gray-100'
                                                : 'hover:bg-transparent'
                                        )}
                                        onClick={() => {
                                            setFile(file);
                                            setFinderOpen(false);
                                        }}
                                        onMouseMove={() => setSelectedIndex(idx)}
                                    >
                                        <div
                                            className={clsx(
                                                'p-1.5 rounded transition-colors',
                                                isSelected
                                                    ? isDark
                                                        ? 'bg-white/10 text-white'
                                                        : 'bg-white text-blue-600 shadow-sm'
                                                    : isDark
                                                      ? 'bg-white/5 text-gray-500'
                                                      : 'bg-gray-50 text-gray-400'
                                            )}
                                        >
                                            <FileText className="w-4 h-4" />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <span
                                                className={clsx(
                                                    'text-sm font-medium truncate leading-normal', // Added leading-normal
                                                    isSelected
                                                        ? isDark
                                                            ? 'text-white'
                                                            : 'text-gray-900'
                                                        : isDark
                                                          ? 'text-gray-400'
                                                          : 'text-gray-600'
                                                )}
                                            >
                                                {file.name}
                                            </span>
                                        </div>

                                        {isSelected && (
                                            <CornerDownLeft
                                                className={clsx(
                                                    'w-4 h-4 opacity-50',
                                                    isDark ? 'text-white' : 'text-gray-400'
                                                )}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
