import React, { useState } from 'react';
import { FlashNews } from '../types/news';
import { ChevronRight, Pause, Play } from 'lucide-react';

interface BreakingTickerProps {
  news: FlashNews[];
  onSelectNews: (reportId?: string) => void;
}

export const BreakingTicker: React.FC<BreakingTickerProps> = ({
  news,
  onSelectNews,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  React.useEffect(() => {
    if (isPaused || news.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % news.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, news.length]);

  if (news.length === 0) return null;
  const currentItem = news[currentIndex];

  return (
    <div className="w-full bg-black border-b border-white/5 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Ticker label: ultra minimal */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-medium tracking-wider text-black bg-white px-2 py-0.5 text-xs uppercase">
            ÚLTIMA HORA
          </span>
          <span className="font-mono text-neutral-500 text-xs hidden md:inline">
            {currentItem.time}
          </span>
        </div>

        {/* Dynamic news text */}
        <div
          className="flex-1 overflow-hidden cursor-pointer group flex items-center"
          onClick={() => onSelectNews(currentItem.reportId)}
        >
          <div className="truncate text-neutral-300 group-hover:text-white transition-colors flex items-center gap-2">
            <span className="text-neutral-500 text-xs font-mono tracking-wide hidden sm:inline">
              [{currentItem.category}]
            </span>
            <span className="truncate font-normal">{currentItem.title}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white hidden sm:inline" />
          </div>
        </div>

        {/* Controls & indicator */}
        <div className="flex items-center gap-3 shrink-0 text-neutral-500 font-mono text-xs">
          <span className="hidden sm:inline">
            {currentIndex + 1}/{news.length}
          </span>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 hover:text-white transition-colors cursor-pointer"
            title={isPaused ? 'Reanudar teletipo' : 'Pausar teletipo'}
            aria-label="Pausa teletipo"
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3 text-neutral-400" />}
          </button>
        </div>
      </div>
    </div>
  );
};
