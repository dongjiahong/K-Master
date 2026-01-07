import { useCallback, useState } from 'react';
import { KLineData, Trade, Timeframe } from '../types';
import { analyzeTrade, analyzeMarket } from '../services/geminiService';

/**
 * Hook 用于管理 AI 分析相关功能
 */
export function useAiAnalysis() {
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [isMarketAnalyzing, setIsMarketAnalyzing] = useState(false);

  /**
   * 执行盘面解读
   */
  const performMarketAnalysis = useCallback(async (
    symbol: string,
    ltfTimeframe: Timeframe,
    htfTimeframe: Timeframe,
    ltfCandles: KLineData[],
    htfCandles: KLineData[],
    customPrompt: string
  ): Promise<string> => {
    setIsMarketAnalyzing(true);
    setMarketAnalysis(null);
    
    try {
      const result = await analyzeMarket(
        symbol,
        ltfTimeframe,
        htfTimeframe,
        ltfCandles,
        htfCandles,
        customPrompt
      );
      setMarketAnalysis(result);
      return result;
    } catch (error) {
      console.error('Market analysis error:', error);
      const errorMsg = '⚠️ 盘面解读失败，请检查网络或稍后重试。';
      setMarketAnalysis(errorMsg);
      return errorMsg;
    } finally {
      setIsMarketAnalyzing(false);
    }
  }, []);

  /**
   * 执行交易分析（入场前 AI 分析）
   */
  const performTradeAnalysis = useCallback(async (
    trade: Trade,
    ltfCandles: KLineData[],
    htfCandles: KLineData[],
    customPrompt: string
  ): Promise<string> => {
    const comment = await analyzeTrade(trade, ltfCandles, htfCandles, customPrompt);
    return comment;
  }, []);

  /**
   * 清空盘面分析
   */
  const clearMarketAnalysis = useCallback(() => {
    setMarketAnalysis(null);
  }, []);

  return {
    marketAnalysis,
    isMarketAnalyzing,
    performMarketAnalysis,
    performTradeAnalysis,
    clearMarketAnalysis,
  };
}
