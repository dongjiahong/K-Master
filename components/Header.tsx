import React from 'react';
import { 
  Play, Pause, ChevronRight, TrendingUp, TrendingDown, 
  Settings, History, Zap, Trophy, Calendar, Menu
} from 'lucide-react';
import { GameSession, Trade } from '../types';

interface HeaderProps {
  session: GameSession | null;
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  isReviewingHistory: boolean;
  nextCandle: () => void;
  currentDisplayIndex: number;
  totalCandles: number;
  autoPlaySpeed: number;
  setAutoPlaySpeed: (val: number) => void;
  activeTrade: Trade | null;
  handleOpenTradeModal: (dir: 'LONG' | 'SHORT') => void;
  loadHistoryAndShowPanel: () => void;
  setSidebarView: (view: any) => void;
  isMobile: boolean;
  onToggleSidebar: () => void; // For mobile
}

const Header: React.FC<HeaderProps> = ({
  session, isPlaying, setIsPlaying, isReviewingHistory, nextCandle,
  currentDisplayIndex, totalCandles, autoPlaySpeed, setAutoPlaySpeed,
  activeTrade, handleOpenTradeModal, loadHistoryAndShowPanel, setSidebarView,
  isMobile, onToggleSidebar
}) => {
  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-950 shrink-0 gap-4 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent hidden md:block whitespace-nowrap">
              K-Line Master
          </h1>
          {isMobile && (
            <button onClick={onToggleSidebar} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
               <Menu size={20} />
            </button>
          )}
          {session && (
              <div className="flex gap-4 items-center">
                  <div className="flex gap-2 text-xs font-mono overflow-hidden items-center">
                      <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 font-bold transition-colors">
                        {session.symbol.replace('USDT', '')}
                      </span>
                      {session.parentSessionId && (
                          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/30 font-bold hidden sm:inline-block">
                              Replay
                          </span>
                      )}
                  </div>
              </div>
          )}
      </div>

      <div className="flex items-center gap-2">
           <button 
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={session?.status === 'COMPLETED' || isReviewingHistory}
              className={`p-2 rounded-lg transition-colors ${
                  isPlaying 
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50'
              }`}
          >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button 
              onClick={nextCandle} 
              disabled={session?.status === 'COMPLETED' || isReviewingHistory} 
              className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg disabled:opacity-50 transition-colors"
          >
              <ChevronRight size={18} />
          </button>
          
          {session && !isMobile && (
               <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 pl-3 ml-1 h-8 justify-center">
                   <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-mono leading-none">
                       <Calendar size={12} />
                       <span>{currentDisplayIndex + 1} / {totalCandles}</span>
                   </div>
               </div>
          )}

          <div className="flex items-center gap-2 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hidden lg:flex transition-colors">
              <Zap size={14} className="text-yellow-500" />
              <input 
                  type="range" min="100" max="2000" step="100"
                  value={autoPlaySpeed}
                  onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
                  className="w-16 accent-yellow-500 h-1 bg-gray-200 dark:bg-gray-700"
              />
          </div>
      </div>

      <div className="flex items-center gap-3">
           <div className="flex gap-2">
              <button 
                  onClick={() => handleOpenTradeModal('LONG')}
                  disabled={!!activeTrade || session?.status === 'COMPLETED' || isReviewingHistory}
                  className="flex items-center gap-1 px-3 py-1.5 bg-trade-profit hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded text-xs sm:text-sm transition-all shadow-[0_0_10px_rgba(46,189,133,0.3)]"
              >
                  <TrendingUp size={16} /> <span className="hidden sm:inline">Long</span>
              </button>
              <button 
                  onClick={() => handleOpenTradeModal('SHORT')}
                  disabled={!!activeTrade || session?.status === 'COMPLETED' || isReviewingHistory}
                  className="flex items-center gap-1 px-3 py-1.5 bg-trade-loss hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded text-xs sm:text-sm transition-all shadow-[0_0_10px_rgba(246,70,93,0.3)]"
              >
                  <TrendingDown size={16} /> <span className="hidden sm:inline">Short</span>
              </button>
           </div>
          
          {!isMobile && (
            <>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>
              <button 
                  onClick={loadHistoryAndShowPanel} 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-2" 
                  title="Career History"
              >
                  <Trophy size={18} />
                  <span className="hidden lg:inline text-xs font-bold">Career</span>
              </button>

              <button onClick={() => setSidebarView('SETTINGS')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative text-gray-500 dark:text-gray-400">
                  <Settings size={18} />
              </button>
            </>
          )}
      </div>
    </header>
  );
};

export default Header;