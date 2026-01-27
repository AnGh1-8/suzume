'use client';

import { X, Keyboard, Command, MousePointer2, Move, Layout } from 'lucide-react';
import { usePDFStore } from '@/store/usePDFStore';
import clsx from 'clsx';

export default function HelpModal() {
    const { helpOpen, toggleHelp, theme } = usePDFStore();

    if (!helpOpen) return null;

    const sections = [
        {
            title: 'Navigation',
            icon: <Move size={16} />,
            items: [
                { key: 'j / k', desc: 'Line Down / Up' },
                { key: 'd / u', desc: 'Fast Scroll' },
                { key: 'h / l', desc: 'Page Prev / Next' },
                { key: 'gg / G', desc: 'Start / End' },
                { key: 'ctrl + o / i', desc: 'Jump Back / Forward' },
                { key: 'zz / zt / zb', desc: 'Center / Top / Bottom' },
                { key: ':[num]', desc: 'Jump to Page (e.g. :10)' },
            ],
        },
        {
            title: 'Visual & Highlights',
            icon: <Keyboard size={16} />,
            items: [
                { key: 'v', desc: 'Enter Visual Mode' },
                { key: ':hl yellow', desc: 'Highlight (yellow)' },
                { key: ':hl green', desc: 'Highlight (green)' },
                { key: ':hl blue', desc: 'Highlight (blue)' },
                { key: ':hl pink', desc: 'Highlight (pink)' },
                { key: ':hl orange', desc: 'Highlight (orange)' },
                { key: ':nohl', desc: 'Clear All Highlights' },
            ],
        },
        {
            title: 'Display & Modes',
            icon: <Layout size={16} />,
            items: [
                { key: 'a', desc: 'Toggle Absolute / Relative' },
                { key: ':a [num]', desc: 'Absolute Zoom (e.g. :a 150)' },
                { key: ':r [num]', desc: 'Relative Width (e.g. :r 90)' },
                { key: ':fw', desc: 'Fit Width (100% Relative)' },
                { key: ':fp', desc: 'Fit Page (Scaled Absolute)' },
                { key: '+ / -', desc: 'Zoom (In / Out)' },
                { key: ':fs', desc: 'Fullscreen Toggle' },
            ],
        },
        {
            title: 'Outline / Catalog',
            icon: <MousePointer2 size={16} />,
            items: [
                { key: 'j / k', desc: 'Navigate Item' },
                { key: 'Enter', desc: 'Select & Jump' },
                { key: 'l / h', desc: 'Expand / Collapse' },
                { key: 'Esc', desc: 'Return Focus to PDF' },
            ],
        },
        {
            title: 'App & Shortcuts',
            icon: <Command size={16} />,
            items: [
                { key: 'o', desc: 'Open File' },
                { key: 'r', desc: 'Recent Files (Finder)' },
                { key: 't', desc: 'Toggle Sidebar' },
                { key: 'Esc', desc: 'Focus Outline (from PDF)' },
                { key: ':dark / :light', desc: 'Switch Theme' },
                { key: '?', desc: 'Toggle Help' },
            ],
        },
    ];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200"
            onClick={toggleHelp}
        >
            <div
                className={clsx(
                    'border w-[800px] max-w-[95vw] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors',
                    theme === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className={clsx(
                        'flex items-center justify-between p-5 border-b',
                        theme === 'dark' ? 'border-[#333] bg-[#222]' : 'border-gray-100 bg-gray-50'
                    )}
                >
                    <div
                        className={clsx(
                            'flex items-center space-x-3',
                            theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                        )}
                    >
                        <div
                            className={clsx(
                                'p-2 rounded-lg',
                                theme === 'dark'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-blue-50 text-blue-600'
                            )}
                        >
                            <Keyboard size={24} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg tracking-wide">
                                Keyboard Shortcuts
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Vim-style navigation for efficiency
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleHelp}
                        className={clsx(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark'
                                ? 'hover:bg-[#333] text-gray-400 hover:text-white'
                                : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
                        )}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        {sections.map((section) => (
                            <div key={section.title} className="space-y-4">
                                <div
                                    className={clsx(
                                        'flex items-center space-x-2 border-b pb-2',
                                        theme === 'dark'
                                            ? 'text-blue-400 border-[#333]'
                                            : 'text-blue-600 border-gray-100'
                                    )}
                                >
                                    {section.icon}
                                    <h3 className="text-xs font-bold uppercase tracking-wider">
                                        {section.title}
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {section.items.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between text-sm group"
                                        >
                                            <span
                                                className={clsx(
                                                    'transition-colors',
                                                    theme === 'dark'
                                                        ? 'text-gray-400 group-hover:text-gray-200'
                                                        : 'text-gray-500 group-hover:text-gray-900'
                                                )}
                                            >
                                                {item.desc}
                                            </span>
                                            <kbd
                                                className={clsx(
                                                    'px-2 py-1 rounded text-xs font-mono min-w-[24px] text-center border shadow-sm whitespace-nowrap transition-colors',
                                                    theme === 'dark'
                                                        ? 'bg-[#2a2a2a] text-gray-300 border-[#333] group-hover:border-gray-500'
                                                        : 'bg-gray-50 text-gray-600 border-gray-200 group-hover:border-gray-400'
                                                )}
                                            >
                                                {item.key}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div
                    className={clsx(
                        'p-4 border-t text-center',
                        theme === 'dark' ? 'bg-[#222] border-[#333]' : 'bg-gray-50 border-gray-200'
                    )}
                >
                    <p className="text-xs text-gray-500">
                        Top Tip: Type{' '}
                        <span
                            className={clsx(
                                'font-mono',
                                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            )}
                        >
                            :r 80
                        </span>{' '}
                        to set relative width to 80%, or{' '}
                        <span
                            className={clsx(
                                'font-mono',
                                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            )}
                        >
                            :a 150
                        </span>{' '}
                        for 150% absolute zoom.
                    </p>
                </div>
            </div>
        </div>
    );
}
