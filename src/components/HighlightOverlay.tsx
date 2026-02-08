'use client';

import { usePDFStore, Highlight } from '@/store/usePDFStore';
import { memo } from 'react';

interface HighlightOverlayProps {
    pageNumber: number;
    scale: number;
}

const HIGHLIGHT_COLORS = {
    yellow: 'rgba(255, 237, 74, 0.4)',
    green: 'rgba(102, 255, 102, 0.4)',
    blue: 'rgba(102, 204, 255, 0.4)',
    pink: 'rgba(255, 153, 204, 0.4)',
    orange: 'rgba(255, 178, 102, 0.4)',
};

const HighlightOverlay = memo(({ pageNumber, scale }: HighlightOverlayProps) => {
    const { getCurrentFileHighlights, visualMode, theme } = usePDFStore();
    const highlights = getCurrentFileHighlights().filter((h) => h.page === pageNumber);

    if (highlights.length === 0 && !visualMode) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: visualMode ? 'auto' : 'none',
                zIndex: 1,
            }}
        >
            {highlights.map((highlight) => (
                <div key={highlight.id}>
                    {highlight.rects.map((rect, idx) => (
                        <div
                            key={`${highlight.id}-${idx}`}
                            style={{
                                position: 'absolute',
                                left: `${rect.x * scale}px`,
                                top: `${rect.y * scale}px`,
                                width: `${rect.width * scale}px`,
                                height: `${rect.height * scale}px`,
                                backgroundColor:
                                    HIGHLIGHT_COLORS[
                                        highlight.color as keyof typeof HIGHLIGHT_COLORS
                                    ] || HIGHLIGHT_COLORS.yellow,
                                mixBlendMode: theme === 'dark' ? 'screen' : 'multiply',
                                transition: 'opacity 0.2s',
                            }}
                            title={highlight.text}
                        />
                    ))}
                </div>
            ))}
            {visualMode && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        outline: '2px dashed rgba(100, 150, 255, 0.5)',
                        outlineOffset: '-2px',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </div>
    );
});

HighlightOverlay.displayName = 'HighlightOverlay';

export default HighlightOverlay;
