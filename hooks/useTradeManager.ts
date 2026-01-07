import { useCallback, useRef, useState } from 'react';
import { KLineData, Trade } from '../types';
import { db } from '../db';
import { reviewClosedTrade } from '../services/geminiService';

interface UseTradeManagerOptions {
  onTradeOpened?: (trade: Trade) => void;
  onTradeClosed?: (trade: Trade) => void;
}

/**
 * Hook 用于管理交易（开仓、平仓、止盈止损）
 */
export function useTradeManager(options: UseTradeManagerOptions = {}) {
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Ref for synchronous access in intervals
  const tradeHistoryRef = useRef<Trade[]>([]);

  // Keep ref in sync
  const updateTradeHistoryRef = useCallback((trades: Trade[]) => {
    tradeHistoryRef.current = trades;
    setTradeHistory(trades);
  }, []);

  /**
   * 检查交易是否触发止盈/止损
   */
  const checkTradeStatus = useCallback((trade: Trade, candle: KLineData): {
    status: Trade['status'] | null;
    exitPrice: number;
  } => {
    let closedStatus: Trade['status'] | null = null;
    let exitPrice = 0;

    if (trade.direction === 'LONG') {
      if (candle.low <= trade.sl) { closedStatus = 'CLOSED_SL'; exitPrice = trade.sl; }
      else if (candle.high >= trade.tp) { closedStatus = 'CLOSED_TP'; exitPrice = trade.tp; }
    } else {
      if (candle.high >= trade.sl) { closedStatus = 'CLOSED_SL'; exitPrice = trade.sl; }
      else if (candle.low <= trade.tp) { closedStatus = 'CLOSED_TP'; exitPrice = trade.tp; }
    }

    return { status: closedStatus, exitPrice };
  }, []);

  /**
   * 平仓处理
   */
  const closeTrade = useCallback(async (
    trade: Trade,
    exitPrice: number,
    status: Trade['status'],
    exitTime: number,
    closeOptions?: {
      ltfCandles?: KLineData[];
      htfCandles?: KLineData[];
      customPrompt?: string;
    }
  ): Promise<Trade> => {
    const pnl = trade.direction === 'LONG' 
      ? (exitPrice - trade.entryPrice) * trade.quantity 
      : (trade.entryPrice - exitPrice) * trade.quantity;
    
    const closedTrade: Trade = { ...trade, status, exitPrice, exitTime, pnl };

    setActiveTrade(null);
    setTradeHistory(prev => {
      const updated = prev.map(t => t.id === trade.id ? closedTrade : t);
      tradeHistoryRef.current = updated;
      return updated;
    });

    await db.trades.put(closedTrade);

    // 止盈或止损平仓时，自动调用 AI 进行复盘分析
    if ((status === 'CLOSED_TP' || status === 'CLOSED_SL') && closeOptions?.ltfCandles && closeOptions?.htfCandles) {
      setAiLoading(true);
      try {
        const reviewComment = await reviewClosedTrade(
          closedTrade, 
          closeOptions.ltfCandles, 
          closeOptions.htfCandles, 
          closeOptions.customPrompt || ''
        );
        
        const existingComments = closedTrade.aiComments || [];
        const reviewedTrade = { 
          ...closedTrade, 
          aiComments: [...existingComments, { type: 'review' as const, content: reviewComment, timestamp: Date.now() }] 
        };
        
        setTradeHistory(prev => {
          const updated = prev.map(t => t.id === closedTrade.id ? reviewedTrade : t);
          tradeHistoryRef.current = updated;
          return updated;
        });
        await db.trades.put(reviewedTrade);
        
        return reviewedTrade;
      } finally {
        setAiLoading(false);
      }
    }

    return closedTrade;
  }, []);

  /**
   * 执行开仓
   */
  const executeTrade = useCallback(async (
    gameId: number,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    tp: number,
    sl: number,
    balance: number,
    reason: string,
    entryTime: number,
    preAnalysis?: { type: 'analysis' | 'review'; content: string; timestamp: number }[]
  ): Promise<Trade> => {
    const newTrade: Trade = {
      id: `trade_${Date.now()}`,
      gameId,
      symbol,
      direction,
      entryPrice,
      tp,
      sl,
      quantity: (balance * 0.5) / entryPrice,
      entryTime,
      status: 'OPEN',
      pnl: 0,
      reason,
      aiComments: preAnalysis
    };
    
    setActiveTrade(newTrade);
    setTradeHistory(prev => {
      const updated = [newTrade, ...prev];
      tradeHistoryRef.current = updated;
      return updated;
    });
    await db.trades.add(newTrade);
    
    options.onTradeOpened?.(newTrade);
    return newTrade;
  }, [options]);

  /**
   * 设置活跃交易（用于恢复会话）
   */
  const setActiveTradeDirectly = useCallback((trade: Trade | null) => {
    setActiveTrade(trade);
  }, []);

  /**
   * 初始化交易历史（用于恢复会话）
   */
  const initializeTradeHistory = useCallback((trades: Trade[]) => {
    setTradeHistory(trades);
    tradeHistoryRef.current = trades;
  }, []);

  /**
   * 重置所有交易状态
   */
  const resetTrades = useCallback(() => {
    setActiveTrade(null);
    setTradeHistory([]);
    tradeHistoryRef.current = [];
  }, []);

  return {
    activeTrade,
    tradeHistory,
    tradeHistoryRef,
    aiLoading,
    setAiLoading,
    checkTradeStatus,
    closeTrade,
    executeTrade,
    setActiveTradeDirectly,
    initializeTradeHistory,
    resetTrades,
  };
}
