import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KLineData, Timeframe, Trade, GameSession } from './types';
import { getHigherTimeframe, fetchMarketData, timeframeToMs, generateRandomMarketEndTime } from './services/binanceService';
import { analyzeTrade, generateGameReport, analyzeMarket, reviewClosedTrade } from './services/geminiService';
import { db, getSetting, saveSetting, SETTINGS_KEYS } from './db';

import TradePanel from './components/TradePanel';
import GameHistoryPanel from './components/GameHistoryPanel';
import DashboardPanel from './components/DashboardPanel';
import SettingsPanel from './components/SettingsModal';
import SessionRestoreModal from './components/SessionRestoreModal';
import ConfirmDialog from './components/ConfirmDialog';
import Header from './components/Header';
import GameCharts, { GameChartsRef } from './components/GameCharts';
import MarketAnalysisPanel from './components/MarketAnalysisPanel';

// Constants
const INITIAL_BALANCE = 10000;
const PRELOAD_COUNT = 200; 
const SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];
const SUPPORTED_TIMEFRAMES = [Timeframe.M5, Timeframe.M15, Timeframe.M30, Timeframe.H1, Timeframe.H4, Timeframe.D1];

type SidebarView = 'DASHBOARD' | 'TRADE_PANEL' | 'HISTORY_PANEL' | 'SETTINGS' | 'MARKET_ANALYSIS';

const App: React.FC = () => {
  // --- UI State ---
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // --- Game State ---
  const [session, setSession] = useState<GameSession | null>(null);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  
  // Settings State
  const [configSymbol, setConfigSymbol] = useState('BTCUSDT');
  const [configTimeframe, setConfigTimeframe] = useState<Timeframe>(Timeframe.M5);
  
  // Data State
  const [allCandles, setAllCandles] = useState<KLineData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [htfHistory, setHtfHistory] = useState<KLineData[]>([]);
  const [currentHtfCandle, setCurrentHtfCandle] = useState<KLineData | null>(null);
  
  // Ref to hold the current HTF candle for synchronous logic (avoids stale closures in interval)
  const htfCandleLogicRef = useRef<KLineData | null>(null);

  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(1000); 
  
  // UI Panels / Sidebar
  const [sidebarView, setSidebarView] = useState<SidebarView>('DASHBOARD');
  const [historyPanelWidth, setHistoryPanelWidth] = useState(() => Math.max(350, Math.min(800, window.innerWidth / 3)));
  const [isResizingHistory, setIsResizingHistory] = useState(false);
  
  // Trade Panel Specifics
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [comparisonStats, setComparisonStats] = useState<any[]>([]);
  const [customPrompt, setCustomPromptState] = useState<string>('');
  
  // 盘面解读状态（临时数据，不存储）
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [isMarketAnalyzing, setIsMarketAnalyzing] = useState(false);
  
  // 预览止盈止损价格（下单面板输入时显示在 K 线图上）
  const [previewPrices, setPreviewPrices] = useState<{tp: number | null, sl: number | null, direction: 'LONG' | 'SHORT'} | null>(null);
  
  // Modals
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestoreSession, setPendingRestoreSession] = useState<GameSession | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void;}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // History Data
  const [pastSessions, setPastSessions] = useState<GameSession[]>([]);
  const [pastTrades, setPastTrades] = useState<Record<number, Trade[]>>({});
  
  // Review Mode State
  const [isReviewingHistory, setIsReviewingHistory] = useState(false);

  // --- Refs ---
  const chartRef = useRef<GameChartsRef>(null);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeHistoryRef = useRef<Trade[]>([]);
  const lastPlayedIndexRef = useRef<number>(0);

  // --- Effects ---
  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory]);

  useEffect(() => {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
  }, [theme]);

  // Mobile Detection
  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize
  useEffect(() => {
    const checkActiveSession = async () => {
        const active = await db.games.where({ status: 'ACTIVE' }).first();
        if (active) {
            setPendingRestoreSession(active);
            setShowRestoreModal(true);
        } else {
            startNewGame();
        }
    };
    checkActiveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从 IndexedDB 加载用户设置
  useEffect(() => {
    const loadSettings = async () => {
      const savedPrompt = await getSetting(SETTINGS_KEYS.CUSTOM_PROMPT);
      if (savedPrompt) {
        setCustomPromptState(savedPrompt);
      }
    };
    loadSettings();
  }, []);

  // 包装 setCustomPrompt，自动保存到 IndexedDB
  const setCustomPrompt = useCallback((value: string) => {
    setCustomPromptState(value);
    saveSetting(SETTINGS_KEYS.CUSTOM_PROMPT, value);
  }, []);

  // 处理预览止盈止损价格变化
  const handlePreviewPricesChange = useCallback((tp: number | null, sl: number | null, direction: 'LONG' | 'SHORT') => {
    if (tp === null && sl === null) {
      setPreviewPrices(null);
    } else {
      setPreviewPrices({ tp, sl, direction });
    }
  }, []);

  // --- Logic: HTF Calculation ---
  const updateHtfWithLtf = useCallback((ltfCandle: KLineData, htfTf: Timeframe) => {
      const htfMs = timeframeToMs(htfTf);
      const htfStartTime = Math.floor(ltfCandle.timestamp / htfMs) * htfMs;
      
      const prev = htfCandleLogicRef.current;
      let nextHtfCandle: KLineData;

      if (prev && prev.timestamp !== htfStartTime) {
          // New Candle Started: Commit previous to history
          setHtfHistory(history => {
              // Deduplicate just in case
              if (history.length > 0 && history[history.length-1].timestamp === prev.timestamp) return history;
              return [...history, prev];
          });

          // Create new candle
          nextHtfCandle = {
              timestamp: htfStartTime,
              open: ltfCandle.open,
              high: ltfCandle.high,
              low: ltfCandle.low,
              close: ltfCandle.close,
              volume: ltfCandle.volume,
              turnover: ltfCandle.turnover
          };
      } else if (prev) {
          // Update existing candle
          nextHtfCandle = {
              ...prev,
              high: Math.max(prev.high, ltfCandle.high),
              low: Math.min(prev.low, ltfCandle.low),
              close: ltfCandle.close,
              volume: prev.volume + ltfCandle.volume 
          };
      } else {
          // Initialize first candle
          nextHtfCandle = {
              timestamp: htfStartTime,
              open: ltfCandle.open,
              high: ltfCandle.high,
              low: ltfCandle.low,
              close: ltfCandle.close,
              volume: ltfCandle.volume,
              turnover: ltfCandle.turnover
          };
      }
      
      // Update Ref (Sync Logic)
      htfCandleLogicRef.current = nextHtfCandle;
      // Update State (Trigger Render)
      setCurrentHtfCandle(nextHtfCandle);
  }, []);

  // --- Helper: Reconstruct HTF from LTF for Review/Resume ---
  const calculateHtfFromLtf = (ltfData: KLineData[], index: number, htfTf: Timeframe): KLineData | null => {
      if (index < 0 || ltfData.length === 0) return null;
      const current = ltfData[index];
      const htfMs = timeframeToMs(htfTf);
      const htfStart = Math.floor(current.timestamp / htfMs) * htfMs;
      
      // Look back to find start
      const relevant = [];
      for (let i = index; i >= 0; i--) {
          if (ltfData[i].timestamp < htfStart) break;
          relevant.unshift(ltfData[i]);
      }
      if (relevant.length === 0) return null;
      
      const res = { ...relevant[0], timestamp: htfStart, volume: 0, turnover: 0 };
      res.close = relevant[relevant.length - 1].close; // Close is last
      relevant.forEach(c => {
          res.high = Math.max(res.high, c.high);
          res.low = Math.min(res.low, c.low);
          res.volume += c.volume;
          if(c.turnover) res.turnover = (res.turnover || 0) + c.turnover;
      });
      return res;
  };

  // --- Game Loop ---
  const nextCandle = useCallback(() => {
    if (isReviewingHistory) return; 

    if (currentIndex >= allCandles.length - 1) {
      handleEndGame(); 
      return;
    }

    const nextIndex = currentIndex + 1;
    const newCandle = allCandles[nextIndex];
    setCurrentIndex(nextIndex);

    if (session) {
        const htf = getHigherTimeframe(session.timeframe);
        updateHtfWithLtf(newCandle, htf);
    }

    if (activeTrade) {
      checkTradeStatus(activeTrade, newCandle);
    }
  }, [currentIndex, allCandles, activeTrade, session, updateHtfWithLtf, isReviewingHistory]);

  useEffect(() => {
    if (isPlaying && !isReviewingHistory) {
      playTimer.current = setInterval(nextCandle, autoPlaySpeed);
    } else if (playTimer.current) {
      clearInterval(playTimer.current);
    }
    return () => { if(playTimer.current) clearInterval(playTimer.current); }
  }, [isPlaying, nextCandle, autoPlaySpeed, isReviewingHistory]);

  // --- Trade Management ---
  const checkTradeStatus = (trade: Trade, candle: KLineData) => {
    let closedStatus: Trade['status'] | null = null;
    let exitPrice = 0;

    if (trade.direction === 'LONG') {
      if (candle.low <= trade.sl) { closedStatus = 'CLOSED_SL'; exitPrice = trade.sl; }
      else if (candle.high >= trade.tp) { closedStatus = 'CLOSED_TP'; exitPrice = trade.tp; }
    } else {
      if (candle.high >= trade.sl) { closedStatus = 'CLOSED_SL'; exitPrice = trade.sl; }
      else if (candle.low <= trade.tp) { closedStatus = 'CLOSED_TP'; exitPrice = trade.tp; }
    }

    if (closedStatus) closeTrade(trade, exitPrice, closedStatus, candle.timestamp);
  };

  const closeTrade = async (trade: Trade, exitPrice: number, status: Trade['status'], exitTime: number) => {
    setIsPlaying(false);
    const pnl = trade.direction === 'LONG' ? (exitPrice - trade.entryPrice) * trade.quantity : (trade.entryPrice - exitPrice) * trade.quantity;
    const closedTrade: Trade = { ...trade, status, exitPrice, exitTime, pnl };

    setBalance(prev => prev + pnl);
    setActiveTrade(null);
    setTradeHistory(prev => prev.map(t => t.id === trade.id ? closedTrade : t));
    setViewingTrade(closedTrade);
    setSidebarView('TRADE_PANEL');
    if (isMobile) setShowMobileSidebar(true);

    await db.trades.put(closedTrade);

    // 止盈或止损平仓时，自动调用 AI 进行复盘分析
    if (status === 'CLOSED_TP' || status === 'CLOSED_SL') {
      setAiLoading(true);
      // 获取入场到出场期间的 K 线数据
      const entryIndex = allCandles.findIndex(c => c.timestamp >= trade.entryTime);
      const exitIndex = allCandles.findIndex(c => c.timestamp >= exitTime);
      const ltfCandles = allCandles.slice(Math.max(0, entryIndex - 50), exitIndex + 1);
      
      // 获取 HTF 数据
      const htfCandlesCopy = [...htfHistory];
      if (currentHtfCandle) {
        const lastHistory = htfCandlesCopy[htfCandlesCopy.length - 1];
        if (lastHistory && lastHistory.timestamp === currentHtfCandle.timestamp) {
          htfCandlesCopy[htfCandlesCopy.length - 1] = currentHtfCandle;
        } else {
          htfCandlesCopy.push(currentHtfCandle);
        }
      }
      
      // 调用复盘分析
      const reviewComment = await reviewClosedTrade(closedTrade, ltfCandles, htfCandlesCopy, customPrompt);
      // 将复盘结果追加到现有的 aiComments 数组
      const existingComments = closedTrade.aiComments || [];
      const reviewedTrade = { 
        ...closedTrade, 
        aiComments: [...existingComments, { type: 'review' as const, content: reviewComment, timestamp: Date.now() }] 
      };
      
      setTradeHistory(prev => prev.map(t => t.id === closedTrade.id ? reviewedTrade : t));
      setViewingTrade(reviewedTrade);
      await db.trades.put(reviewedTrade);
      setAiLoading(false);
    }
  };

  // --- Manual Take Profit / Stop Loss ---
  const handleManualTakeProfit = () => {
    if (!activeTrade) return;
    const currentCandle = allCandles[currentIndex];
    closeTrade(activeTrade, currentCandle.close, 'CLOSED_TP', currentCandle.timestamp);
  };

  const handleManualStopLoss = () => {
    if (!activeTrade) return;
    const currentCandle = allCandles[currentIndex];
    closeTrade(activeTrade, currentCandle.close, 'CLOSED_SL', currentCandle.timestamp);
  };

  // --- Start Game Logic ---
  const startNewGame = async (replayConfig?: { symbol: string, timeframe: Timeframe, marketEndTime: number, parentId?: number }, resumeSession?: GameSession) => {
    setLoading(true);
    setFinalReport(null);
    setComparisonStats([]);
    setViewingTrade(null);
    setActiveTrade(null);
    setIsPlaying(false);
    setIsReviewingHistory(false);
    setTradeHistory([]);
    setSidebarView('DASHBOARD');
    setShowMobileSidebar(false);

    let sessionToUse: GameSession;
    let dataEndTime: number;

    if (resumeSession) {
        sessionToUse = resumeSession;
        dataEndTime = resumeSession.marketEndTime;
        setBalance(resumeSession.initialBalance);
        if (resumeSession.aiReport) setFinalReport(resumeSession.aiReport);
    } else {
        const symbol = replayConfig ? replayConfig.symbol : configSymbol;
        const tf = replayConfig ? replayConfig.timeframe : configTimeframe;
        dataEndTime = replayConfig ? replayConfig.marketEndTime : generateRandomMarketEndTime();
        const newSession: GameSession = { startTime: Date.now(), symbol, timeframe: tf, marketEndTime: dataEndTime, initialBalance: INITIAL_BALANCE, status: 'ACTIVE', parentSessionId: replayConfig?.parentId };
        const id = await db.games.add(newSession);
        sessionToUse = { ...newSession, id: id as number };
        setBalance(INITIAL_BALANCE);
    }

    setSession(sessionToUse);
    const tf = sessionToUse.timeframe;
    const htf = getHigherTimeframe(tf);
    
    const rawData = await fetchMarketData(sessionToUse.symbol, tf, 1000, dataEndTime);
    if (rawData.length < PRELOAD_COUNT) {
      alert("数据获取失败，请重试");
      setLoading(false);
      return;
    }
    setAllCandles(rawData);
    
    // Restore logic
    let startIndex = PRELOAD_COUNT;
    let existingTrades: Trade[] = [];
    if (resumeSession) {
        existingTrades = await db.trades.where('gameId').equals(resumeSession.id!).toArray();
        setTradeHistory(existingTrades);
        const pnl = existingTrades.reduce((acc, t) => acc + t.pnl, 0);
        setBalance(resumeSession.initialBalance + pnl);
        if (existingTrades.length > 0) {
            const lastTradeTime = Math.max(...existingTrades.map(t => t.exitTime || t.entryTime));
            const foundIndex = rawData.findIndex(c => c.timestamp === lastTradeTime);
            if (foundIndex > PRELOAD_COUNT) startIndex = resumeSession.status === 'COMPLETED' ? rawData.length - 1 : foundIndex + 1;
        }
        const openTrade = existingTrades.find(t => t.status === 'OPEN');
        if (openTrade) setActiveTrade(openTrade);
        loadComparisonStats(sessionToUse);
    }

    setCurrentIndex(startIndex);
    lastPlayedIndexRef.current = startIndex;

    // HTF Setup
    const lastLtfCandle = rawData[startIndex];
    const htfDataRaw = await fetchMarketData(sessionToUse.symbol, htf, 500, rawData[rawData.length-1].timestamp);
    const htfMs = timeframeToMs(htf);
    const currentHtfBlockStart = Math.floor(lastLtfCandle.timestamp / htfMs) * htfMs;
    const historicalHtfData = htfDataRaw.filter(d => d.timestamp < currentHtfBlockStart);
    setHtfHistory(historicalHtfData);

    // Initial partial HTF calc
    const ltfCandlesInCurrentHtfBlock = rawData.slice(0, startIndex + 1).filter(c => c.timestamp >= currentHtfBlockStart);
    if (ltfCandlesInCurrentHtfBlock.length > 0) {
        let partialHtf = { ...ltfCandlesInCurrentHtfBlock[0] }; // Simple init
        ltfCandlesInCurrentHtfBlock.forEach(c => {
            partialHtf.high = Math.max(partialHtf.high, c.high);
            partialHtf.low = Math.min(partialHtf.low, c.low);
            partialHtf.close = c.close;
            partialHtf.volume += c.volume;
        });
        partialHtf.timestamp = currentHtfBlockStart; // Ensure alignment
        setCurrentHtfCandle(partialHtf);
        htfCandleLogicRef.current = partialHtf;
    } else {
        setCurrentHtfCandle(null);
        htfCandleLogicRef.current = null;
    }

    setLoading(false);
  };

  // --- Handlers ---
  const handleLoadSession = async (arg: number | GameSession) => {
      setLoading(true);
      const sessionToLoad = typeof arg === 'number' ? await db.games.get(arg) : arg;
      if (!sessionToLoad) { setLoading(false); return; }
      setSidebarView('DASHBOARD');
      await startNewGame(undefined, sessionToLoad);
  };
  const handleEndGame = async () => {
    setIsPlaying(false);
    if (!session || !session.id) return;
    setIsGeneratingReport(true);
    if (activeTrade) await closeTrade(activeTrade, allCandles[currentIndex].close, 'CLOSED_MANUAL', allCandles[currentIndex].timestamp);
    
    // Pass customPrompt to report generation
    const report = await generateGameReport(tradeHistoryRef.current, customPrompt);
    
    setFinalReport(report);
    await db.games.update(session.id, { status: 'COMPLETED', finalBalance: balance, endTime: Date.now(), aiReport: report });
    const updatedSession = { ...session, status: 'COMPLETED' as const, aiReport: report };
    setSession(updatedSession);
    loadComparisonStats(updatedSession);
    setIsGeneratingReport(false);
    setSidebarView('DASHBOARD');
    if (isMobile) setShowMobileSidebar(true);
  };
  const handleOpenTradeModal = (dir: 'LONG' | 'SHORT') => {
    if (activeTrade) return alert("已有持仓，请先平仓");
    setIsPlaying(false);
    setModalDirection(dir);
    setViewingTrade(null);
    setSidebarView('TRADE_PANEL');
    if (isMobile) setShowMobileSidebar(true);
  };
  const executeTrade = async (reason: string, tp: number, sl: number, preAnalysis?: { type: 'analysis' | 'review'; content: string; timestamp: number }[]) => {
    // 下单后清除预览线
    setPreviewPrices(null);
    const currentCandle = allCandles[currentIndex];
    const newTrade: Trade = {
      id: `trade_${Date.now()}`, gameId: session?.id || 0, symbol: session?.symbol || 'BTCUSDT',
      direction: modalDirection, entryPrice: currentCandle.close, tp, sl,
      quantity: (balance * 0.5) / currentCandle.close, entryTime: currentCandle.timestamp,
      status: 'OPEN', pnl: 0, reason, aiComments: preAnalysis
    };
    setActiveTrade(newTrade);
    setTradeHistory(prev => [newTrade, ...prev]);
    setViewingTrade(newTrade);
    await db.trades.add(newTrade);
    // 不再自动调用 AI 分析，用户可以使用 AI 分析按钮手动分析
  };
  const handleAnalyzeTrade = async (reason: string, tp: number, sl: number) => {
      setAiLoading(true);
      const currentCandle = allCandles[currentIndex];
      const tempTrade: Trade = {
          id: 'temp', gameId: 0, symbol: session?.symbol || '', direction: modalDirection,
          entryPrice: currentCandle.close, tp, sl, quantity: 0, entryTime: currentCandle.timestamp, status: 'OPEN', pnl: 0, reason
      };
      
      // 获取 K 线数据
      const ltfCandles = allCandles.slice(0, currentIndex + 1);
      const htfCandles = [...htfHistory];
      if (currentHtfCandle) {
          const lastHistory = htfCandles[htfCandles.length - 1];
          if (lastHistory && lastHistory.timestamp === currentHtfCandle.timestamp) {
              htfCandles[htfCandles.length - 1] = currentHtfCandle;
          } else {
              htfCandles.push(currentHtfCandle);
          }
      }
      
      const comment = await analyzeTrade(tempTrade, ltfCandles, htfCandles, customPrompt);
      setAiLoading(false);
      return comment;
  };
  
  const handleReviewTrade = (trade: Trade) => {
      setIsPlaying(false);
      if (!isReviewingHistory) lastPlayedIndexRef.current = currentIndex;
      setIsReviewingHistory(true);
      const tradeIndex = allCandles.findIndex(c => c.timestamp === trade.entryTime);
      if (tradeIndex !== -1) {
          setCurrentIndex(tradeIndex);
          setViewingTrade(trade);
          setSidebarView('TRADE_PANEL');
          if (isMobile) setShowMobileSidebar(true);
          
          // Update HTF context for review
          const htf = getHigherTimeframe(session!.timeframe);
          // Use calculateHtfFromLtf to get the exact partial candle state at that moment
          const reviewHtfCandle = calculateHtfFromLtf(allCandles, tradeIndex, htf)
             || { timestamp: Math.floor(trade.entryTime / timeframeToMs(htf)) * timeframeToMs(htf), open: trade.entryPrice, high: trade.entryPrice, low: trade.entryPrice, close: trade.entryPrice, volume: 0, turnover: 0 };
          
          setCurrentHtfCandle(reviewHtfCandle);
          htfCandleLogicRef.current = reviewHtfCandle; 
      }
  };

  const handleBackToLive = () => {
      const resumeIndex = lastPlayedIndexRef.current;
      setCurrentIndex(resumeIndex);
      setIsReviewingHistory(false);
      setViewingTrade(null);
      setSidebarView('DASHBOARD');
      
      // Recalculate current HTF from live data
      if (session) {
          const htf = getHigherTimeframe(session.timeframe);
          const restoredHtf = calculateHtfFromLtf(allCandles, resumeIndex, htf);
          setCurrentHtfCandle(restoredHtf);
          htfCandleLogicRef.current = restoredHtf;
      }
  };

  const loadComparisonStats = async (currentSession: GameSession) => {
      const siblings = await db.games.where('marketEndTime').equals(currentSession.marketEndTime)
        .and(g => g.symbol === currentSession.symbol && g.timeframe === currentSession.timeframe && g.status === 'COMPLETED').toArray();
      const stats = await Promise.all(siblings.map(async (g) => {
        const trades = await db.trades.where('gameId').equals(g.id!).toArray();
        return { id: g.id, date: g.startTime, pnl: trades.reduce((acc, t) => acc + t.pnl, 0), isCurrent: g.id === currentSession.id };
      }));
      if (!stats.find(s => s.id === currentSession.id)) {
         const currentTrades = await db.trades.where('gameId').equals(currentSession.id!).toArray();
         stats.push({ id: currentSession.id, date: currentSession.startTime, pnl: currentTrades.reduce((acc,t) => acc+t.pnl, 0), isCurrent: true });
      }
      setComparisonStats(stats.sort((a,b) => b.pnl - a.pnl));
  };

  const handleDeleteHistory = async (sessionsToDelete: GameSession[]) => {
      const gameIds = sessionsToDelete.map(s => s.id!).filter(Boolean);
      await db.trades.where('gameId').anyOf(gameIds).delete();
      await db.games.where('id').anyOf(gameIds).delete();
      if (sidebarView === 'HISTORY_PANEL') loadHistoryAndShowPanel();
  };

  const loadHistoryAndShowPanel = async () => {
      const allSessions = await db.games.where('status').equals('COMPLETED').toArray();
      const allTrades = await db.trades.toArray();
      const tradeMap: Record<number, Trade[]> = {};
      allTrades.forEach(t => { if(!tradeMap[t.gameId]) tradeMap[t.gameId] = []; tradeMap[t.gameId].push(t); });
      setPastSessions(allSessions);
      setPastTrades(tradeMap);
      setSidebarView('HISTORY_PANEL');
      if (isMobile) setShowMobileSidebar(true);
  };

  // --- 盘面解读 ---
  const handleMarketAnalysis = async () => {
      if (!session) return;
      
      const htf = getHigherTimeframe(session.timeframe);
      
      // 获取当前可见的 K 线数据
      const ltfCandles = allCandles.slice(0, currentIndex + 1);
      
      // 获取 HTF 数据（包含当前正在形成的蜡烛）
      const htfCandles = [...htfHistory];
      if (currentHtfCandle) {
          const lastHistory = htfCandles[htfCandles.length - 1];
          if (lastHistory && lastHistory.timestamp === currentHtfCandle.timestamp) {
              htfCandles[htfCandles.length - 1] = currentHtfCandle;
          } else {
              htfCandles.push(currentHtfCandle);
          }
      }
      
      // 更新状态显示加载中
      setIsMarketAnalyzing(true);
      setMarketAnalysis(null);
      setSidebarView('MARKET_ANALYSIS');
      if (isMobile) setShowMobileSidebar(true);
      
      try {
          const result = await analyzeMarket(
              session.symbol,
              session.timeframe,
              htf,
              ltfCandles,
              htfCandles,
              customPrompt
          );
          setMarketAnalysis(result);
      } catch (error) {
          console.error('Market analysis error:', error);
          setMarketAnalysis('⚠️ 盘面解读失败，请检查网络或稍后重试。');
      } finally {
          setIsMarketAnalyzing(false);
      }
  };

  // --- Computed HTF History for Display ---
  // Filters out any completed HTF candles that are ahead of the current simulation time
  const displayedHtfHistory = useMemo(() => {
    if (!currentHtfCandle) return htfHistory;
    return htfHistory.filter(h => h.timestamp < currentHtfCandle.timestamp);
  }, [htfHistory, currentHtfCandle]);

  // --- Render ---
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      <Header 
        session={session} isPlaying={isPlaying} setIsPlaying={setIsPlaying}
        isReviewingHistory={isReviewingHistory} nextCandle={nextCandle}
        currentDisplayIndex={currentIndex} totalCandles={allCandles.length}
        autoPlaySpeed={autoPlaySpeed} setAutoPlaySpeed={setAutoPlaySpeed}
        activeTrade={activeTrade} handleOpenTradeModal={handleOpenTradeModal}
        handleManualTakeProfit={handleManualTakeProfit}
        handleManualStopLoss={handleManualStopLoss}
        loadHistoryAndShowPanel={loadHistoryAndShowPanel} setSidebarView={setSidebarView}
        isMobile={isMobile} onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
        onMarketAnalysis={handleMarketAnalysis}
        isMarketAnalyzing={isMarketAnalyzing}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chart Area */}
        <GameCharts 
          ref={chartRef}
          theme={theme}
          session={session}
          ltfData={allCandles.slice(0, currentIndex + 1)}
          htfData={displayedHtfHistory}
          currentHtfCandle={currentHtfCandle}
          trades={tradeHistory}
          isReviewingHistory={isReviewingHistory}
          onBackToLive={handleBackToLive}
          onCandleClick={(ts) => {
              const trade = tradeHistory.find(t => Math.abs(t.entryTime - ts) < 300000);
              if (trade) handleReviewTrade(trade);
          }}
          previewPrices={previewPrices}
        />
        
        {/* Sidebar (Desktop: Resizable / Mobile: Overlay) */}
        {(!isMobile || showMobileSidebar) && (
             <div 
                 className={`
                    flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 transition-all duration-200 ease-linear z-30
                    ${isMobile ? 'fixed inset-0 w-full' : 'relative'}
                 `}
                 style={{ width: isMobile ? '100%' : historyPanelWidth }}
            >
                 {/* Desktop Resize Handle */}
                 {!isMobile && (
                     <div 
                         className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50"
                         onMouseDown={() => setIsResizingHistory(true)}
                     ></div>
                 )}

                 {/* Sidebar Content */}
                 {sidebarView === 'DASHBOARD' && (
                     <DashboardPanel 
                        balance={balance} initialBalance={INITIAL_BALANCE} session={session}
                        comparisonStats={comparisonStats} loading={loading} isGeneratingReport={isGeneratingReport}
                        finalReport={finalReport} currentTrades={tradeHistory}
                        onReviewTrade={handleReviewTrade}
                        onStartNewGame={() => setConfirmConfig({ isOpen: true, title: '重新开始', message: '确定要放弃当前进度并开始新的一局吗？', onConfirm: () => startNewGame() })}
                        onEndGame={handleEndGame} onLoadSession={handleLoadSession}
                        isReviewingHistory={isReviewingHistory} viewingTradeId={viewingTrade?.id}
                     />
                 )}
                 {sidebarView === 'TRADE_PANEL' && (
                     <TradePanel 
                        onClose={() => {
                          setPreviewPrices(null); // 关闭面板时清除预览
                          isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD');
                        }} 
                        onConfirm={executeTrade} onAnalyze={handleAnalyzeTrade}
                        currentPrice={allCandles[currentIndex]?.close || 0}
                        direction={modalDirection} balance={balance}
                        viewingTrade={viewingTrade} isLoading={aiLoading}
                        onPreviewChange={handlePreviewPricesChange}
                     />
                 )}
                 {sidebarView === 'HISTORY_PANEL' && (
                     <GameHistoryPanel 
                        onClose={() => isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD')}
                        sessions={pastSessions} tradesByGame={pastTrades}
                        onReplay={(s) => { 
                            startNewGame({ 
                                symbol: s.symbol, 
                                timeframe: s.timeframe, 
                                marketEndTime: s.marketEndTime, 
                                parentId: s.id 
                            }); 
                            setShowMobileSidebar(false); 
                        }}
                        onReview={handleLoadSession} onDelete={handleDeleteHistory}
                     />
                 )}
                 {sidebarView === 'SETTINGS' && (
                     <SettingsPanel 
                        onClose={() => isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD')}
                        configSymbol={configSymbol} setConfigSymbol={setConfigSymbol}
                        configTimeframe={configTimeframe} setConfigTimeframe={setConfigTimeframe}
                        customPrompt={customPrompt} setCustomPrompt={setCustomPrompt}
                        SUPPORTED_SYMBOLS={SUPPORTED_SYMBOLS} SUPPORTED_TIMEFRAMES={SUPPORTED_TIMEFRAMES}
                        theme={theme} setTheme={setTheme}
                     />
                 )}
                 {sidebarView === 'MARKET_ANALYSIS' && (
                     <MarketAnalysisPanel 
                        analysisResult={marketAnalysis}
                        isLoading={isMarketAnalyzing}
                        onClose={() => isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD')}
                        symbol={session?.symbol}
                        ltfTimeframe={session?.timeframe}
                        htfTimeframe={session ? getHigherTimeframe(session.timeframe) : ''}
                     />
                 )}

                 {/* Mobile Close Handle (Bottom) */}
                 {isMobile && (
                    <button 
                        onClick={() => setShowMobileSidebar(false)}
                        className="absolute top-3 right-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-full z-50 text-gray-500"
                    >
                        ✕
                    </button>
                 )}
            </div>
        )}
      </div>

      {/* Resize Logic Listener */}
      {!isMobile && isResizingHistory && (
          <div className="fixed inset-0 z-50 cursor-col-resize"
             onMouseMove={(e) => setHistoryPanelWidth(Math.max(250, Math.min(800, window.innerWidth - e.clientX)))}
             onMouseUp={() => { setIsResizingHistory(false); chartRef.current?.resize(); }}
          />
      )}

      {/* Modals */}
      <SessionRestoreModal isOpen={showRestoreModal} session={pendingRestoreSession} onDiscard={() => { setShowRestoreModal(false); startNewGame(); }} onResume={() => { setShowRestoreModal(false); if (pendingRestoreSession) startNewGame(undefined, pendingRestoreSession); }} />
      <ConfirmDialog isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={() => { confirmConfig.onConfirm(); setConfirmConfig({...confirmConfig, isOpen: false}); }} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} />
      {loading && !session?.status && (
          <div className="fixed inset-0 z-[120] bg-white dark:bg-gray-950 flex flex-col items-center justify-center text-gray-900 dark:text-white">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-gray-200 dark:border-blue-900 rounded-full"></div>
                <div className="w-12 h-12 border-4 border-blue-600 dark:border-blue-500 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
              </div>
              <p className="text-sm font-bold mt-4 tracking-widest uppercase text-blue-600 dark:text-blue-400">Loading Market Data</p>
          </div>
      )}
    </div>
  );
};

export default App;