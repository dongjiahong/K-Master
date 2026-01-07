/**
 * 工具函数模块 - 通用格式化和辅助函数
 */

/**
 * 格式化货币金额
 * @param value 数值
 * @param decimals 小数位数，默认 2
 * @returns 格式化后的字符串
 */
export function formatCurrency(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

/**
 * 格式化数字
 * @param value 数值
 * @param decimals 小数位数，默认 4
 * @returns 格式化后的字符串
 */
export function formatNumber(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

/**
 * 格式化时间戳为本地时间字符串
 * @param ts 时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * 格式化时间戳为简短时间
 * @param ts 时间戳（毫秒）
 * @returns 格式化后的时间字符串 (HH:MM:SS)
 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

/**
 * 格式化盈亏
 * @param pnl 盈亏数值
 * @returns 带正负号的字符串
 */
export function formatPnl(pnl: number): string {
  const formatted = pnl.toFixed(2);
  return pnl >= 0 ? `+${formatted}` : formatted;
}

/**
 * 格式化百分比
 * @param value 数值（如 0.05 表示 5%）
 * @param decimals 小数位数，默认 2
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 计算盈亏比
 * @param entryPrice 入场价
 * @param tp 止盈价
 * @param sl 止损价
 * @returns 盈亏比字符串 (如 "1:2.00")
 */
export function calculateRiskReward(entryPrice: number, tp: number, sl: number): string {
  const risk = Math.abs(entryPrice - sl);
  const reward = Math.abs(tp - entryPrice);
  const ratio = risk > 0 ? (reward / risk).toFixed(2) : '0.00';
  return `1:${ratio}`;
}
