import { KLineData, Timeframe } from '../types';

const BASE_URL = 'https://api.binance.com/api/v3';

// 强制默认使用 BTCUSDT
const SYMBOLS = ['BTCUSDT'];

export const getRandomSymbol = () => 'BTCUSDT';

export const getRandomTimeframe = (): Timeframe => {
  const tfs = [Timeframe.M5, Timeframe.M15, Timeframe.M30, Timeframe.H1];
  return tfs[Math.floor(Math.random() * tfs.length)];
};

export const getHigherTimeframe = (tf: Timeframe): Timeframe => {
  switch (tf) {
    case Timeframe.M5: return Timeframe.M30;
    case Timeframe.M15: return Timeframe.H1;
    case Timeframe.M30: return Timeframe.H4;
    case Timeframe.H1: return Timeframe.D1;
    default: return Timeframe.D1;
  }
};

export const timeframeToMs = (tf: Timeframe): number => {
  const minute = 60 * 1000;
  switch (tf) {
    case Timeframe.M5: return 5 * minute;
    case Timeframe.M15: return 15 * minute;
    case Timeframe.M30: return 30 * minute;
    case Timeframe.H1: return 60 * minute;
    case Timeframe.H4: return 4 * 60 * minute;
    case Timeframe.D1: return 24 * 60 * minute;
    default: return 24 * 60 * minute;
  }
};

export const generateRandomMarketEndTime = (): number => {
  const TWO_YEARS_MS = 63072000000;
  // End time is somewhere between now and 2 years ago
  return Date.now() - Math.floor(Math.random() * (TWO_YEARS_MS * 0.8));
};

/**
 * 获取 K 线数据
 * If endTime is provided, it fetches data ending at or before that time.
 */
export const fetchMarketData = async (symbol: string, interval: Timeframe, limit: number = 1000, endTime?: number): Promise<KLineData[]> => {
  
  // Use provided endTime or default to Now (should be handled by caller usually for consistency)
  const finalEndTime = endTime || Date.now();
  
  try {
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&endTime=${finalEndTime}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const rawData = await response.json();
    
    return rawData.map((d: any[]) => ({
      timestamp: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
      turnover: parseFloat(d[7])
    }));
  } catch (error) {
    console.error("Failed to fetch binance data", error);
    return [];
  }
};