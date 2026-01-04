# 📈 K-Line Master AI (K 线大师 AI 版)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2.svg)

**K-Line Master AI** 是一个专业的加密货币交易模拟训练系统。它结合了真实的 K 线回放功能、双周期（大小周期）分析以及由 Google Gemini 驱动的 AI 交易教练，旨在帮助交易员在无风险的环境中磨练盘感、验证策略并获得实时反馈。

## ✨ 核心特性

*   **📊 双周期同屏分析 (Dual-Timeframe)**
    *   左侧显示大周期（HTF，如 4小时/日线）提供趋势背景。
    *   右侧显示小周期（LTF，如 5分钟/15分钟）进行入场操作。
    *   数据实时同步，完美模拟真实看盘体验。

*   **🤖 AI 智能教练 (Gemini Powered)**
    *   **实时评价**：每笔交易开仓时，AI 会根据截图和市场结构分析你的入场逻辑、盈亏比和趋势一致性。
    *   **终局报告**：游戏结束时，AI 会生成一份风格幽默且犀利的 Markdown 格式总结报告，包含评分和改进建议。
    *   **多模态视觉**：AI 能够“看见”图表，识别吞没、Pinbar 等形态。

*   **⏪ 深度复盘系统 (Time Travel)**
    *   **时光倒流**：随时点击历史交易记录，图表自动回滚到开仓时刻。
    *   **历史战绩**：按交易场景（币种+时间+周期）归档，方便对比不同策略的表现。
    *   **断点续传**：自动保存当前进度，随时继续未完成的交易局。

*   **🛠 专业级模拟体验**
    *   基于 `klinecharts` 的高性能图表。
    *   支持多倍速回放、暂停、单步前进。
    *   真实 Binance 历史数据拉取。
    *   做多/做空机制，自动计算 TP/SL（止盈止损）。

*   **💾 本地化存储**
    *   使用 IndexedDB (`Dexie.js`) 在本地浏览器存储所有交易数据和设置，无需后端数据库。

## 🛠 技术栈

*   **前端框架**: React 19, TypeScript
*   **构建/运行**: ESM Modules (无需繁琐打包，通过 CDN 引入)
*   **样式库**: Tailwind CSS (支持深色/浅色模式)
*   **图表库**: KLineCharts
*   **AI 模型**: Google Gemini API (`@google/genai`)
*   **图标库**: Lucide React
*   **数据存储**: Dexie.js (IndexedDB wrapper)
*   **Markdown 渲染**: React Markdown + Remark GFM

## 🚀 快速开始

### 前置要求

你需要一个有效的 Google Gemini API Key。

### 安装与运行

1.  **克隆项目**
    ```bash
    git clone https://github.com/your-username/kline-master-ai.git
    cd kline-master-ai
    ```

2.  **配置环境**
    本项目设计为在支持 ESM 的环境中运行。如果你使用 Vite 或类似的构建工具：
    
    创建 `.env` 文件（如果使用构建工具）或确保在运行时环境变量中配置：
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```
    *(注：在当前演示代码结构中，`process.env.API_KEY` 需要构建工具注入)*

3.  **安装依赖**
    ```bash
    npm install
    ```

4.  **启动项目**
    ```bash
    npm run dev
    ```

## 🎮 操作指南

1.  **开始游戏**：选择币种（如 BTCUSDT）和时间周期，系统将随机抽取一段历史行情。
2.  **分析盘面**：观察左侧大周期确定方向，右侧小周期寻找形态。
3.  **模拟交易**：
    *   点击 `Long` 或 `Short`。
    *   设置止损 (SL) 和 止盈 (TP)。
    *   填写交易理由（AI 会根据你的理由和图表进行评价）。
4.  **控制节奏**：使用底部播放控制条加速行情或单步前进。
5.  **结束复盘**：点击“结束本局”，查收 AI 生成的终局诊断报告。

## 📂 目录结构

```
.
├── index.html              # 入口 HTML (包含 Import Map)
├── index.tsx               # React 入口
├── App.tsx                 # 主应用组件
├── db.ts                   # IndexedDB 数据库配置
├── metadata.json           # 项目元数据
├── types.ts                # TypeScript 类型定义
├── components/             # UI 组件
│   ├── DashboardPanel.tsx  # 仪表盘与 AI 报告展示
│   ├── TradePanel.tsx      # 下单与 AI 分析面板
│   ├── GameHistoryPanel.tsx# 历史记录侧边栏
│   ├── MarkdownRenderer.tsx# Markdown 渲染器
│   ├── SettingsModal.tsx   # 设置弹窗
│   ├── FloatingPanel.tsx   # 可拖拽悬浮窗基类
│   └── ...
└── services/               # 业务逻辑服务
    ├── binanceService.ts   # 获取 K 线数据
    └── geminiService.ts    # AI 交互逻辑
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！如果你有更好的 AI Prompt 调优建议或新功能想法，请随时分享。

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。
