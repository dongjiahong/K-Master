import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, Bot, Target, Hash, Percent, ArrowLeft, ChevronUp, ChevronDown, Zap, Sparkles } from 'lucide-react';
import { Trade } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface TradePanelProps {
  onClose: () => void; // Now acts as "Back"
  // Create Mode Props
  onConfirm?: (reason: string, tp: number, sl: number, preAnalysis?: { type: 'analysis' | 'review'; content: string; timestamp: number }[]) => void;
  onAnalyze?: (reason: string, tp: number, sl: number) => Promise<string>;
  currentPrice?: number;
  direction?: 'LONG' | 'SHORT';
  balance?: number; 
  // View Mode Props
  viewingTrade?: Trade | null;
  // AI Status
  isLoading?: boolean;
  // 预览回调：实时上报止盈止损价格给父组件
  onPreviewChange?: (tp: number | null, sl: number | null, direction: 'LONG' | 'SHORT') => void;
}

// 不再使用预制模板，用户必须手动填写下单理由

const TradePanel: React.FC<TradePanelProps> = ({ 
  onClose, 
  onConfirm,
  onAnalyze,
  currentPrice = 0, 
  direction = 'LONG',
  balance = 0,
  viewingTrade,
  isLoading = false,
  onPreviewChange
}) => {
  const [reason, setReason] = useState('');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  
  // UI States
  // 默认展开，分析完后自动收起以展示 AI 结果
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [localAnalysis, setLocalAnalysis] = useState<{ type: 'analysis' | 'review'; content: string; timestamp: number }[]>([]);

  // Loading Animation State
  const [loadingMsg, setLoadingMsg] = useState('Initializing AI...');

  useEffect(() => {
    if (!isLoading) return;
    
    const messages = [
      "识别市场结构...",
      "扫描 K 线形态...",
      "计算盈亏比 (R/R)...",
      "评估趋势动能...",
      "生成交易策略...",
      "AI 教练正在撰写评价..."
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

  // Initialize Data
  useEffect(() => {
      if (isViewMode && viewingTrade) {
          setReason(viewingTrade.reason);
          setTp(viewingTrade.tp.toString());
          setSl(viewingTrade.sl.toString());
          setLocalAnalysis(viewingTrade.aiComments || []);
      } else {
          // Reset for new trade only if we don't have a local analysis (prevent reset during re-renders)
          if (localAnalysis.length === 0 && !reason && !tp) {
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
  }, [isViewMode, viewingTrade, currentPrice, direction]);

  // 监听 tp/sl 变化，实时上报预览价格给父组件
  useEffect(() => {
    if (!isViewMode && onPreviewChange) {
      const numTp = parseFloat(tp) || null;
      const numSl = parseFloat(sl) || null;
      onPreviewChange(numTp, numSl, activeDirection);
    }
  }, [tp, sl, activeDirection, isViewMode, onPreviewChange]);

  // 组件卸载时清除预览
  useEffect(() => {
    return () => {
      if (onPreviewChange) {
        onPreviewChange(null, null, 'LONG');
      }
    };
  }, [onPreviewChange]);

  // Handle "Analyze" click
  const handleAnalyzeClick = async () => {
      if (onAnalyze && !isLoading) {
          try {
            // 先展开表单让用户感觉是在基于当前输入分析（其实这里不用操作UI，只需调用逻辑）
            const result = await onAnalyze(reason, parseFloat(tp), parseFloat(sl));
            setLocalAnalysis(prev => [...prev, { type: 'analysis', content: result, timestamp: Date.now() }]);
          } catch (e) {
              console.error(e);
          }
      }
  };

  // Handle "Execute" click
  const handleExecuteClick = () => {
    if (!reason.trim()) {
      alert('请填写下单理由');
      return;
    }
    if (onConfirm) {
        onConfirm(reason, parseFloat(tp), parseFloat(sl), localAnalysis.length > 0 ? localAnalysis : undefined);
    }
  };

  const themeColor = activeDirection === 'LONG' ? 'text-trade-profit' : 'text-trade-loss';
  const themeBg = activeDirection === 'LONG' ? 'bg-trade-profit' : 'bg-trade-loss';
  const themeBorder = activeDirection === 'LONG' ? 'border-trade-profit' : 'border-trade-loss';
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 w-full overflow-hidden">
        {/* === Header (Actions Area) === */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-950 z-20">
             <div className="flex items-center gap-2">
                 <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                     <ArrowLeft size={20} />
                 </button>
                 <div className={`p-1 rounded bg-gray-100 dark:bg-gray-800 ${themeColor}`}>
                    {activeDirection === 'LONG' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                 </div>
                 <span className={`font-black tracking-tight ${themeColor} hidden sm:inline`}>
                    {isViewMode ? '详情' : `${activeDirection === 'LONG' ? '做多' : '做空'}计划`}
                 </span>
             </div>

             {/* Header Actions (Right Side) */}
             {!isViewMode && (
                 <div className="flex items-center gap-2">
                     <button
                        onClick={handleAnalyzeClick}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 border border-indigo-200 dark:border-indigo-800"
                     >
                        <Sparkles size={14} />
                        <span className="hidden sm:inline">AI 分析</span>
                     </button>
                     
                     <button
                        onClick={handleExecuteClick}
                        disabled={isLoading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${themeBg} text-white font-bold text-xs hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50`}
                     >
                        <Zap size={14} fill="currentColor"/>
                        <span>执行下单</span>
                     </button>
                 </div>
             )}
        </div>

        {/* Content Wrapper ensuring proper flex distribution */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

            {/* === Form Section (Collapsible, takes 25% height when expanded) === */}
            <div className={`flex flex-col border-b border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out bg-white dark:bg-gray-950 overflow-hidden ${isFormExpanded ? 'h-[30%]' : 'h-0'}`}>
                {/* Changed to flex-col to allow children to grow */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col">
                        
                    {/* Fixed Height Wrapper for Top Inputs */}
                    <div className="space-y-4 shrink-0">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                                <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1"><Target size={10}/> 入场价</span>
                                <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">{activePrice.toFixed(2)}</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                                <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1"><Hash size={10}/> 数量</span>
                                <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{quantity.toFixed(4)}</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800">
                                <span className="text-[10px] text-gray-500 block mb-0.5 uppercase flex items-center gap-1">
                                    <Percent size={10}/> 盈亏比
                                    {!isViewMode && (
                                        <button
                                            onClick={() => {
                                                // 根据止损计算 2:1 盈亏比的止盈价格
                                                const slPrice = parseFloat(sl) || activePrice;
                                                const riskDist = Math.abs(activePrice - slPrice);
                                                let newTp: number;
                                                if (activeDirection === 'LONG') {
                                                    newTp = activePrice + riskDist * 2;
                                                } else {
                                                    newTp = activePrice - riskDist * 2;
                                                }
                                                setTp(newTp.toFixed(2));
                                            }}
                                            className="ml-1 px-1.5 py-0.5 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-700"
                                            title="点击自动计算 2:1 盈亏比的止盈价格"
                                        >
                                            2:1
                                        </button>
                                    )}
                                </span>
                                <span className={`text-sm font-mono font-bold ${parseFloat(rrRatio) >= 2 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>1:{rrRatio}</span>
                            </div>
                        </div>

                        {/* View Mode PNL Display */}
                        {isViewMode && viewingTrade && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                <div className={`p-3 rounded border bg-gray-50 dark:bg-gray-900/50 ${viewingTrade.pnl >= 0 ? 'border-trade-profit/30' : 'border-trade-loss/30'}`}>
                                    <span className="text-[10px] text-gray-500 block">已实现盈亏</span>
                                    <span className={`text-xl font-mono font-bold ${viewingTrade.pnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                        {viewingTrade.pnl >= 0 ? '+' : ''}{viewingTrade.pnl.toFixed(2)}
                                    </span>
                                </div>
                                <div className="p-3 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                    <span className="text-[10px] text-gray-500 block">状态</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{viewingTrade.status}</span>
                                </div>
                            </div>
                        )}

                        {/* Inputs Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${!isViewMode && 'focus-within:border-trade-profit transition-colors'}`}>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">止盈 (TP)</label>
                                <input
                                    disabled={isViewMode}
                                    type="number" step="0.0001" required
                                    value={tp} onChange={(e) => setTp(e.target.value)}
                                    className="bg-transparent text-lg font-mono font-bold text-trade-profit outline-none w-full disabled:cursor-not-allowed"
                                />
                            </div>
                            <div className={`bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${!isViewMode && 'focus-within:border-trade-loss transition-colors'}`}>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">止损 (SL)</label>
                                <input
                                    disabled={isViewMode}
                                    type="number" step="0.0001" required
                                    value={sl} onChange={(e) => setSl(e.target.value)}
                                    className="bg-transparent text-lg font-mono font-bold text-trade-loss outline-none w-full disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Gap */}
                    <div className="h-4 shrink-0"></div>

                    {/* Textarea - 更紧凑的高度 */}
                    <div className="flex-1 flex flex-col gap-2 min-h-[5rem]">
                        <label className="text-xs font-bold text-blue-500 dark:text-blue-400 flex items-center gap-2 shrink-0">
                            <FileText size={12}/> {isViewMode ? '交易逻辑' : '交易计划 (支持 Markdown)'}
                        </label>
                        <textarea
                            disabled={isViewMode}
                            required
                            autoFocus={!isViewMode}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="# 我的入场逻辑..."
                            className="w-full flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-300 focus:border-blue-500 outline-none resize-none leading-relaxed custom-scrollbar disabled:opacity-80"
                        />
                    </div>
                </div>
            </div>

            {/* === Collapse Toggle Bar === */}
            <button 
                onClick={() => setIsFormExpanded(!isFormExpanded)}
                className="w-full flex items-center justify-center py-1.5 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors border-b border-gray-200 dark:border-gray-800 z-10 shrink-0 cursor-row-resize shadow-sm"
                title={isFormExpanded ? "收起表单" : "展开表单"}
            >
                {isFormExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* === AI Output Section (Takes remaining space) === */}
            <div className={`flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 relative`}>
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 text-indigo-500 dark:text-indigo-400 bg-white dark:bg-gray-900 shrink-0">
                    <Bot size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">AI 教练分析</span>
                    {!isFormExpanded && !isLoading && (
                        <span className="ml-auto text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full animate-pulse">
                            Ready
                        </span>
                    )}
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
                                <p className="text-indigo-600 dark:text-indigo-300 font-bold text-sm animate-pulse">{loadingMsg}</p>
                                <div className="flex gap-1.5 justify-center mt-2">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    ) : localAnalysis.length > 0 || (isViewMode && viewingTrade?.aiComments && viewingTrade.aiComments.length > 0) ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                             {(localAnalysis.length > 0 ? localAnalysis : viewingTrade?.aiComments || []).map((item, index) => (
                                 <div key={index} className={`p-4 rounded-xl border text-sm leading-relaxed ${
                                     item.type === 'analysis' 
                                         ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                                         : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                 }`}>
                                     <div className="flex items-center gap-2 mb-2 text-xs font-bold">
                                         {item.type === 'analysis' ? (
                                             <><Sparkles size={12} className="text-indigo-500" /> <span className="text-indigo-600 dark:text-indigo-400">入场分析</span></>
                                         ) : (
                                             <><Bot size={12} className="text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">平仓复盘</span></>
                                         )}
                                         <span className="text-gray-400 font-normal">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                     </div>
                                     <div className="text-gray-800 dark:text-gray-200">
                                         <MarkdownRenderer content={item.content} />
                                     </div>
                                 </div>
                             ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2 opacity-60">
                             {isViewMode ? (
                                <span className="text-sm">暂无 AI 分析记录</span>
                             ) : (
                                <>
                                    <Sparkles size={32} className="mb-2 text-indigo-300 dark:text-indigo-700"/>
                                    <span className="text-sm text-center px-8 font-bold">建议先点击顶部 'AI 分析' 获取策略</span>
                                    <span className="text-[10px] text-center px-8">Analysis First, Execute Later</span>
                                </>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default TradePanel;