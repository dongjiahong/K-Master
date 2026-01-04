import { GoogleGenAI } from "@google/genai";
import { Trade, KLineData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
你是一位拥有20年经验的华尔街职业加密货币交易教练。你的风格是：
1.  **犀利直接**：不要说废话，直接指出操作的优缺点。
2.  **幽默风趣**：适当使用俏皮话、Emoji，让枯燥的交易变得有趣。
3.  **Markdown高手**：使用 Markdown 格式美化输出。
    *   **加粗**重点内容。
    *   使用列表清晰表达。
    *   如果操作很烂，可以用 > 引用块嘲讽一下。
    *   如果操作很棒，用 🎉 庆祝。
4.  **关注盈亏比与逻辑**：不仅看结果，更看入场逻辑是否符合 K 线形态（如吞没、Pinbar、突破等）和趋势。
5.  **多模态分析**：我会提供 K 线图的截图，请结合图片中的形态（如均线排列、成交量变化、支撑阻力位）进行分析。
`;

// Helper to extract MIME type and data from Data URL
const getInlineData = (dataUrl: string) => {
    // Data URL format: data:[<mediatype>][;base64],<data>
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
        return { mimeType: matches[1], data: matches[2] };
    }
    // Fallback if regex fails (shouldn't happen for valid Data URLs)
    const parts = dataUrl.split(',');
    return { mimeType: 'image/jpeg', data: parts[1] };
};

export const analyzeTrade = async (
  trade: Trade,
  recentCandles: KLineData[],
  ltfImage?: string,
  htfImage?: string,
  customPrompt?: string
): Promise<string> => {
  
  // 提取最近 10 根 K 线作为上下文 (Text backup)
  const context = recentCandles.slice(-10).map(c => 
    `T:${new Date(c.timestamp).toISOString().slice(11,16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
  ).join('\n');

  const textPrompt = `
  ${customPrompt || "请评价我的这笔交易并进行打分(x/10)："}
  
  **交易环境**:
  - 标的: ${trade.symbol}
  - 交易周期: ${"参见截图"} (LTF)
  
  **交易详情**:
  - 方向: ${trade.direction}
  - 入场价: ${trade.entryPrice}
  - 止盈: ${trade.tp}
  - 止损: ${trade.sl}
  - 理由: ${trade.reason}
  
  **最近数据**:
  ${context}
  
  请结合提供的 K 线图截图（包含大小周期）和上述数据，给出深刻的实时评价。重点关注：
  1. 大周期趋势是否配合？
  2. 入场位置是否合理？
  3. 成交量是否有异常？
  4. 盈亏比是否合适？
  `;

  const parts: any[] = [{ text: textPrompt }];

  if (htfImage) {
    parts.push({ text: "【大周期趋势图 (Context)】：" });
    const { mimeType, data } = getInlineData(htfImage);
    if (data) {
        parts.push({ inlineData: { mimeType, data } });
    }
  }

  if (ltfImage) {
    parts.push({ text: "【交易周期图 (Trading)】：" });
    const { mimeType, data } = getInlineData(ltfImage);
    if (data) {
        parts.push({ inlineData: { mimeType, data } });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Updated to Gemini 3 Flash
      contents: parts.length > 1 ? { parts } : textPrompt, // Fix structure for multimodal
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });
    
    return response.text || "AI 正在思考人生，暂时无法评价...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 教练掉线了 (API Error)，请检查网络或 Key。";
  }
};

export const generateGameReport = async (trades: Trade[]): Promise<string> => {
    if (trades.length === 0) return "你还没有做任何交易，这就是所谓 '空仓是最高的智慧' 吗？😂";

    const wins = trades.filter(t => t.pnl > 0).length;
    const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
    
    const prompt = `
    复盘总结时间！
    
    总交易数: ${trades.length}
    胜场: ${wins}
    总盈亏: ${totalPnl.toFixed(2)}
    
    交易记录摘要:
    ${trades.map((t, i) => `${i+1}. ${t.direction} ${t.symbol} PnL:${t.pnl} 原因:${t.reason}`).join('\n')}
    
    请给这位交易员写一份终局总结报告，包含评分（S/A/B/C/D）和改进建议。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION
            }
        });
        return response.text || "无法生成报告。";
    } catch (e) {
        return "报告生成失败。";
    }
}