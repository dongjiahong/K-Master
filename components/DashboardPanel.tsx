import React, { useState, useEffect } from 'react';
import { History, BarChart2, Brain, Sparkles, StopCircle, RefreshCw, RotateCcw, Loader2 } from 'lucide-react';
import { GameSession, Trade } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface DashboardPanelProps {
    balance: number;
    initialBalance: number;
    session: GameSession | null;
    comparisonStats: any[];
    loading: boolean;
    isGeneratingReport?: boolean;
    finalReport: string | null;
    currentTrades: Trade[];
    onReviewTrade: (trade: Trade) => void;
    onEndGame: () => void;
    onStartNewGame: () => void;
    onLoadSession: (sessionId: number) => void;
    isReviewingHistory: boolean;
    viewingTradeId?: string;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
    balance, initialBalance, session, comparisonStats, loading, isGeneratingReport, finalReport,
    currentTrades, onReviewTrade, onEndGame, onStartNewGame, onLoadSession, 
    isReviewingHistory, viewingTradeId
}) => {
    
    // AI Animation State
    const [aiStep, setAiStep] = useState(0);
    const aiSteps = [
        "Analyzing Trade Entries...",
        "Evaluating PnL Efficiency...",
        "Checking Market Structure...",
        "Compiling Strategy Report...",
        "Finalizing Verdict..."
    ];

    useEffect(() => {
        if (isGeneratingReport) {
            setAiStep(0);
            const interval = setInterval(() => {
                setAiStep(prev => (prev + 1) % aiSteps.length);
            }, 1200);
            return () => clearInterval(interval);
        }
    }, [isGeneratingReport]);

    // Render AI Overlay if Generating Report
    if (isGeneratingReport) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-6 animate-in fade-in duration-500 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative mb-8">
                        {/* Outer Spinner */}
                        <div className="w-24 h-24 rounded-full border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-500 animate-spin"></div>
                        
                        {/* Inner Icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Brain size={40} className="text-indigo-600 dark:text-indigo-400 animate-bounce" />
                        </div>
                    </div>

                    <h3 className="text-xl font-black bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent mb-2">
                        AI Coach Processing
                    </h3>
                    
                    <div className="h-6 overflow-hidden relative w-full flex justify-center">
                        <p className="text-sm font-mono text-gray-500 dark:text-gray-400 animate-pulse key={aiStep}">
                            {aiSteps[aiStep]}
                        </p>
                    </div>

                    <div className="mt-8 flex gap-2">
                         {[0,1,2].map(i => (
                             <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                         ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 bg-gray-50 dark:bg-gray-900 relative">
             {/* Header */}
             <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
                <div className="flex flex-col">
                    <h2 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 text-sm">
                        <History size={16} /> 本局看板
                    </h2>
                </div>
                
                <div className="flex items-center gap-3">
                     <div className="flex flex-col items-end leading-none">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Equity</span>
                        <span className={`font-mono font-bold text-sm ${balance >= initialBalance ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${balance.toFixed(0)}
                        </span>
                    </div>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                 
                 {/* 1. AI Final Report */}
                 {finalReport ? (
                     <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm animate-in slide-in-from-top-2">
                         <h3 className="font-bold text-indigo-700 dark:text-indigo-400 text-sm mb-3 flex items-center gap-2">
                             <Sparkles size={16} /> 🎓 AI 教练终局报告
                         </h3>
                         <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-lg">
                            <MarkdownRenderer content={finalReport} />
                         </div>
                     </div>
                 ) : null}

                 {/* 2. Comparison Stats (Current vs History) */}
                 {comparisonStats.length > 0 && (
                     <div className="bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                         <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-1">
                             <BarChart2 size={12}/> 历史战绩对比 (点击加载)
                         </h3>
                         <div className="space-y-2">
                             {comparisonStats.map((s) => {
                                 const maxPnl = Math.max(...comparisonStats.map(c => Math.abs(c.pnl)), 100);
                                 const barWidth = Math.min(100, (Math.abs(s.pnl) / maxPnl) * 100);
                                 
                                 return (
                                     <div 
                                        key={s.id} 
                                        onClick={() => !s.isCurrent && onLoadSession(s.id)}
                                        className={`group relative flex items-center gap-2 text-xs rounded p-1.5 transition-all border ${
                                            s.isCurrent 
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                                            : 'bg-gray-50 dark:bg-gray-900 border-transparent hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer'
                                        }`}
                                     >
                                        <div className="w-24 shrink-0 flex flex-col">
                                            <span className={`font-mono font-bold ${s.isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {new Date(s.date).toLocaleDateString(undefined, {month:'2-digit', day:'2-digit'})}
                                            </span>
                                            {s.isCurrent && <span className="text-[8px] text-blue-500 uppercase tracking-wide">Current</span>}
                                        </div>

                                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex relative">
                                            {/* Center Line */}
                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/30 z-10"></div>
                                            
                                            <div className="w-1/2 flex justify-end">
                                                {s.pnl < 0 && <div style={{ width: `${barWidth}%` }} className="h-full bg-trade-loss rounded-l-full"></div>}
                                            </div>
                                            <div className="w-1/2 flex justify-start">
                                                {s.pnl >= 0 && <div style={{ width: `${barWidth}%` }} className="h-full bg-trade-profit rounded-r-full"></div>}
                                            </div>
                                        </div>

                                        <div className={`w-16 shrink-0 text-right font-mono font-bold ${s.pnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                            ${s.pnl.toFixed(0)}
                                        </div>
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                 )}

                 {/* 3. Trade List */}
                 <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            交易记录 ({currentTrades.length})
                        </h3>
                    </div>
                    
                    {currentTrades.map(trade => (
                        <div 
                            key={trade.id} 
                            onClick={() => onReviewTrade(trade)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all relative group ${
                                trade.status === 'OPEN' 
                                ? 'bg-white dark:bg-gray-800 border-yellow-500/50 shadow-sm' 
                                : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm'
                            } ${viewingTradeId === trade.id && isReviewingHistory ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                        trade.direction === 'LONG' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                    }`}>
                                        {trade.direction}
                                    </span>
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                        {new Date(trade.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                {trade.status !== 'OPEN' && (
                                    <span className={`font-mono text-sm font-bold ${trade.pnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                    </span>
                                )}
                                {trade.status === 'OPEN' && <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> LIVE</span>}
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-gray-400 font-mono">
                                    Open: {trade.entryPrice} {trade.exitPrice ? `→ Close: ${trade.exitPrice}` : ''}
                                </span>
                            </div>

                            {/* Review Indicator */}
                            {isReviewingHistory && viewingTradeId === trade.id && (
                                <div className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center gap-1 bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded w-full">
                                    <RotateCcw size={10} /> 正在回看 (Time Travel)
                                </div>
                            )}
                            
                            {/* Hover Hint */}
                            {!isReviewingHistory && (
                                <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                                    <span className="text-[10px] font-bold bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-gray-700 dark:text-gray-300">点击复盘</span>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {currentTrades.length === 0 && (
                        <div className="text-center text-gray-400 dark:text-gray-600 py-10 text-xs border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                            等待开单...
                        </div>
                    )}
                 </div>
             </div>
             
             {/* Footer Control Buttons */}
             <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-950">
                 {session?.status === 'ACTIVE' ? (
                     <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={onEndGame}
                            className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 py-3"
                        >
                            <StopCircle size={16} /> 结束本局
                        </button>
                        <button 
                            onClick={onStartNewGame}
                            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold transition-colors py-3"
                        >
                            重新开始
                        </button>
                     </div>
                 ) : (
                     <button 
                        onClick={onStartNewGame} 
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                     >
                        <RefreshCw size={16} /> 开启新游戏 (New Game)
                     </button>
                 )}
             </div>
        </div>
    );
};

export default DashboardPanel;