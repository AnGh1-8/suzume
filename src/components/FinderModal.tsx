'use client';

import { File as FileIcon, Search, Clock, X } from 'lucide-react';
import { usePDFStore } from '@/store/usePDFStore';
import { useState, useMemo, useEffect, useRef } from 'react';
import clsx from 'clsx';

export default function FinderModal() {
    const { finderOpen, setFinderOpen, recentFiles, setFile, theme } = usePDFStore();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredFiles = useMemo(() => {
        if (!search) return recentFiles;
        return recentFiles.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
    }, [recentFiles, search]);

    useEffect(() => {
        if (finderOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [finderOpen]);

    useEffect(() => {
        if (selectedIndex >= filteredFiles.length) {
            setSelectedIndex(Math.max(0, filteredFiles.length - 1));
        }
    }, [filteredFiles.length, selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setFinderOpen(false);
        } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
            e.preventDefault();
            setSelectedIndex((i) => (i + 1) % filteredFiles.length);
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
            e.preventDefault();
            setSelectedIndex((i) => (i - 1 + filteredFiles.length) % filteredFiles.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const file = filteredFiles[selectedIndex];
            if (file) {
                setFile(file);
                setFinderOpen(false);
            }
        }
    };

    if (!finderOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setFinderOpen(false)}
        >
            <div
                className={clsx(
                    'w-full max-w-2xl border rounded-xl shadow-2xl overflow-hidden flex flex-col transition-colors mx-4',
                    theme === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search Header */}
                <div
                    className={clsx(
                        'flex items-center px-4 py-3 border-b',
                        theme === 'dark' ? 'border-[#333]' : 'border-gray-100'
                    )}
                >
                    <Search
                        size={18}
                        className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search recent files..."
                        className={clsx(
                            'flex-1 bg-transparent border-none outline-none px-3 py-1 text-sm',
                            theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                        )}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                            Recent
                        </span>
                        <button
                            onClick={() => setFinderOpen(false)}
                            className={clsx(
                                'p-1 rounded hover:bg-opacity-10 transition-colors',
                                theme === 'dark'
                                    ? 'hover:bg-white text-gray-500'
                                    : 'hover:bg-black text-gray-400'
                            )}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* File List */}
                <div className="max-h-[400px] overflow-y-auto p-2">
                    {filteredFiles.length === 0 ? (
                        <div className="py-12 text-center">
                            <Clock size={24} className="mx-auto text-gray-500 mb-2 opacity-20" />
                            <p className="text-sm text-gray-500">No recent files found</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredFiles.map((file, idx) => (
                                <div
                                    key={file.name + idx}
                                    className={clsx(
                                        'flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all gap-3 group',
                                        idx === selectedIndex
                                            ? theme === 'dark'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : theme === 'dark'
                                              ? 'hover:bg-[#252525] text-gray-400'
                                              : 'hover:bg-gray-100 text-gray-600'
                                    )}
                                    onClick={() => {
                                        setFile(file);
                                        setFinderOpen(false);
                                    }}
                                    onMouseMove={() => setSelectedIndex(idx)}
                                >
                                    <div
                                        className={clsx(
                                            'p-1.5 rounded-md transition-colors',
                                            idx === selectedIndex
                                                ? 'bg-white/20'
                                                : theme === 'dark'
                                                  ? 'bg-[#2a2a2a] group-hover:bg-[#333]'
                                                  : 'bg-gray-100 group-hover:bg-gray-200'
                                        )}
                                    >
                                        <FileIcon
                                            size={16}
                                            className={
                                                idx === selectedIndex
                                                    ? 'text-white'
                                                    : 'text-blue-500'
                                            }
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                            {file.name}
                                        </div>
                                        <div
                                            className={clsx(
                                                'text-[10px] truncate opacity-60',
                                                idx === selectedIndex ? 'text-white' : ''
                                            )}
                                        >
                                            {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                                        </div>
                                    </div>
                                    {idx === selectedIndex && (
                                        <div className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-white/80">
                                            OPEN
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div
                    className={clsx(
                        'px-4 py-2 border-t flex justify-between items-center',
                        theme === 'dark'
                            ? 'bg-[#222] border-[#333] text-gray-500'
                            : 'bg-gray-50 border-gray-100 text-gray-400'
                    )}
                >
                    <div className="flex space-x-3 text-[10px] font-medium uppercase tracking-tighter">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 border rounded border-gray-600">⏎</kbd> select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 border rounded border-gray-600">↑↓</kbd> /{' '}
                            <kbd className="px-1 border rounded border-gray-600">^j/k</kbd> navigate
                        </span>
                    </div>
                    <span className="text-[10px] font-mono leading-none">
                        {filteredFiles.length} RESULTS
                    </span>
                </div>
            </div>
        </div>
    );
}
