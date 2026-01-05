import Dexie, { Table } from 'dexie';
import { GameSession, Trade } from './types';

// 用户设置接口
export interface UserSettings {
  key: string;          // 设置项的键名
  value: string;        // 设置项的值
  updatedAt: number;    // 更新时间
}

export class TradingSimDB extends Dexie {
  games!: Table<GameSession>;
  trades!: Table<Trade>;
  settings!: Table<UserSettings>;

  constructor() {
    super('KLineMasterDB');
    // Version 2: Added marketEndTime, parentSessionId to games
    (this as any).version(2).stores({
      games: '++id, startTime, status, symbol, marketEndTime, parentSessionId',
      trades: 'id, gameId, status, entryTime' 
    });
    // Version 3: Added settings table for user preferences
    (this as any).version(3).stores({
      games: '++id, startTime, status, symbol, marketEndTime, parentSessionId',
      trades: 'id, gameId, status, entryTime',
      settings: 'key, updatedAt'
    });
  }
}

export const db = new TradingSimDB();

// 设置项的 key 常量
export const SETTINGS_KEYS = {
  CUSTOM_PROMPT: 'customPrompt',
  THEME: 'theme',
  CONFIG_SYMBOL: 'configSymbol',
  CONFIG_TIMEFRAME: 'configTimeframe',
} as const;

// 辅助函数：获取设置值
export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.settings.get(key);
  return setting ? setting.value : null;
}

// 辅助函数：保存设置值
export async function saveSetting(key: string, value: string): Promise<void> {
  await db.settings.put({
    key,
    value,
    updatedAt: Date.now()
  });
}