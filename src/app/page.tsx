'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePDFStore } from '@/store/usePDFStore';
import clsx from 'clsx';
import { FileUp, Command, Keyboard, HelpCircle } from 'lucide-react';

const PDFReader = dynamic(() => import('@/components/PDFReader'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-screen text-gray-500">
            Loading PDF engine...
        </div>
    ),
});

import GlobalShell from '@/components/GlobalShell';

export default function Home() {
    // Hardcoded PDF for demo purposes initially, or provide a file picker.
    // For now, we'll implement a file picker or just a placeholder if no file.
    // We'll start with a file picker and a drop zone.

    const { file, setFile, theme } = usePDFStore();

    // Set html/body theme
    // Actually GlobalShell doesn't handle body bg, so main must handle it.

    return (
        <GlobalShell>
            <main
                className={clsx(
                    'min-h-screen overflow-hidden transition-colors duration-300',
                    theme === 'dark' ? 'bg-[#111] text-white' : 'bg-[#f3f4f6] text-gray-800'
                )}
            >
                {!file ? (
                    <div className="flex flex-col items-center justify-center h-screen space-y-8 p-6">
                        {/* Hero Section */}
                        <div className="text-center space-y-2">
                            <h1
                                className={clsx(
                                    'text-6xl font-light tracking-tight',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}
                            >
                                Suzume
                                <span
                                    className={clsx(
                                        'font-bold',
                                        theme === 'dark' ? 'text-blue-500' : 'text-blue-600'
                                    )}
                                >
                                    Reader
                                </span>
                            </h1>
                            <p
                                className={clsx(
                                    'text-lg font-light',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}
                            >
                                Minimalist. Keyboard-driven. Fast.
                            </p>
                        </div>

                        {/* Drop Zone / Open Button */}
                        <div
                            onClick={() =>
                                document
                                    .querySelector('input[type="file"]')
                                    ?.dispatchEvent(new MouseEvent('click'))
                            }
                            className={clsx(
                                'group cursor-pointer flex flex-col items-center justify-center w-full max-w-md h-64 border-2 border-dashed rounded-3xl transition-all duration-300',
                                theme === 'dark'
                                    ? 'border-[#333] bg-[#1a1a1a] hover:bg-[#222] hover:border-blue-500/50'
                                    : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg hover:-translate-y-1'
                            )}
                        >
                            <div
                                className={clsx(
                                    'p-6 rounded-2xl mb-4 transition-transform group-hover:scale-110 duration-300',
                                    theme === 'dark'
                                        ? 'bg-blue-500/10 text-blue-400'
                                        : 'bg-blue-50 text-blue-600'
                                )}
                            >
                                <FileUp size={48} strokeWidth={1.5} />
                            </div>
                            <p
                                className={clsx(
                                    'text-lg font-medium',
                                    theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                                )}
                            >
                                Open PDF File
                            </p>
                            <p
                                className={clsx(
                                    'text-sm mt-2',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                )}
                            >
                                or drag and drop here
                            </p>
                        </div>

                        {/* Shortcuts / Footer */}
                        <div className="flex gap-8 text-xs mt-8 opacity-60 hover:opacity-100 transition-opacity duration-300">
                            <div
                                className={clsx(
                                    'flex items-center gap-2',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}
                            >
                                <Keyboard size={14} />
                                <span>
                                    Press{' '}
                                    <kbd
                                        className={clsx(
                                            'px-1.5 py-0.5 rounded border font-mono mx-1',
                                            theme === 'dark'
                                                ? 'bg-[#222] border-[#333] text-gray-300'
                                                : 'bg-white border-gray-200 text-gray-600 shadow-sm'
                                        )}
                                    >
                                        o
                                    </kbd>{' '}
                                    to open
                                </span>
                            </div>
                            <div
                                className={clsx(
                                    'flex items-center gap-2',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}
                            >
                                <Command size={14} />
                                <span>
                                    Press{' '}
                                    <kbd
                                        className={clsx(
                                            'px-1.5 py-0.5 rounded border font-mono mx-1',
                                            theme === 'dark'
                                                ? 'bg-[#222] border-[#333] text-gray-300'
                                                : 'bg-white border-gray-200 text-gray-600 shadow-sm'
                                        )}
                                    >
                                        :
                                    </kbd>{' '}
                                    to command
                                </span>
                            </div>
                            <div
                                className={clsx(
                                    'flex items-center gap-2',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}
                            >
                                <HelpCircle size={14} />
                                <span>
                                    Press{' '}
                                    <kbd
                                        className={clsx(
                                            'px-1.5 py-0.5 rounded border font-mono mx-1',
                                            theme === 'dark'
                                                ? 'bg-[#222] border-[#333] text-gray-300'
                                                : 'bg-white border-gray-200 text-gray-600 shadow-sm'
                                        )}
                                    >
                                        ?
                                    </kbd>{' '}
                                    for help
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <PDFReader file={file!} />
                )}
            </main>
        </GlobalShell>
    );
}
