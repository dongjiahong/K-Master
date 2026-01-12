import { KLineData } from '../types';

/**
 * SR 通道接口
 */
export interface SRChannel {
  high: number;      // 通道上边界
  low: number;       // 通道下边界
  strength: number;  // 通道强度
  type: 'resistance' | 'support' | 'neutral';
}

/**
 * SR 通道配置选项
 */
export interface SRChannelOptions {
  pivotPeriod?: number;         // Pivot 检测周期，默认 10
  channelWidthPercent?: number; // 最大通道宽度百分比，默认 5
  minStrength?: number;         // 最小强度阈值，默认 1
  maxChannels?: number;         // 最大通道数量，默认 6
  loopbackPeriod?: number;      // 回溯周期，默认 290
  source?: 'High/Low' | 'Close/Open'; // 数据源，默认 High/Low
}

/**
 * Pivot 点位信息
 */
interface PivotPoint {
  value: number;
  index: number;
  timestamp: number;
}

/**
 * 检测 Pivot High 点位
 * @param candles K线数据
 * @param period 检测周期（前后各 period 根 K 线）
 * @param source 数据源
 */
function findPivotHighs(
  candles: KLineData[],
  period: number,
  source: 'High/Low' | 'Close/Open'
): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  
  for (let i = period; i < candles.length - period; i++) {
    const currentValue = source === 'High/Low' 
      ? candles[i].high 
      : Math.max(candles[i].open, candles[i].close);
    
    let isPivot = true;
    
    // 检查左侧
    for (let j = 1; j <= period; j++) {
      const leftValue = source === 'High/Low'
        ? candles[i - j].high
        : Math.max(candles[i - j].open, candles[i - j].close);
      if (leftValue >= currentValue) {
        isPivot = false;
        break;
      }
    }
    
    // 检查右侧
    if (isPivot) {
      for (let j = 1; j <= period; j++) {
        const rightValue = source === 'High/Low'
          ? candles[i + j].high
          : Math.max(candles[i + j].open, candles[i + j].close);
        if (rightValue >= currentValue) {
          isPivot = false;
          break;
        }
      }
    }
    
    if (isPivot) {
      pivots.push({
        value: currentValue,
        index: i,
        timestamp: candles[i].timestamp,
      });
    }
  }
  
  return pivots;
}

/**
 * 检测 Pivot Low 点位
 * @param candles K线数据
 * @param period 检测周期
 * @param source 数据源
 */
function findPivotLows(
  candles: KLineData[],
  period: number,
  source: 'High/Low' | 'Close/Open'
): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  
  for (let i = period; i < candles.length - period; i++) {
    const currentValue = source === 'High/Low'
      ? candles[i].low
      : Math.min(candles[i].open, candles[i].close);
    
    let isPivot = true;
    
    // 检查左侧
    for (let j = 1; j <= period; j++) {
      const leftValue = source === 'High/Low'
        ? candles[i - j].low
        : Math.min(candles[i - j].open, candles[i - j].close);
      if (leftValue <= currentValue) {
        isPivot = false;
        break;
      }
    }
    
    // 检查右侧
    if (isPivot) {
      for (let j = 1; j <= period; j++) {
        const rightValue = source === 'High/Low'
          ? candles[i + j].low
          : Math.min(candles[i + j].open, candles[i + j].close);
        if (rightValue <= currentValue) {
          isPivot = false;
          break;
        }
      }
    }
    
    if (isPivot) {
      pivots.push({
        value: currentValue,
        index: i,
        timestamp: candles[i].timestamp,
      });
    }
  }
  
  return pivots;
}

/**
 * 计算最大通道宽度
 * @param candles K线数据
 * @param widthPercent 宽度百分比
 */
function calculateChannelWidth(candles: KLineData[], widthPercent: number): number {
  const lookback = Math.min(300, candles.length);
  const recentCandles = candles.slice(-lookback);
  
  const highest = Math.max(...recentCandles.map(c => c.high));
  const lowest = Math.min(...recentCandles.map(c => c.low));
  
  return (highest - lowest) * widthPercent / 100;
}

/**
 * 为单个 Pivot 点构建 SR 通道
 * @param pivotIndex Pivot 在数组中的索引
 * @param allPivots 所有 Pivot 点
 * @param channelWidth 最大通道宽度
 */
function buildChannelFromPivot(
  pivotIndex: number,
  allPivots: PivotPoint[],
  channelWidth: number
): { high: number; low: number; pivotCount: number } {
  const basePivot = allPivots[pivotIndex];
  let high = basePivot.value;
  let low = basePivot.value;
  let pivotCount = 1;
  
  for (let i = 0; i < allPivots.length; i++) {
    if (i === pivotIndex) continue;
    
    const pivot = allPivots[i];
    const width = pivot.value <= high ? high - pivot.value : pivot.value - low;
    
    // 如果这个 pivot 可以纳入当前通道
    if (width <= channelWidth) {
      if (pivot.value <= high) {
        low = Math.min(low, pivot.value);
      } else {
        high = Math.max(high, pivot.value);
      }
      pivotCount++;
    }
  }
  
  return { high, low, pivotCount };
}

/**
 * 计算通道强度（包括 K 线触及次数）
 * @param channel 通道
 * @param candles K线数据
 * @param loopbackPeriod 回溯周期
 */
function calculateChannelStrength(
  channel: { high: number; low: number; pivotCount: number },
  candles: KLineData[],
  loopbackPeriod: number
): number {
  const recentCandles = candles.slice(-loopbackPeriod);
  let touchCount = 0;
  
  for (const candle of recentCandles) {
    // 检查 K 线是否触及通道
    if (
      (candle.high <= channel.high && candle.high >= channel.low) ||
      (candle.low <= channel.high && candle.low >= channel.low)
    ) {
      touchCount++;
    }
  }
  
  // 每个 pivot 计 20 分，每次触及计 1 分
  return channel.pivotCount * 20 + touchCount;
}

/**
 * 判断通道类型
 * @param channel 通道
 * @param currentPrice 当前价格
 */
function determineChannelType(
  channel: { high: number; low: number },
  currentPrice: number
): 'resistance' | 'support' | 'neutral' {
  if (channel.high < currentPrice && channel.low < currentPrice) {
    return 'support';
  } else if (channel.high > currentPrice && channel.low > currentPrice) {
    return 'resistance';
  }
  return 'neutral';
}

/**
 * 计算 SR 支撑阻力通道
 * @param candles K线数据
 * @param options 配置选项
 */
export function calculateSRChannels(
  candles: KLineData[],
  options: SRChannelOptions = {}
): SRChannel[] {
  const {
    pivotPeriod = 10,
    channelWidthPercent = 5,
    minStrength = 1,
    maxChannels = 6,
    loopbackPeriod = 290,
    source = 'High/Low',
  } = options;
  
  // 数据不足时返回空数组
  if (candles.length < pivotPeriod * 2 + 1) {
    return [];
  }
  
  // 1. 找出所有 Pivot 点
  const pivotHighs = findPivotHighs(candles, pivotPeriod, source);
  const pivotLows = findPivotLows(candles, pivotPeriod, source);
  
  // 合并所有 Pivot 点并按时间排序
  const allPivots = [...pivotHighs, ...pivotLows]
    .sort((a, b) => b.timestamp - a.timestamp); // 最新的在前
  
  // 只保留回溯周期内的 Pivot
  const currentIndex = candles.length - 1;
  const validPivots = allPivots.filter(p => currentIndex - p.index <= loopbackPeriod);
  
  if (validPivots.length === 0) {
    return [];
  }
  
  // 2. 计算最大通道宽度
  const channelWidth = calculateChannelWidth(candles, channelWidthPercent);
  
  // 3. 为每个 Pivot 构建通道并计算强度
  const channelCandidates: Array<{
    high: number;
    low: number;
    pivotCount: number;
    strength: number;
  }> = [];
  
  for (let i = 0; i < validPivots.length; i++) {
    const channel = buildChannelFromPivot(i, validPivots, channelWidth);
    const strength = calculateChannelStrength(channel, candles, loopbackPeriod);
    channelCandidates.push({ ...channel, strength });
  }
  
  // 4. 排序并选取最强的通道（去重重叠通道）
  const sortedCandidates = channelCandidates
    .filter(c => c.strength >= minStrength * 20)
    .sort((a, b) => b.strength - a.strength);
  
  const selectedChannels: SRChannel[] = [];
  const usedRanges: Array<{ high: number; low: number }> = [];
  
  const currentPrice = candles[candles.length - 1].close;
  
  for (const candidate of sortedCandidates) {
    if (selectedChannels.length >= maxChannels) break;
    
    // 检查是否与已选通道重叠
    const isOverlapping = usedRanges.some(range => 
      (candidate.high >= range.low && candidate.low <= range.high)
    );
    
    if (!isOverlapping) {
      selectedChannels.push({
        high: candidate.high,
        low: candidate.low,
        strength: candidate.strength,
        type: determineChannelType(candidate, currentPrice),
      });
      usedRanges.push({ high: candidate.high, low: candidate.low });
    }
  }
  
  return selectedChannels;
}

/**
 * 获取通道颜色
 * @param type 通道类型
 * @param opacity 透明度 (0-1)
 */
export function getChannelColor(
  type: 'resistance' | 'support' | 'neutral',
  opacity: number = 0.25
): string {
  switch (type) {
    case 'resistance':
      return `rgba(246, 70, 93, ${opacity})`;  // 红色
    case 'support':
      return `rgba(46, 189, 133, ${opacity})`;  // 绿色
    case 'neutral':
      return `rgba(156, 163, 175, ${opacity})`; // 灰色
  }
}

/**
 * 获取通道边框颜色
 * @param type 通道类型
 */
export function getChannelBorderColor(
  type: 'resistance' | 'support' | 'neutral'
): string {
  switch (type) {
    case 'resistance':
      return 'rgba(246, 70, 93, 0.5)';
    case 'support':
      return 'rgba(46, 189, 133, 0.5)';
    case 'neutral':
      return 'rgba(156, 163, 175, 0.5)';
  }
}
