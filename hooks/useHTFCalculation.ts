import { useCallback, useRef, useState } from 'react';
import { KLineData, Timeframe } from '../types';
import { timeframeToMs } from '../services/binanceService';

/**
 * Hook 用于管理 HTF（高时间框架）K线的计算和状态
 * 从 LTF K线数据实时计算 HTF K线
 */
export function useHTFCalculation() {
  const [htfHistory, setHtfHistory] = useState<KLineData[]>([]);
  const [currentHtfCandle, setCurrentHtfCandle] = useState<KLineData | null>(null);
  
  // Ref to hold the current HTF candle for synchronous logic (avoids stale closures in interval)
  const htfCandleLogicRef = useRef<KLineData | null>(null);

  /**
   * 使用 LTF K线更新当前 HTF K线
   */
  const updateHtfWithLtf = useCallback((ltfCandle: KLineData, htfTf: Timeframe) => {
    const htfMs = timeframeToMs(htfTf);
    const htfStartTime = Math.floor(ltfCandle.timestamp / htfMs) * htfMs;
    
    const prev = htfCandleLogicRef.current;
    let nextHtfCandle: KLineData;

    if (prev && prev.timestamp !== htfStartTime) {
      // New Candle Started: Commit previous to history
      setHtfHistory(history => {
        // Deduplicate just in case
        if (history.length > 0 && history[history.length - 1].timestamp === prev.timestamp) return history;
        return [...history, prev];
      });

      // Create new candle
      nextHtfCandle = {
        timestamp: htfStartTime,
        open: ltfCandle.open,
        high: ltfCandle.high,
        low: ltfCandle.low,
        close: ltfCandle.close,
        volume: ltfCandle.volume,
        turnover: ltfCandle.turnover
      };
    } else if (prev) {
      // Update existing candle
      nextHtfCandle = {
        ...prev,
        high: Math.max(prev.high, ltfCandle.high),
        low: Math.min(prev.low, ltfCandle.low),
        close: ltfCandle.close,
        volume: prev.volume + ltfCandle.volume
      };
    } else {
      // Initialize first candle
      nextHtfCandle = {
        timestamp: htfStartTime,
        open: ltfCandle.open,
        high: ltfCandle.high,
        low: ltfCandle.low,
        close: ltfCandle.close,
        volume: ltfCandle.volume,
        turnover: ltfCandle.turnover
      };
    }
    
    // Update Ref (Sync Logic)
    htfCandleLogicRef.current = nextHtfCandle;
    // Update State (Trigger Render)
    setCurrentHtfCandle(nextHtfCandle);
  }, []);

  /**
   * 从 LTF 数据重建指定索引处的 HTF K线（用于复盘/恢复）
   */
  const calculateHtfFromLtf = useCallback((ltfData: KLineData[], index: number, htfTf: Timeframe): KLineData | null => {
    if (index < 0 || ltfData.length === 0) return null;
    const current = ltfData[index];
    const htfMs = timeframeToMs(htfTf);
    const htfStart = Math.floor(current.timestamp / htfMs) * htfMs;
    
    // Look back to find start
    const relevant: KLineData[] = [];
    for (let i = index; i >= 0; i--) {
      if (ltfData[i].timestamp < htfStart) break;
      relevant.unshift(ltfData[i]);
    }
    if (relevant.length === 0) return null;
    
    const res = { ...relevant[0], timestamp: htfStart, volume: 0, turnover: 0 };
    res.close = relevant[relevant.length - 1].close; // Close is last
    relevant.forEach(c => {
      res.high = Math.max(res.high, c.high);
      res.low = Math.min(res.low, c.low);
      res.volume += c.volume;
      if (c.turnover) res.turnover = (res.turnover || 0) + c.turnover;
    });
    return res;
  }, []);

  /**
   * 初始化 HTF 状态
   */
  const initializeHtf = useCallback((
    historicalHtf: KLineData[],
    partialHtf: KLineData | null
  ) => {
    setHtfHistory(historicalHtf);
    setCurrentHtfCandle(partialHtf);
    htfCandleLogicRef.current = partialHtf;
  }, []);

  /**
   * 同步更新 HTF 状态（直接设置，不通过计算）
   */
  const syncHtfCandle = useCallback((candle: KLineData | null) => {
    setCurrentHtfCandle(candle);
    htfCandleLogicRef.current = candle;
  }, []);

  /**
   * 重置 HTF 状态
   */
  const resetHtf = useCallback(() => {
    setHtfHistory([]);
    setCurrentHtfCandle(null);
    htfCandleLogicRef.current = null;
  }, []);

  return {
    htfHistory,
    currentHtfCandle,
    htfCandleLogicRef,
    updateHtfWithLtf,
    calculateHtfFromLtf,
    initializeHtf,
    syncHtfCandle,
    resetHtf,
  };
}
