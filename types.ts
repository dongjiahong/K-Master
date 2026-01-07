export interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}

export enum Timeframe {
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d'
}

export interface Trade {
  id: string;
  gameId: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  tp: number;
  sl: number;
  quantity: number;
  entryTime: number;
  exitTime?: number;
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  pnl: number;
  reason: string;
  aiComments?: { type: 'analysis' | 'review'; content: string; timestamp: number }[]; // 支持多个 AI 分析结果
}

export interface GameSession {
  id?: number; // IndexedDB auto-increment
  startTime: number;
  endTime?: number; // Real world time when game finished
  symbol: string;
  timeframe: Timeframe;
  marketEndTime: number; // The timestamp of the last candle in the data set (Anchor for replay)
  initialBalance: number;
  finalBalance?: number;
  status: 'ACTIVE' | 'COMPLETED';
  parentSessionId?: number; // If this game is a replay of another game
  aiReport?: string; // Stored AI summary
}

export interface AIResponse {
  comment: string;
  score: number; // 1-10
}

// 限价挂单
export interface PendingOrder {
  id: string;
  gameId: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  orderType: 'LIMIT';
  triggerPrice: number;  // 触发价格（限价单入场价）
  tp: number;
  sl: number;
  reason: string;
  createdAt: number;
  status: 'PENDING' | 'TRIGGERED' | 'CANCELLED';
}
