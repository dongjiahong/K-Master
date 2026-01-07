import { db, ApiKeyRecord, ApiKeyUsage } from '../db';

// 每个 API Key 每天的使用限制（仅用于显示，不再阻止调用）
const DAILY_LIMIT = 20;

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)，使用太平洋时间
 * 用户在太平洋时间凌晨统一更新额度
 */
const getTodayDate = (): string => {
  const now = new Date();
  // 太平洋时区：PST (UTC-8) 或 PDT (UTC-7)
  // 使用 toLocaleString 获取太平洋时间
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 添加新的 API Key
 */
export const addApiKey = async (key: string): Promise<ApiKeyRecord> => {
  const record: ApiKeyRecord = {
    id: generateId(),
    key: key.trim(),
    createdAt: Date.now()
  };
  await db.apiKeys.add(record);
  return record;
};

/**
 * 删除 API Key
 */
export const removeApiKey = async (id: string): Promise<void> => {
  await db.apiKeys.delete(id);
  // 同时删除相关的使用记录
  await db.apiKeyUsage.where('keyId').equals(id).delete();
};

/**
 * 获取所有 API Keys
 */
export const getAllApiKeys = async (): Promise<ApiKeyRecord[]> => {
  return await db.apiKeys.orderBy('createdAt').toArray();
};

/**
 * 获取某个 key 今日的使用次数
 */
export const getTodayUsage = async (keyId: string): Promise<number> => {
  const today = getTodayDate();
  const usageId = `${keyId}_${today}`;
  const usage = await db.apiKeyUsage.get(usageId);
  return usage ? usage.count : 0;
};

/**
 * 记录一次 API Key 使用
 */
export const recordUsage = async (keyId: string): Promise<void> => {
  const today = getTodayDate();
  const usageId = `${keyId}_${today}`;
  
  const existing = await db.apiKeyUsage.get(usageId);
  if (existing) {
    await db.apiKeyUsage.update(usageId, { count: existing.count + 1 });
  } else {
    await db.apiKeyUsage.add({
      id: usageId,
      keyId,
      date: today,
      count: 1
    });
  }
};

/**
 * 获取可用的 API Key
 * 随机选择一个 key（不再限制每日使用次数，仅记录）
 */
export const getAvailableKey = async (): Promise<{ id: string; key: string } | null> => {
  const allKeys = await getAllApiKeys();
  if (allKeys.length === 0) {
    return null;
  }

  // 随机选择一个 key（不再过滤超过限制的 key）
  const randomIndex = Math.floor(Math.random() * allKeys.length);
  const selected = allKeys[randomIndex];
  
  return { id: selected.id, key: selected.key };
};

/**
 * 获取所有 key 及其今日使用情况
 */
export interface ApiKeyWithUsage {
  id: string;
  key: string;
  maskedKey: string;  // 脱敏显示
  createdAt: number;
  todayUsage: number;
  isExhausted: boolean;
}

/**
 * 脱敏显示 API Key
 */
const maskApiKey = (key: string): string => {
  if (key.length <= 8) {
    return '***' + key.slice(-4);
  }
  return key.slice(0, 4) + '***' + key.slice(-4);
};

/**
 * 获取所有 key 及其使用统计
 */
export const getAllKeysWithUsage = async (): Promise<ApiKeyWithUsage[]> => {
  const allKeys = await getAllApiKeys();
  const today = getTodayDate();
  
  const result: ApiKeyWithUsage[] = [];
  
  for (const keyRecord of allKeys) {
    const usageId = `${keyRecord.id}_${today}`;
    const usage = await db.apiKeyUsage.get(usageId);
    const todayUsage = usage ? usage.count : 0;
    
    result.push({
      id: keyRecord.id,
      key: keyRecord.key,
      maskedKey: maskApiKey(keyRecord.key),
      createdAt: keyRecord.createdAt,
      todayUsage,
      isExhausted: todayUsage >= DAILY_LIMIT
    });
  }
  
  return result;
};

/**
 * 获取每日使用限制常量
 */
export const getDailyLimit = (): number => {
  return DAILY_LIMIT;
};

/**
 * 将某个 key 标记为今日已用完（例如收到 429 错误时调用）
 * 将其使用次数设置为限制值，确保今日不再被选用
 */
export const markKeyAsExhausted = async (keyId: string): Promise<void> => {
  const today = getTodayDate();
  const usageId = `${keyId}_${today}`;
  
  const existing = await db.apiKeyUsage.get(usageId);
  if (existing) {
    await db.apiKeyUsage.update(usageId, { count: DAILY_LIMIT });
  } else {
    await db.apiKeyUsage.add({
      id: usageId,
      keyId,
      date: today,
      count: DAILY_LIMIT
    });
  }
};
