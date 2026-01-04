import Dexie, { Table } from 'dexie';
import { GameSession, Trade } from './types';

export class TradingSimDB extends Dexie {
  games!: Table<GameSession>;
  trades!: Table<Trade>;

  constructor() {
    super('KLineMasterDB');
    // Version 2: Added marketEndTime, parentSessionId to games
    (this as any).version(2).stores({
      games: '++id, startTime, status, symbol, marketEndTime, parentSessionId',
      trades: 'id, gameId, status, entryTime' 
    });
    // Keep version 1 for backward compatibility if needed (Dexie handles upgrades usually)
  }
}

export const db = new TradingSimDB();