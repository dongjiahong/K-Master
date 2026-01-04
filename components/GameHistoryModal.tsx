import React, { useState, useMemo } from 'react';
import { Play, Repeat, Calendar, Trophy, ChevronDown, ChevronUp, Trash2, List } from 'lucide-react';
import { GameSession, Trade } from '../types';
import FloatingPanel from './FloatingPanel';
import ConfirmDialog from './ConfirmDialog';

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: GameSession[];
  tradesByGame: Record<number, Trade[]>;
  onReplay: (session: GameSession) => void;
  onDelete: (sessions: GameSession[]) => void;
}

// Simple SVG Chart Component for History Summary
const MiniPnlChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
    if (!trades || trades.length === 0) return null;
    
    // Sort by exit time
    const sorted = [...trades].sort((a,b) => (a.exitTime || 0) - (b.exitTime || 0));
    let cumPnl = 0;
    const dataPoints = [{i:0, pnl:0}];
    
    sorted.forEach((t, idx) => {
        cumPnl += t.pnl;
        dataPoints.push({ i: idx + 1, pnl: cumPnl });
    });

    const maxPnl = Math.max(...dataPoints.map(d => d.pnl), 100);
    const minPnl = Math.min(...dataPoints.map(d => d.pnl), -100);
    const range = maxPnl - minPnl;
    const width = 100;
    const height = 30;

    const points = dataPoints.map(d => {
        const x = (d.i / dataPoints.length) * width;
        // Invert Y because SVG 0 is top
        const y = height - ((d.pnl - minPnl) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const isPositive = cumPnl >= 0;
    const color = isPositive ? '#2ebd85' : '#f6465d';

    return (
        <svg width={width} height={height} className="overflow-visible ml-2">
            <polyline 
                points={points} 
                fill="none" 
                stroke={color} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
            {/* End dot */}
            <circle 
                cx={dataPoints.length > 0 ? width : 0} 
                cy={height - ((cumPnl - minPnl) / range) * height} 
                r="3" 
                fill={color} 
            />
        </svg>
    );
};

const GameHistoryModal: React.FC<GameHistoryModalProps> = ({ 
  isOpen, onClose, sessions, tradesByGame, onReplay, onDelete
}) => {
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, sessions: GameSession[]} | null>(null);

  // Group Sessions by Symbol + Timeframe + MarketEndTime
  const groupedSessions = useMemo(() => {
    const groups: Record<string, GameSession[]> = {};
    
    // Sort all sessions first, newest start time first
    const sorted = [...sessions].sort((a,b) => b.startTime - a.startTime);
    
    sorted.forEach(s => {
        const key = `${s.symbol}_${s.timeframe}_${s.marketEndTime}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    
    // Convert to array for rendering
    return Object.entries(groups).map(([key, groupSessions]) => {
        const latestSession = groupSessions[0];
        return {
            key,
            sessions: groupSessions,
            latestSession,
            // Calculate aggregate stats if needed, or just display generic info
            count: groupSessions.length
        };
    });
  }, [sessions]);

  const toggleGroup = (key: string) => {
      if (expandedGroupKey === key) {
          setExpandedGroupKey(null);
          setSelectedSessionId(null);
      } else {
          setExpandedGroupKey(key);
          // Auto-select the first session in the group
          const group = groupedSessions.find(g => g.key === key);
          if (group && group.sessions.length > 0) {
              setSelectedSessionId(group.sessions[0].id!);
          }
      }
  };

  const getStats = (gameId: number) => {
    const trades = tradesByGame[gameId] || [];
    const wins = trades.filter(t => t.pnl > 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    return { count: trades.length, wins, totalPnl, winRate };
  };

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

  const Title = (
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
        <Trophy className="text-yellow-500" size={20} />
        <span>CAREER HISTORY</span>
      </div>
  );

  return (
    <>
        <FloatingPanel
            title={Title}
            isOpen={isOpen}
            onClose={onClose}
            initialWidth={800}
            initialHeight={600}
        >
            <div className="flex flex-col h-full bg-white dark:bg-gray-950">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 shrink-0">
                    Review history grouped by unique market scenarios. 
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100 dark:bg-gray-950/50 custom-scrollbar">
                    {groupedSessions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                            <Calendar size={48} className="mb-4 opacity-20" />
                            <p>No games played yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedSessions.map(({ key, sessions, latestSession, count }) => {
                                const isExpanded = expandedGroupKey === key;
                                const dateStr = new Date(latestSession.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
                                
                                return (
                                    <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        {/* Main Card Header */}
                                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                 <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 text-sm border border-gray-200 dark:border-gray-700">
                                                    {latestSession.symbol.replace('USDT','')}
                                                 </div>
                                                 <div>
                                                     <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                                                        {latestSession.timeframe} Scenario
                                                     </div>
                                                     <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                         <span>Latest: {dateStr}</span>
                                                         <span className="bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-[10px] border border-gray-200 dark:border-gray-700">
                                                             {count} Attempt{count > 1 ? 's' : ''}
                                                         </span>
                                                     </div>
                                                 </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button 
                                                    onClick={() => onReplay(latestSession)}
                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                                >
                                                    <Repeat size={14} /> Replay
                                                </button>
                                                
                                                <button 
                                                    onClick={() => toggleGroup(key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${isExpanded ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'}`}
                                                >
                                                    <List size={14} /> Summary
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>

                                                <button 
                                                    onClick={(e) => handleDeleteClick(e, sessions)}
                                                    className="px-2 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete all attempts for this scenario"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Area */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/30 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800 animate-in slide-in-from-top-2">
                                                
                                                {/* Left: Session List */}
                                                <div className="p-2 md:col-span-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Attempts</div>
                                                    <div className="space-y-1">
                                                        {sessions.map((s, idx) => {
                                                            const stats = getStats(s.id!);
                                                            const isSelected = selectedSessionId === s.id;
                                                            return (
                                                                <div 
                                                                    key={s.id}
                                                                    onClick={() => setSelectedSessionId(s.id!)}
                                                                    className={`p-2 rounded cursor-pointer border transition-all ${
                                                                        isSelected 
                                                                        ? 'bg-white dark:bg-gray-800 border-blue-500 shadow-sm' 
                                                                        : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
                                                                    }`}
                                                                >
                                                                    <div className="flex justify-between items-center mb-1">
                                                                         <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                                            {new Date(s.startTime).toLocaleTimeString()}
                                                                         </span>
                                                                         <span className={`text-xs font-mono font-bold ${stats.totalPnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                                                            {stats.totalPnl > 0 ? '+' : ''}{stats.totalPnl.toFixed(0)}
                                                                         </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                                                                        <span>{stats.wins}W / {stats.count - stats.wins}L</span>
                                                                        <span>{s.status}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Right: Trade Details for Selected Session */}
                                                <div className="p-3 md:col-span-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900">
                                                     {selectedSessionId && (
                                                         <>
                                                            {(() => {
                                                                const trades = tradesByGame[selectedSessionId] || [];
                                                                const s = sessions.find(sess => sess.id === selectedSessionId);
                                                                if (!s) return null;
                                                                const stats = getStats(s.id!);

                                                                return (
                                                                    <div className="space-y-4">
                                                                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                                                                            <div className="text-xs font-bold text-gray-500">
                                                                                SESSION DETAILS
                                                                            </div>
                                                                            <div className="flex items-center gap-4 text-xs">
                                                                                 <div>Win Rate: <span className="font-bold text-gray-800 dark:text-gray-200">{stats.winRate.toFixed(0)}%</span></div>
                                                                                 <div className="flex items-center">
                                                                                    Net PnL: 
                                                                                    <span className={`font-bold font-mono ml-1 ${stats.totalPnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                                                                        {stats.totalPnl.toFixed(2)}
                                                                                    </span>
                                                                                    <MiniPnlChart trades={trades} />
                                                                                 </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                             {trades.length === 0 ? (
                                                                                 <div className="text-center py-8 text-gray-400 text-xs">No trades in this session.</div>
                                                                             ) : trades.map(trade => (
                                                                                 <div key={trade.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                                                                                     <div className="flex items-center gap-3">
                                                                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                                                                                              {trade.direction}
                                                                                          </span>
                                                                                          <div className="flex flex-col">
                                                                                              <span className="text-xs font-mono text-gray-600 dark:text-gray-300">@ {trade.entryPrice}</span>
                                                                                              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{trade.reason}</span>
                                                                                          </div>
                                                                                     </div>
                                                                                     <span className={`text-xs font-mono font-bold ${trade.pnl >= 0 ? 'text-trade-profit' : 'text-trade-loss'}`}>
                                                                                         {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                                                                     </span>
                                                                                 </div>
                                                                             ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                         </>
                                                     )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </FloatingPanel>

        {confirmDelete && (
            <ConfirmDialog 
                isOpen={true}
                title="Delete History"
                message={`Are you sure you want to delete ${confirmDelete.sessions.length} session(s) associated with this chart scenario? This action cannot be undone.`}
                onConfirm={executeDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        )}
    </>
  );
};

export default GameHistoryModal;
