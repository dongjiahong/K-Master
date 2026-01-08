import { GoogleGenAI } from "@google/genai";
import { Trade, KLineData } from '../types';
import { getAvailableKey, recordUsage, markKeyAsExhausted } from './apiKeyService';
import { getSetting, SETTINGS_KEYS, DEFAULT_MODEL } from '../db';

const DEFAULT_SYSTEM_INSTRUCTION = `
你是一位拥有20年经验的华尔街职业加密货币交易教练。你的风格是：
1. **犀利直接**：不要说废话，直接指出操作的优缺点。
2. **幽默风趣**：适当使用俏皮话、Emoji，让枯燥的交易变得有趣。
3. **Markdown高手**：使用 Markdown 格式美化输出。
    *   **加粗**重点内容。
    *   使用列表清晰表达。
    *   如果操作很烂，可以用 > 引用块嘲讽一下。
    *   如果操作很棒，用 🎉 庆祝。
4. **数据分析**：我会提供 K 线数据，请结合数据中的形态（如均线排列、成交量变化、支撑阻力位）进行分析。
5. **注重结构位置**： 结构位置和趋势是否合理更加重要。
6. **关注盈亏比与逻辑**：不仅看结果，更看入场逻辑是否符合 K 线形态（如吞没、Pinbar、突破等）和趋势。
7. **预测未来**：如果接下来价格走到 xx，形成yy，并出现 zz 信号那么可以做(多/空)，（止盈价格|止损价格)理由..
`;

// 获取用户选择的模型
const getSelectedModel = async (): Promise<string> => {
  const saved = await getSetting(SETTINGS_KEYS.SELECTED_MODEL);
  return saved || DEFAULT_MODEL;
};

// 格式化 K 线数据为文本
const formatCandles = (candles: KLineData[], limit: number = 200) => {
  const recent = candles.slice(-limit);
  return recent.map(c => 
    `${new Date(c.timestamp).toISOString().slice(0,16)} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`
  ).join('\n');
};

export const analyzeTrade = async (
  trade: Trade,
  ltfCandles: KLineData[],
  htfCandles: KLineData[],
  customPrompt?: string
): Promise<string> => {
  
  const activeSystemInstruction = customPrompt && customPrompt.trim().length > 0 
      ? customPrompt 
      : DEFAULT_SYSTEM_INSTRUCTION;

  // 格式化 K 线数据
  const ltfData = formatCandles(ltfCandles, 100);
  const htfData = formatCandles(htfCandles, 50);
  
  // 计算关键指标
  const currentPrice = ltfCandles[ltfCandles.length - 1]?.close || trade.entryPrice;
  const ltfHigh = Math.max(...ltfCandles.slice(-30).map(c => c.high));
  const ltfLow = Math.min(...ltfCandles.slice(-30).map(c => c.low));

  const textPrompt = `
请结合提供的 K 线数据，对这笔交易进行评价并打分(x/10)。

## 交易环境
- **标的**: ${trade.symbol}
- **当前价格**: ${currentPrice.toFixed(2)}
- **近期高点**: ${ltfHigh.toFixed(2)}
- **近期低点**: ${ltfLow.toFixed(2)}

## 交易详情
- **方向**: ${trade.direction}
- **入场价**: ${trade.entryPrice}
- **止盈**: ${trade.tp}
- **止损**: ${trade.sl}
- **交易理由**: ${trade.reason}
- **盈亏比**: ${Math.abs((trade.tp - trade.entryPrice) / (trade.entryPrice - trade.sl)).toFixed(2)}

## 大周期 K 线数据 (最近 ${Math.min(htfCandles.length, 50)} 根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${htfData}
\`\`\`

## 小周期 K 线数据 (最近 ${Math.min(ltfCandles.length, 100)} 根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${ltfData}
\`\`\`

请重点关注：
1. 大周期趋势是否配合？
2. 入场位置是否合理？
3. 成交量是否有异常？
4. 盈亏比是否合适？
`;

  // 动态获取可用的 API Key
  const availableKey = await getAvailableKey();
  if (!availableKey) {
    return "⚠️ 没有可用的 API Key，请在设置中添加，或所有 Key 今日已达使用上限。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: availableKey.key });
    const selectedModel = await getSelectedModel();
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: textPrompt, 
      config: {
        systemInstruction: activeSystemInstruction,
        temperature: 0.7,
      }
    });
    
    // 记录使用次数
    await recordUsage(availableKey.id);
    
    return response.text || "AI 正在思考人生，暂时无法评价...";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.status === 429 || error?.message?.includes('429')) {
      await markKeyAsExhausted(availableKey.id);
      return "⚠️ 当前 API Key 已达调用限制 (429)，请稍后重试或添加更多 Key。";
    }
    return "AI 教练掉线了 (API Error)，请检查网络或 Key。";
  }
};

// 复盘分析系统指令
const REVIEW_SYSTEM_INSTRUCTION = `
你是一位拥有20年经验的华尔街职业加密货币交易教练。你现在需要对一笔已平仓的交易进行复盘分析。

## 复盘分析要点
1. **结果分析**：这笔交易是止盈还是止损，盈亏多少。
2. **入场回顾**：入场时的理由是否合理，入场点位是否恰当。
3. **执行评价**：止盈止损设置是否合理，实际走势是否符合预期。
4. **经验总结**：从这笔交易中可以学到什么，下次如何改进。

## 输出格式
使用 Markdown 格式，结构清晰：
- 用 emoji 增加可读性
- 用 **加粗** 突出重点
- 给出一个明确的评分（x/10）
- 如果是好的交易，要肯定；如果是差的交易，要指出问题但不要打击信心

## 风格
- 犀利直接，不说废话
- 适当幽默
- 复盘重点是学习和成长
`;

// 交易复盘分析（平仓后调用）
export const reviewClosedTrade = async (
  trade: Trade,
  ltfCandles: KLineData[],
  htfCandles: KLineData[],
  customPrompt?: string
): Promise<string> => {
  
  const activeSystemInstruction = customPrompt && customPrompt.trim().length > 0 
      ? customPrompt 
      : REVIEW_SYSTEM_INSTRUCTION;

  // 格式化 K 线数据
  const ltfData = formatCandles(ltfCandles, 100);
  const htfData = formatCandles(htfCandles, 50);
  
  // 计算关键指标
  const pnlPercent = ((trade.pnl / (trade.entryPrice * trade.quantity)) * 100).toFixed(2);
  const rrRatio = Math.abs((trade.tp - trade.entryPrice) / (trade.entryPrice - trade.sl)).toFixed(2);
  
  // 交易结果描述
  const resultType = trade.status === 'CLOSED_TP' ? '✅ 止盈平仓' : trade.status === 'CLOSED_SL' ? '❌ 止损平仓' : '📋 手动平仓';
  const holdingTime = trade.exitTime && trade.entryTime ? Math.round((trade.exitTime - trade.entryTime) / 60000) : 0;

  const textPrompt = `
请对这笔已平仓的交易进行复盘分析。

## 交易概要
- **标的**: ${trade.symbol}
- **方向**: ${trade.direction}
- **结果**: ${resultType}

## 入场信息
- **入场价**: ${trade.entryPrice.toFixed(2)}
- **入场时间**: ${new Date(trade.entryTime).toLocaleString()}
- **预设止盈**: ${trade.tp.toFixed(2)}
- **预设止损**: ${trade.sl.toFixed(2)}
- **计划盈亏比**: 1:${rrRatio}

## 入场理由（我的下单逻辑）
${trade.reason || '未填写下单理由'}

## 实际执行结果
- **出场价**: ${trade.exitPrice?.toFixed(2) || 'N/A'}
- **出场时间**: ${trade.exitTime ? new Date(trade.exitTime).toLocaleString() : 'N/A'}
- **持仓时长**: ${holdingTime} 分钟
- **盈亏金额**: ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
- **盈亏比例**: ${pnlPercent}%

## 大周期 K 线数据 (入场到出场期间, 最近 ${Math.min(htfCandles.length, 50)} 根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${htfData}
\`\`\`

## 小周期 K 线数据 (入场到出场期间, 最近 ${Math.min(ltfCandles.length, 100)} 根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${ltfData}
\`\`\`

请复盘分析：
1. **入场理由评价**：我的下单理由是否合理？入场点位是否恰当？
2. **止盈止损评价**：预设的止盈止损是否合理？有没有更好的设置方式？
3. **走势分析**：根据 K 线数据，价格最终如何走到出场位？是否符合预期？
4. **经验总结**：这笔交易做对了什么？做错了什么？下次如何改进？
5. **评分**：综合评价并给出 x/10 分
`;

  // 动态获取可用的 API Key
  const availableKey = await getAvailableKey();
  if (!availableKey) {
    return "⚠️ 没有可用的 API Key，请在设置中添加，或所有 Key 今日已达使用上限。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: availableKey.key });
    const selectedModel = await getSelectedModel();
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: textPrompt, 
      config: {
        systemInstruction: activeSystemInstruction,
        temperature: 0.7,
      }
    });
    
    // 记录使用次数
    await recordUsage(availableKey.id);
    
    return response.text || "AI 正在思考人生，暂时无法复盘...";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.status === 429 || error?.message?.includes('429')) {
      await markKeyAsExhausted(availableKey.id);
      return "⚠️ 当前 API Key 已达调用限制 (429)，请稍后重试或添加更多 Key。";
    }
    return "AI 教练掉线了 (API Error)，请检查网络或 Key。";
  }
};

export const generateGameReport = async (trades: Trade[], customPrompt?: string): Promise<string> => {
    if (trades.length === 0) return "你还没有做任何交易，这就是所谓 '空仓是最高的智慧' 吗？😂";

    // 按入场时间正序排列（最早的交易在前面）
    const sortedTrades = [...trades].sort((a, b) => a.entryTime - b.entryTime);

    const wins = sortedTrades.filter(t => t.pnl > 0).length;
    const totalPnl = sortedTrades.reduce((acc, t) => acc + t.pnl, 0);
    
    const activeSystemInstruction = customPrompt && customPrompt.trim().length > 0 
      ? customPrompt 
      : DEFAULT_SYSTEM_INSTRUCTION;

    const prompt = `
    复盘总结时间！
    
    总交易数: ${sortedTrades.length}
    胜场: ${wins}
    总盈亏: ${totalPnl.toFixed(2)}
    
    交易记录摘要 (按时间顺序):
    ${sortedTrades.map((t, i) => `${i+1}. [${new Date(t.entryTime).toLocaleString()}] ${t.direction} ${t.symbol} PnL:${t.pnl.toFixed(2)} 原因:${t.reason}`).join('\n')}
    
    请给这位交易员写一份终局总结报告，包含评分（S/A/B/C/D）和改进建议。
    `;

    // 动态获取可用的 API Key
    const availableKey = await getAvailableKey();
    if (!availableKey) {
      return "⚠️ 没有可用的 API Key，请在设置中添加，或所有 Key 今日已达使用上限。";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: availableKey.key });
        const selectedModel = await getSelectedModel();
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: prompt,
            config: {
                systemInstruction: activeSystemInstruction
            }
        });
        
        // 记录使用次数
        await recordUsage(availableKey.id);
        
        return response.text || "无法生成报告。";
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        // 如果是 429 错误，标记该 key 今日已用完
        if (error?.status === 429 || error?.message?.includes('429')) {
          await markKeyAsExhausted(availableKey.id);
          return "⚠️ 当前 API Key 已达调用限制 (429)，请稍后重试或添加更多 Key。";
        }
        return "报告生成失败。";
    }
}

// 盘面解读专用系统指令
const MARKET_ANALYSIS_INSTRUCTION = `
你是一位拥有20年经验的华尔街职业加密货币交易分析师。你的任务是对当前盘面进行全面解读和预测。

## 输出格式要求
使用 Markdown 格式美化输出，包含以下模块：

### 📊 大周期分析
- 趋势方向（多头/空头/震荡）
- 关键支撑/阻力位
- 结构特征

### 📈 小周期分析
- 当前形态与结构
- 短期趋势强度
- K 线信号（如吞没、Pinbar、十字星等）

### 📍 位置分析
- 当前价格相对于大周期的位置
- 是否处于供需区附近
- 距离关键位置的距离

### 🔥 供需区识别
- 重要供给区（上方阻力）
- 重要需求区（下方支撑）
- 当前区域的强弱

### 📦 成交量分析
- 量能变化趋势
- 放量/缩量情况
- 量价配合关系

### 🔮 未来走势预测

#### 情景一：看多 📈
> 如果价格到达 [价位]，并出现 [信号]，那么...
- 预期目标位
- 止损参考位
- 成功概率评估

#### 情景二：看空 📉
> 如果价格到达 [价位]，并出现 [信号]，那么...
- 预期目标位
- 止损参考位
- 成功概率评估

#### 情景三：震荡 ↔️
> 如果价格在 [区间] 内震荡，那么...
- 区间上下沿
- 观望条件

### 🎯 我的倾向
**当前倾向：[多/空/观望]**

**依据：**
1. [理由1]
2. [理由2]
3. [理由3]

**风险提示：**
- [需要注意的风险点]
`;

export const analyzeMarket = async (
  symbol: string,
  ltfTimeframe: string,
  htfTimeframe: string,
  ltfCandles: KLineData[],
  htfCandles: KLineData[],
  customPrompt?: string
): Promise<string> => {
  
  const activeSystemInstruction = customPrompt && customPrompt.trim().length > 0 
      ? customPrompt 
      : MARKET_ANALYSIS_INSTRUCTION;

  // 格式化 K 线数据为文本
  const formatCandles = (candles: KLineData[], limit: number = 200) => {
    const recent = candles.slice(-limit);
    return recent.map(c => 
      `${new Date(c.timestamp).toISOString().slice(0,16)} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`
    ).join('\n');
  };

  const ltfData = formatCandles(ltfCandles, 200);
  const htfData = formatCandles(htfCandles, 100);
  
  // 计算一些关键指标
  const currentPrice = ltfCandles[ltfCandles.length - 1]?.close || 0;
  const ltfHigh = Math.max(...ltfCandles.slice(-50).map(c => c.high));
  const ltfLow = Math.min(...ltfCandles.slice(-50).map(c => c.low));
  const htfHigh = Math.max(...htfCandles.slice(-20).map(c => c.high));
  const htfLow = Math.min(...htfCandles.slice(-20).map(c => c.low));

  const textPrompt = `
请对当前盘面进行全面解读和预测分析。

## 交易环境
- **标的**: ${symbol}
- **小周期 (LTF)**: ${ltfTimeframe}
- **大周期 (HTF)**: ${htfTimeframe}
- **当前价格**: ${currentPrice.toFixed(2)}

## 关键价位参考
- 小周期50根K线高点: ${ltfHigh.toFixed(2)}
- 小周期50根K线低点: ${ltfLow.toFixed(2)}
- 大周期20根K线高点: ${htfHigh.toFixed(2)}
- 大周期20根K线低点: ${htfLow.toFixed(2)}

## 大周期 K 线数据 (${htfTimeframe}, 最近 ${htfCandles.length} 根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${htfData}
\`\`\`

## 小周期 K 线数据 (${ltfTimeframe}, 最近 ${ltfCandles.length} 根，限显示200根)
\`\`\`
时间 | 开盘 | 最高 | 最低 | 收盘 | 成交量
${ltfData}
\`\`\`

请结合上述 K 线数据，从大周期趋势、小周期结构、当前位置、供需区、K 线信号、成交量等多个维度进行综合分析，并给出未来三种可能走势（多/空/震荡）的具体预测和你的倾向选择。
`;

  // 动态获取可用的 API Key
  const availableKey = await getAvailableKey();
  if (!availableKey) {
    return "⚠️ 没有可用的 API Key，请在设置中添加，或所有 Key 今日已达使用上限。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: availableKey.key });
    const selectedModel = await getSelectedModel();
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: textPrompt, 
      config: {
        systemInstruction: activeSystemInstruction,
        temperature: 0.7,
      }
    });
    
    // 记录使用次数
    await recordUsage(availableKey.id);
    
    return response.text || "AI 正在思考人生，暂时无法分析...";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 如果是 429 错误，标记该 key 今日已用完
    if (error?.status === 429 || error?.message?.includes('429')) {
      await markKeyAsExhausted(availableKey.id);
      return "⚠️ 当前 API Key 已达调用限制 (429)，请稍后重试或添加更多 Key。";
    }
    return "AI 分析师掉线了 (API Error)，请检查网络或 Key。";
  }
};