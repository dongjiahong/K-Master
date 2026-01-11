import React, { useMemo } from 'react';
import { Repeat, Trophy, Trash2, ArrowLeft, Eye } from 'lucide-react';
import { GameSession, Trade } from '../types';
import ConfirmDialog from './ConfirmDialog';
import CareerStatsChart from './CareerStatsChart';

interface GameHistoryPanelProps {
  onClose: () => void;
  sessions: GameSession[];
  tradesByGame: Record<number, Trade[]>;
  onReplay: (session: GameSession) => void;
  onReview: (session: GameSession) => void;
  onDelete: (sessions: GameSession[]) => void;
}

const GameHistoryPanel: React.FC<GameHistoryPanelProps> = ({ 
  onClose, sessions, tradesByGame, onReplay, onReview, onDelete
}) => {
  const [confirmDelete, setConfirmDelete] = React.useState<{isOpen: boolean, sessions: GameSession[]} | null>(null);
  
  // Group Sessions by Symbol + Timeframe + MarketEndTime (Scenario)
  const groupedSessions = useMemo(() => {
    const groups: Record<string, GameSession[]> = {};
    const sorted = [...sessions].sort((a,b) => b.startTime - a.startTime);
    sorted.forEach(s => {
        const key = `${s.symbol}_${s.timeframe}_${s.marketEndTime}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    
    return Object.entries(groups).map(([key, groupSessions]) => {
        const latestSession = groupSessions[0];
        // Aggregate Stats
        let totalPnl = 0;
        let totalTrades = 0;
        
        groupSessions.forEach(s => {
            const t = tradesByGame[s.id!] || [];
            totalPnl += t.reduce((sum, trade) => sum + trade.pnl, 0);
            totalTrades += t.length;
        });

        return {
            key,
            sessions: groupSessions,
            latestSession,
            count: groupSessions.length,
            stats: { totalPnl, totalTrades }
        };
    });
  }, [sessions, tradesByGame]);

  // 计算生涯趋势数据（按时间正序排列每局的利润率和胜率）
  const careerTrendData = useMemo(() => {
    // 按时间正序排列所有已完成的游戏
    const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const INITIAL_BALANCE = 10000; // 初始资金
    
    return sortedSessions.map(s => {
      const trades = tradesByGame[s.id!] || [];
      const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
      const winCount = trades.filter(t => t.pnl > 0).length;
      const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
      const profitRate = (totalPnl / INITIAL_BALANCE) * 100;
      
      return {
        label: new Date(s.startTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        profitRate,
        winRate
      };
    });
  }, [sessions, tradesByGame]);

  const handleDeleteClick = (e: React.MouseEvent, groupSessions: GameSession[]) => {
      e.stopPropagation();
      setConfirmDelete({ isOpen: true, sessions: groupSessions });
  };

  const executeDelete = () => {
      if (confirmDelete) {
          onDelete(confirmDelete.sessions);
          setConfirmDelete(null);
      }
  };

  return (
    <div className="h-full flex flex-col w-full">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
             <div className="flex items-center gap-2">
                 <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                     <ArrowLeft size={20} />
                 </button>
                 <Trophy className="text-yellow-500" size={18} />
                 <span className="font-bold text-gray-900 dark:text-white">生涯记录</span>
             </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {/* 生涯趋势图表 */}
            {sessions.length > 0 && (
                <CareerStatsChart data={careerTrendData} />
            )}
            
            {groupedSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Trophy size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">暂无游戏记录</p>
                </div>
            ) : (
                groupedSessions.map(({ key, sessions, latestSession, count, stats }) => (
                    <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md">
                        {/* Scenario Header */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    {latestSession.symbol.replace('USDT','')}
                                    <span className="text-[10px] bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                                        {latestSession.timeframe}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-1">
                                    场景 ID: {key.slice(-6)} · 尝试次数: {count}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => onReplay(latestSession)}
                                    className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1"
                                >
                                    <Repeat size={12} /> 重玩
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteClick(e, sessions)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Session List */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {sessions.map(s => {
                                const trades = tradesByGame[s.id!] || [];
                                const sPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
                                const isProfit = sPnl >= 0;
                                const winCount = trades.filter(t => t.pnl > 0).length;
                                const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 100) : 0;

                                return (
                                    <div key={s.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                                {new Date(s.startTime).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                            <span className={`text-xs font-bold font-mono ${isProfit ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                                {isProfit ? '+' : ''}{sPnl.toFixed(0)} 
                                                <span className="text-gray-400 font-normal ml-1">({trades.length} 笔</span>
                                                <span className={`font-normal ml-1 ${winRate >= 50 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                                    胜率 {winRate}%
                                                </span>
                                                <span className="text-gray-400 font-normal">)</span>
                                            </span>
                                        </div>
                                        
                                        <button 
                                            onClick={() => onReview(s)}
                                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1"
                                        >
                                            <Eye size={12} /> 回顾
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>

        {confirmDelete && (
            <ConfirmDialog 
                isOpen={true}
                title="删除记录"
                message={`确定要删除该场景下的 ${confirmDelete.sessions.length} 条游戏记录吗？此操作无法撤销。`}
                onConfirm={executeDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        )}
    </div>
  );
};

export default GameHistoryPanel;