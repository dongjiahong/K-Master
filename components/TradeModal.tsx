import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, Bot, Target, Hash, Percent } from 'lucide-react';
import { Trade } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import FloatingPanel from './FloatingPanel';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Create Mode Props
  onConfirm?: (reason: string, tp: number, sl: number) => void;
  currentPrice?: number;
  direction?: 'LONG' | 'SHORT';
  balance?: number; 
  // View Mode Props
  viewingTrade?: Trade | null;
  // AI Status
  isLoading?: boolean;
}

const TradeModal: React.FC<TradeModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentPrice = 0, 
  direction = 'LONG',
  balance = 0,
  viewingTrade,
  isLoading = false
}) => {
  const [reason, setReason] = useState('');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');

  // Loading Animation State
  const [loadingMsg, setLoadingMsg] = useState('Initializing AI...');

  useEffect(() => {
    if (!isLoading) return;
    
    const messages = [
      "Analyzing Market Structure...",
      "Scanning Candlestick Patterns...",
      "Identifying Support & Resistance...",
      "Calculating Risk/Reward Ratio...",
      "Evaluating Trend Momentum...",
      "Consulting Trading Strategy...",
      "Drafting Coach Feedback..."
    ];
    
    let i = 0;
    setLoadingMsg(messages[0]);
    
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const isViewMode = !!viewingTrade;
  const activeDirection = isViewMode ? viewingTrade.direction : direction;
  const activePrice = isViewMode ? viewingTrade.entryPrice : currentPrice;

  // Calculate Derived Stats
  const numTp = parseFloat(tp) || activePrice;
  const numSl = parseFloat(sl) || activePrice;
  
  const risk = Math.abs(activePrice - numSl);
  const reward = Math.abs(numTp - activePrice);
  const rrRatio = risk > 0 ? (reward / risk).toFixed(2) : '0.00';
  
  // Position Size (Quantity)
  const quantity = isViewMode 
    ? viewingTrade.quantity 
    : (balance * 0.5) / activePrice;

  useEffect(() => {
    if (isOpen) {
        if (isViewMode && viewingTrade) {
            setReason(viewingTrade.reason);
            setTp(viewingTrade.tp.toString());
            setSl(viewingTrade.sl.toString());
        } else {
            setReason('');
            // Default TP/SL logic
            const dist = currentPrice * 0.01; 
            if (direction === 'LONG') {
                setTp((currentPrice + dist * 2).toFixed(2));
                setSl((currentPrice - dist).toFixed(2));
            } else {
                setTp((currentPrice - dist * 2).toFixed(2));
                setSl((currentPrice + dist).toFixed(2));
            }
        }
    }
  }, [isOpen, isViewMode, viewingTrade, currentPrice, direction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onConfirm) {
        onConfirm(reason, parseFloat(tp), parseFloat(sl));
    }
  };

  const themeColor = activeDirection === 'LONG' ? 'text-trade-profit' : 'text-trade-loss';
  
  const Title = (
      <div className="flex items-center gap-2">
         <div className={`p-1 rounded bg-white/10 ${themeColor}`}>
            {activeDirection === 'LONG' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
         </div>
         <span className={`font-black tracking-tight ${themeColor}`}>
            {isViewMode ? 'TRADE DETAILS' : `OPEN ${activeDirection}`}
         </span>
         <span className="text-xs text-gray-400 font-mono ml-2">MARKET</span>
      </div>
  );

  return (
    <FloatingPanel 
        title={Title} 
        isOpen={isOpen} 
        onClose={onClose}
        initialWidth={400}
        initialHeight={600}
        initialX={window.innerWidth - 420}
        initialY={80}
    >
        <div className="h-full flex flex-col bg-white dark:bg-gray-950">
            {/* TOP SECTION (1/2): Parameters & Logic */}
            <div className="flex flex-col border-b border-gray-200 dark:border-gray-800 flex-1 overflow-y-auto">
                <form id="trade-form" onSubmit={handleSubmit} className="flex-col p-5 space-y-4">
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                            <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1"><Target size={10}/> Entry</span>
                            <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">{activePrice.toFixed(2)}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                            <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1"><Hash size={10}/> Qty</span>
                            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{quantity.toFixed(4)}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                            <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1"><Percent size={10}/> R/R</span>
                            <span className={`text-sm font-mono font-bold ${parseFloat(rrRatio) >= 2 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>1:{rrRatio}</span>
                        </div>
                    </div>

                    {/* View Mode PNL Display */}
                    {isViewMode && viewingTrade && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                            <div className={`p-3 rounded border bg-gray-50 dark:bg-gray-900/50 ${viewingTrade.pnl >= 0 ? 'border-trade-profit/30' : 'border-trade-loss/30'}`}>
                                <span className="text-[10px] text-gray-500 block">REALIZED PNL</span>
                                <span className={`text-xl font-mono font-bold ${viewingTrade.pnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                    {viewingTrade.pnl >= 0 ? '+' : ''}{viewingTrade.pnl.toFixed(2)}
                                </span>
                            </div>
                            <div className="p-3 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                <span className="text-[10px] text-gray-500 block">STATUS</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{viewingTrade.status}</span>
                            </div>
                        </div>
                    )}

                    {/* Content Container */}
                    <div className="flex flex-col gap-4">
                        {/* Inputs Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${!isViewMode && 'focus-within:border-trade-profit transition-colors'}`}>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Take Profit</label>
                                <input
                                    disabled={isViewMode}
                                    type="number" step="0.0001" required
                                    value={tp} onChange={(e) => setTp(e.target.value)}
                                    className="bg-transparent text-lg font-mono font-bold text-trade-profit outline-none w-full disabled:cursor-not-allowed"
                                />
                            </div>
                            <div className={`bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${!isViewMode && 'focus-within:border-trade-loss transition-colors'}`}>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Stop Loss</label>
                                <input
                                    disabled={isViewMode}
                                    type="number" step="0.0001" required
                                    value={sl} onChange={(e) => setSl(e.target.value)}
                                    className="bg-transparent text-lg font-mono font-bold text-trade-loss outline-none w-full disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Textarea */}
                        <div className="flex flex-col gap-2 h-32">
                            <label className="text-xs font-bold text-blue-500 dark:text-blue-400 flex items-center gap-2 shrink-0">
                               <FileText size={12}/> {isViewMode ? 'TRADING LOGIC' : 'TRADING PLAN (MARKDOWN)'}
                            </label>
                            <textarea
                                disabled={isViewMode}
                                required
                                autoFocus={!isViewMode}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="# My Setup..."
                                className="w-full flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-300 focus:border-blue-500 outline-none resize-none leading-relaxed custom-scrollbar disabled:opacity-80"
                            />
                        </div>
                    </div>
                </form>

                {/* Submit Button */}
                {!isViewMode && (
                    <div className="p-5 pt-0 shrink-0">
                        <button
                            type="submit"
                            form="trade-form"
                            className={`w-full py-3 rounded-xl font-black text-white shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                                activeDirection === 'LONG' 
                                ? 'bg-gradient-to-r from-emerald-600 to-trade-profit' 
                                : 'bg-gradient-to-r from-rose-700 to-trade-loss'
                            }`}
                        >
                            EXECUTE {activeDirection}
                        </button>
                    </div>
                )}
            </div>

            {/* BOTTOM SECTION (1/2): AI Commentary */}
            <div className="h-[40%] bg-gray-50 dark:bg-gray-900 flex flex-col min-h-0 border-t border-gray-200 dark:border-gray-800">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 text-indigo-500 dark:text-indigo-400 bg-white dark:bg-gray-900 shrink-0">
                    <Bot size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">AI Coach Analysis</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 p-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                                <div className="relative z-10 bg-white dark:bg-gray-900 rounded-full p-4 border border-indigo-200 dark:border-indigo-500/30 shadow-lg">
                                    <Bot size={32} className="text-indigo-500 dark:text-indigo-400 animate-bounce" />
                                </div>
                            </div>
                            <div className="text-center space-y-2 max-w-[90%]">
                                <p className="text-indigo-600 dark:text-indigo-300 font-bold text-xs animate-pulse">{loadingMsg}</p>
                                <div className="flex gap-1.5 justify-center mt-2">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    ) : isViewMode && viewingTrade?.aiComment ? (
                        <div className="text-gray-800 dark:text-gray-200">
                             <MarkdownRenderer content={viewingTrade.aiComment} />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
                             {isViewMode ? (
                                <span className="text-xs">No analysis available for this trade.</span>
                             ) : (
                                <>
                                    <Bot size={24} className="opacity-20"/>
                                    <span className="text-xs text-center px-8">Analysis will appear here after execution.</span>
                                </>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </FloatingPanel>
  );
};

export default TradeModal;
