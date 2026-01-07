import React, { useState, useEffect } from 'react';
import { X, Brain, Eye } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarketAnalysisPanelProps {
    analysisResult: string | null;
    isLoading: boolean;
    onClose: () => void;
    symbol?: string;
    ltfTimeframe?: string;
    htfTimeframe?: string;
}

const MarketAnalysisPanel: React.FC<MarketAnalysisPanelProps> = ({
    analysisResult,
    isLoading,
    onClose,
    symbol,
    ltfTimeframe,
    htfTimeframe
}) => {
    // AI Animation State
    const [aiStep, setAiStep] = useState(0);
    
    const aiSteps = [
        "📊 分析大周期趋势...",
        "📈 解读小周期结构...",
        "📍 评估当前位置...",
        "🔥 识别供需区域...",
        "📦 分析成交量...",
        "🔮 预测未来走势...",
        "🎯 综合判断倾向..."
    ];

    useEffect(() => {
        if (isLoading) {
            setAiStep(0);
            const interval = setInterval(() => {
                setAiStep(prev => (prev + 1) % aiSteps.length);
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    // Loading State
    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-6 animate-in fade-in duration-500 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative mb-8">
                        {/* Outer Spinner */}
                        <div className="w-24 h-24 rounded-full border-4 border-purple-100 dark:border-purple-900 border-t-purple-500 animate-spin"></div>
                        
                        {/* Inner Icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Eye size={40} className="text-purple-600 dark:text-purple-400 animate-pulse" />
                        </div>
                    </div>

                    <h3 className="text-xl font-black bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent mb-2">
                        AI 盘面解读中
                    </h3>
                    
                    <div className="h-6 overflow-hidden relative w-full flex justify-center">
                        <p className="text-sm font-mono text-gray-500 dark:text-gray-400 animate-pulse" key={aiStep}>
                            {aiSteps[aiStep]}
                        </p>
                    </div>

                    <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                        {symbol} · {ltfTimeframe} / {htfTimeframe}
                    </div>

                    <div className="mt-8 flex gap-2">
                         {[0,1,2].map(i => (
                             <div key={i} className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
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
                        <Eye size={16} className="text-purple-500" /> 盘面解读
                    </h2>
                    {symbol && (
                        <span className="text-[10px] text-gray-400">
                            {symbol} · {ltfTimeframe} / {htfTimeframe}
                        </span>
                    )}
                </div>
                
                <button 
                    onClick={onClose}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors"
                >
                    <X size={16} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                 {analysisResult ? (
                     <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-sm animate-in slide-in-from-top-2">
                         <h3 className="font-bold text-purple-700 dark:text-purple-400 text-sm mb-3 flex items-center gap-2">
                             <Brain size={16} /> 🔮 AI 盘面分析报告
                         </h3>
                         <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            <MarkdownRenderer content={analysisResult} />
                         </div>
                     </div>
                 ) : (
                     <div className="text-center text-gray-400 dark:text-gray-600 py-10 text-xs border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                         暂无分析结果
                     </div>
                 )}
             </div>
             
             {/* Footer */}
             <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-950">
                 <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                     ⚠️ AI 分析仅供参考，不构成投资建议。此结果为一次性数据，关闭后不保留。
                 </p>
             </div>
        </div>
    );
};

export default MarketAnalysisPanel;
