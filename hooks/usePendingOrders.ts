import { useCallback, useState } from 'react';
import { KLineData, PendingOrder, Trade } from '../types';
import { db } from '../db';

interface UsePendingOrdersOptions {
  onOrderTriggered?: (trade: Trade) => void;
}

/**
 * Hook 用于管理限价挂单
 */
export function usePendingOrders(options: UsePendingOrdersOptions = {}) {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);

  /**
   * 创建限价挂单
   */
  const createPendingOrder = useCallback((
    gameId: number,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    triggerPrice: number,
    tp: number,
    sl: number,
    reason: string
  ) => {
    const newOrder: PendingOrder = {
      id: `pending_${Date.now()}`,
      gameId,
      symbol,
      direction,
      orderType: 'LIMIT',
      triggerPrice,
      tp,
      sl,
      reason,
      createdAt: Date.now(),
      status: 'PENDING'
    };
    
    setPendingOrders(prev => [...prev, newOrder]);
    return newOrder;
  }, []);

  /**
   * 检查是否有挂单被触发
   */
  const checkPendingOrderTrigger = useCallback((candle: KLineData): PendingOrder | null => {
    const triggeredOrder = pendingOrders.find(order => {
      if (order.status !== 'PENDING') return false;
      if (order.direction === 'LONG') {
        // 做多限价单：价格下跌到触发价
        return candle.low <= order.triggerPrice;
      } else {
        // 做空限价单：价格上涨到触发价
        return candle.high >= order.triggerPrice;
      }
    });
    
    return triggeredOrder || null;
  }, [pendingOrders]);

  /**
   * 触发挂单，创建实际交易
   */
  const triggerPendingOrder = useCallback(async (
    order: PendingOrder,
    candle: KLineData,
    balance: number
  ): Promise<Trade> => {
    // 更新挂单状态
    setPendingOrders(prev => prev.map(o => 
      o.id === order.id ? { ...o, status: 'TRIGGERED' as const } : o
    ));
    
    // 创建实际交易
    const newTrade: Trade = {
      id: `trade_${Date.now()}`,
      gameId: order.gameId,
      symbol: order.symbol,
      direction: order.direction,
      entryPrice: order.triggerPrice,
      tp: order.tp,
      sl: order.sl,
      quantity: (balance * 0.5) / order.triggerPrice,
      entryTime: candle.timestamp,
      status: 'OPEN',
      pnl: 0,
      reason: order.reason
    };
    
    await db.trades.add(newTrade);
    
    // 通知外部订单已触发
    options.onOrderTriggered?.(newTrade);
    
    return newTrade;
  }, [options]);

  /**
   * 取消挂单
   */
  const cancelPendingOrder = useCallback((orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
  }, []);

  /**
   * 重置所有挂单
   */
  const resetPendingOrders = useCallback(() => {
    setPendingOrders([]);
  }, []);

  return {
    pendingOrders,
    createPendingOrder,
    checkPendingOrderTrigger,
    triggerPendingOrder,
    cancelPendingOrder,
    resetPendingOrders,
  };
}
