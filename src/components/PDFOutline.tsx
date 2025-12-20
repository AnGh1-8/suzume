'use client';

import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { usePDFStore } from '@/store/usePDFStore';

export interface FlatOutlineItem {
    title: string;
    dest?: any;
    depth: number;
    path: string; // "0", "0-1", etc.
    hasChildren: boolean;
    expanded: boolean;
}

interface PDFOutlineProps {
    items: FlatOutlineItem[];
    selectedPath: string | null;
    onItemClick: (item: FlatOutlineItem) => void;
    onToggleExpand: (path: string) => void;
}

export default function PDFOutline({
    items,
    selectedPath,
    onItemClick,
    onToggleExpand,
}: PDFOutlineProps) {
    const { theme } = usePDFStore();

    if (!items || items.length === 0)
        return (
            <div
                className={clsx(
                    'p-4 text-sm',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}
            >
                No outline available
            </div>
        );

    return (
        <div className="flex flex-col pb-4">
            {items.map((item) => (
                <div
                    key={item.path}
                    className={clsx(
                        'flex items-center py-1 px-2 cursor-pointer text-sm transition-colors rounded mx-1',
                        item.path === selectedPath
                            ? theme === 'dark'
                                ? 'bg-[#333] text-white font-medium'
                                : 'bg-blue-50 text-blue-700 font-medium'
                            : theme === 'dark'
                              ? 'text-gray-300 hover:bg-[#333] hover:text-white'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    style={{ paddingLeft: `${item.depth * 12 + 8}px` }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onItemClick(item);
                    }}
                >
                    <span
                        className={clsx(
                            'mr-1 p-0.5 rounded cursor-pointer transition-colors',
                            theme === 'dark' ? 'hover:bg-[#555]' : 'hover:bg-gray-200',
                            !item.hasChildren && 'invisible'
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(item.path);
                        }}
                    >
                        {item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="truncate flex-1">{item.title}</span>
                </div>
            ))}
        </div>
    );
}
