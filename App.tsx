import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KLineData, Timeframe, Trade, GameSession } from './types';
import { getHigherTimeframe, fetchMarketData, timeframeToMs, generateRandomMarketEndTime } from './services/binanceService';
import { generateGameReport } from './services/geminiService';
import { db, getSetting, saveSetting, SETTINGS_KEYS } from './db';

// Hooks
import { useHTFCalculation, usePendingOrders, useTradeManager, useGameLoop, useAiAnalysis } from './hooks';

// Components
import TradePanel from './components/TradePanel';
import GameHistoryPanel from './components/GameHistoryPanel';
import DashboardPanel from './components/DashboardPanel';
import SettingsPanel from './components/SettingsModal';
import SessionRestoreModal from './components/SessionRestoreModal';
import ConfirmDialog from './components/ConfirmDialog';
import Header from './components/Header';
import GameCharts, { GameChartsRef } from './components/GameCharts';
import MarketAnalysisPanel from './components/MarketAnalysisPanel';
import LoadingSpinner from './components/common/LoadingSpinner';

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
  
  // UI Panels / Sidebar
  const [sidebarView, setSidebarView] = useState<SidebarView>('DASHBOARD');
  const [historyPanelWidth, setHistoryPanelWidth] = useState(() => Math.max(350, Math.min(800, window.innerWidth / 3)));
  const [isResizingHistory, setIsResizingHistory] = useState(false);
  
  // Trade Panel Specifics
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [comparisonStats, setComparisonStats] = useState<any[]>([]);
  const [customPrompt, setCustomPromptState] = useState<string>('');
  
  // 预览止盈止损价格
  const [previewPrices, setPreviewPrices] = useState<{tp: number | null, sl: number | null, direction: 'LONG' | 'SHORT', entryPrice?: number | null} | null>(null);
  
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
  const lastPlayedIndexRef = useRef<number>(0);

  // --- Custom Hooks ---
  const htfCalc = useHTFCalculation();
  const tradeManager = useTradeManager();
  const pendingOrdersHook = usePendingOrders();
  const aiAnalysis = useAiAnalysis();

  // 游戏循环 - nextCandle callback
  const nextCandleCallback = useCallback(() => {
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
      htfCalc.updateHtfWithLtf(newCandle, htf);
    }

    // 检查挂单是否触发
    if (!tradeManager.activeTrade && pendingOrdersHook.pendingOrders.length > 0) {
      const triggeredOrder = pendingOrdersHook.checkPendingOrderTrigger(newCandle);
      if (triggeredOrder) {
        pendingOrdersHook.triggerPendingOrder(triggeredOrder, newCandle, balance).then(trade => {
          tradeManager.setActiveTradeDirectly(trade);
          tradeManager.initializeTradeHistory([trade, ...tradeManager.tradeHistory]);
          setViewingTrade(trade);
          setSidebarView('TRADE_PANEL');
          if (isMobile) setShowMobileSidebar(true);
        });
      }
    }

    // 检查交易止盈止损
    if (tradeManager.activeTrade) {
      const { status, exitPrice } = tradeManager.checkTradeStatus(tradeManager.activeTrade, newCandle);
      if (status) {
        gameLoop.stopPlaying();
        
        // 获取 K 线数据用于 AI 复盘
        const entryIndex = allCandles.findIndex(c => c.timestamp >= tradeManager.activeTrade!.entryTime);
        const ltfCandles = allCandles.slice(Math.max(0, entryIndex - 50), nextIndex + 1);
        const htfCandlesCopy = [...htfCalc.htfHistory];
        if (htfCalc.currentHtfCandle) {
          const lastHistory = htfCandlesCopy[htfCandlesCopy.length - 1];
          if (lastHistory && lastHistory.timestamp === htfCalc.currentHtfCandle.timestamp) {
            htfCandlesCopy[htfCandlesCopy.length - 1] = htfCalc.currentHtfCandle;
          } else {
            htfCandlesCopy.push(htfCalc.currentHtfCandle);
          }
        }

        tradeManager.closeTrade(
          tradeManager.activeTrade, 
          exitPrice, 
          status, 
          newCandle.timestamp,
          { ltfCandles, htfCandles: htfCandlesCopy, customPrompt }
        ).then(closedTrade => {
          setBalance(prev => prev + closedTrade.pnl);
          setViewingTrade(closedTrade);
          setSidebarView('TRADE_PANEL');
          if (isMobile) setShowMobileSidebar(true);
        });
      }
    }
  }, [currentIndex, allCandles, session, isReviewingHistory, balance, isMobile, customPrompt, htfCalc, tradeManager, pendingOrdersHook]);

  const gameLoop = useGameLoop({ onNextCandle: nextCandleCallback, isReviewingHistory });

  // --- Effects ---
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const savedPrompt = await getSetting(SETTINGS_KEYS.CUSTOM_PROMPT);
      if (savedPrompt) setCustomPromptState(savedPrompt);
    };
    loadSettings();
  }, []);

  const setCustomPrompt = useCallback((value: string) => {
    setCustomPromptState(value);
    saveSetting(SETTINGS_KEYS.CUSTOM_PROMPT, value);
  }, []);

  const handlePreviewPricesChange = useCallback((tp: number | null, sl: number | null, direction: 'LONG' | 'SHORT', entryPrice?: number | null) => {
    if (tp === null && sl === null && !entryPrice) {
      setPreviewPrices(null);
    } else {
      setPreviewPrices({ tp, sl, direction, entryPrice });
    }
  }, []);

  // --- Start Game Logic ---
  const startNewGame = async (replayConfig?: { symbol: string, timeframe: Timeframe, marketEndTime: number, parentId?: number }, resumeSession?: GameSession) => {
    setLoading(true);
    setFinalReport(null);
    setComparisonStats([]);
    setViewingTrade(null);
    gameLoop.stopPlaying();
    setIsReviewingHistory(false);
    tradeManager.resetTrades();
    pendingOrdersHook.resetPendingOrders();
    htfCalc.resetHtf();
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
    if (resumeSession) {
      const existingTrades = await db.trades.where('gameId').equals(resumeSession.id!).toArray();
      tradeManager.initializeTradeHistory(existingTrades);
      const pnl = existingTrades.reduce((acc, t) => acc + t.pnl, 0);
      setBalance(resumeSession.initialBalance + pnl);
      if (existingTrades.length > 0) {
        const lastTradeTime = Math.max(...existingTrades.map(t => t.exitTime || t.entryTime));
        const foundIndex = rawData.findIndex(c => c.timestamp === lastTradeTime);
        if (foundIndex > PRELOAD_COUNT) startIndex = resumeSession.status === 'COMPLETED' ? rawData.length - 1 : foundIndex + 1;
      }
      const openTrade = existingTrades.find(t => t.status === 'OPEN');
      if (openTrade) tradeManager.setActiveTradeDirectly(openTrade);
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

    // Initial partial HTF calc
    const ltfCandlesInCurrentHtfBlock = rawData.slice(0, startIndex + 1).filter(c => c.timestamp >= currentHtfBlockStart);
    let partialHtf: KLineData | null = null;
    if (ltfCandlesInCurrentHtfBlock.length > 0) {
      partialHtf = { ...ltfCandlesInCurrentHtfBlock[0] };
      ltfCandlesInCurrentHtfBlock.forEach(c => {
        partialHtf!.high = Math.max(partialHtf!.high, c.high);
        partialHtf!.low = Math.min(partialHtf!.low, c.low);
        partialHtf!.close = c.close;
        partialHtf!.volume += c.volume;
      });
      partialHtf.timestamp = currentHtfBlockStart;
    }
    
    htfCalc.initializeHtf(historicalHtfData, partialHtf);
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
    gameLoop.stopPlaying();
    if (!session || !session.id) return;
    setIsGeneratingReport(true);
    
    if (tradeManager.activeTrade) {
      const currentCandle = allCandles[currentIndex];
      await tradeManager.closeTrade(tradeManager.activeTrade, currentCandle.close, 'CLOSED_MANUAL', currentCandle.timestamp);
    }
    
    const report = await generateGameReport(tradeManager.tradeHistoryRef.current, customPrompt);
    
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
    if (tradeManager.activeTrade) return alert("已有持仓，请先平仓");
    gameLoop.stopPlaying();
    setModalDirection(dir);
    setViewingTrade(null);
    setSidebarView('TRADE_PANEL');
    if (isMobile) setShowMobileSidebar(true);
  };

  const handleManualTakeProfit = () => {
    if (!tradeManager.activeTrade) return;
    const currentCandle = allCandles[currentIndex];
    tradeManager.closeTrade(tradeManager.activeTrade, currentCandle.close, 'CLOSED_TP', currentCandle.timestamp).then(closed => {
      setBalance(prev => prev + closed.pnl);
      setViewingTrade(closed);
      setSidebarView('TRADE_PANEL');
      if (isMobile) setShowMobileSidebar(true);
    });
  };

  const handleManualStopLoss = () => {
    if (!tradeManager.activeTrade) return;
    const currentCandle = allCandles[currentIndex];
    tradeManager.closeTrade(tradeManager.activeTrade, currentCandle.close, 'CLOSED_SL', currentCandle.timestamp).then(closed => {
      setBalance(prev => prev + closed.pnl);
      setViewingTrade(closed);
      setSidebarView('TRADE_PANEL');
      if (isMobile) setShowMobileSidebar(true);
    });
  };

  const createPendingOrder = (triggerPrice: number, tp: number, sl: number, reason: string) => {
    if (tradeManager.activeTrade) {
      alert('已有持仓，无法创建挂单');
      return;
    }
    pendingOrdersHook.createPendingOrder(
      session?.id || 0,
      session?.symbol || 'BTCUSDT',
      modalDirection,
      triggerPrice,
      tp,
      sl,
      reason
    );
    setPreviewPrices(null);
  };

  const executeTrade = async (reason: string, tp: number, sl: number, preAnalysis?: { type: 'analysis' | 'review'; content: string; timestamp: number }[]) => {
    setPreviewPrices(null);
    const currentCandle = allCandles[currentIndex];
    const trade = await tradeManager.executeTrade(
      session?.id || 0,
      session?.symbol || 'BTCUSDT',
      modalDirection,
      currentCandle.close,
      tp,
      sl,
      balance,
      reason,
      currentCandle.timestamp,
      preAnalysis
    );
    setViewingTrade(trade);
  };

  const handleAnalyzeTrade = async (reason: string, tp: number, sl: number) => {
    tradeManager.setAiLoading(true);
    const currentCandle = allCandles[currentIndex];
    const tempTrade: Trade = {
      id: 'temp', gameId: 0, symbol: session?.symbol || '', direction: modalDirection,
      entryPrice: currentCandle.close, tp, sl, quantity: 0, entryTime: currentCandle.timestamp, status: 'OPEN', pnl: 0, reason
    };
    
    const ltfCandles = allCandles.slice(0, currentIndex + 1);
    const htfCandles = [...htfCalc.htfHistory];
    if (htfCalc.currentHtfCandle) {
      const lastHistory = htfCandles[htfCandles.length - 1];
      if (lastHistory && lastHistory.timestamp === htfCalc.currentHtfCandle.timestamp) {
        htfCandles[htfCandles.length - 1] = htfCalc.currentHtfCandle;
      } else {
        htfCandles.push(htfCalc.currentHtfCandle);
      }
    }
    
    const comment = await aiAnalysis.performTradeAnalysis(tempTrade, ltfCandles, htfCandles, customPrompt);
    tradeManager.setAiLoading(false);
    return comment;
  };

  const handleReviewTrade = (trade: Trade) => {
    gameLoop.stopPlaying();
    if (!isReviewingHistory) lastPlayedIndexRef.current = currentIndex;
    setIsReviewingHistory(true);
    const tradeIndex = allCandles.findIndex(c => c.timestamp === trade.entryTime);
    if (tradeIndex !== -1) {
      setCurrentIndex(tradeIndex);
      setViewingTrade(trade);
      setSidebarView('TRADE_PANEL');
      if (isMobile) setShowMobileSidebar(true);
      
      const htf = getHigherTimeframe(session!.timeframe);
      const reviewHtfCandle = htfCalc.calculateHtfFromLtf(allCandles, tradeIndex, htf)
        || { timestamp: Math.floor(trade.entryTime / timeframeToMs(htf)) * timeframeToMs(htf), open: trade.entryPrice, high: trade.entryPrice, low: trade.entryPrice, close: trade.entryPrice, volume: 0, turnover: 0 };
      
      htfCalc.syncHtfCandle(reviewHtfCandle);
    }
  };

  const handleViewTradeOrder = (trade: Trade) => {
    setViewingTrade(trade);
    setSidebarView('TRADE_PANEL');
    if (isMobile) setShowMobileSidebar(true);
  };

  const handleBackToLive = () => {
    const resumeIndex = lastPlayedIndexRef.current;
    setCurrentIndex(resumeIndex);
    setIsReviewingHistory(false);
    setViewingTrade(null);
    setSidebarView('DASHBOARD');
    
    if (session) {
      const htf = getHigherTimeframe(session.timeframe);
      const restoredHtf = htfCalc.calculateHtfFromLtf(allCandles, resumeIndex, htf);
      htfCalc.syncHtfCandle(restoredHtf);
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

  const handleMarketAnalysis = async () => {
    if (!session) return;
    const htf = getHigherTimeframe(session.timeframe);
    const ltfCandles = allCandles.slice(0, currentIndex + 1);
    const htfCandles = [...htfCalc.htfHistory];
    if (htfCalc.currentHtfCandle) {
      const lastHistory = htfCandles[htfCandles.length - 1];
      if (lastHistory && lastHistory.timestamp === htfCalc.currentHtfCandle.timestamp) {
        htfCandles[htfCandles.length - 1] = htfCalc.currentHtfCandle;
      } else {
        htfCandles.push(htfCalc.currentHtfCandle);
      }
    }
    
    setSidebarView('MARKET_ANALYSIS');
    if (isMobile) setShowMobileSidebar(true);
    
    await aiAnalysis.performMarketAnalysis(
      session.symbol,
      session.timeframe,
      htf,
      ltfCandles,
      htfCandles,
      customPrompt
    );
  };

  // --- Computed Values ---
  const displayedHtfHistory = useMemo(() => {
    if (!htfCalc.currentHtfCandle) return htfCalc.htfHistory;
    return htfCalc.htfHistory.filter(h => h.timestamp < htfCalc.currentHtfCandle!.timestamp);
  }, [htfCalc.htfHistory, htfCalc.currentHtfCandle]);

  const displayedTrades = useMemo(() => {
    if (allCandles.length === 0) return tradeManager.tradeHistory;
    const currentTime = allCandles[currentIndex]?.timestamp || 0;
    return tradeManager.tradeHistory
      .filter(t => t.entryTime <= currentTime)
      .map(t => {
        if (t.exitTime && t.exitTime > currentTime) {
          return { ...t, status: 'OPEN' as const, exitTime: undefined, exitPrice: undefined };
        }
        return t;
      });
  }, [tradeManager.tradeHistory, currentIndex, allCandles]);

  // --- Render ---
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      <Header 
        session={session} isPlaying={gameLoop.isPlaying} setIsPlaying={gameLoop.setIsPlaying}
        isReviewingHistory={isReviewingHistory} nextCandle={nextCandleCallback}
        currentDisplayIndex={currentIndex} totalCandles={allCandles.length}
        autoPlaySpeed={gameLoop.autoPlaySpeed} setAutoPlaySpeed={gameLoop.setAutoPlaySpeed}
        activeTrade={tradeManager.activeTrade} handleOpenTradeModal={handleOpenTradeModal}
        handleManualTakeProfit={handleManualTakeProfit}
        handleManualStopLoss={handleManualStopLoss}
        loadHistoryAndShowPanel={loadHistoryAndShowPanel} setSidebarView={setSidebarView}
        isMobile={isMobile} onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
        onMarketAnalysis={handleMarketAnalysis}
        isMarketAnalyzing={aiAnalysis.isMarketAnalyzing}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <GameCharts 
          ref={chartRef}
          theme={theme}
          session={session}
          ltfData={allCandles.slice(0, currentIndex + 1)}
          htfData={displayedHtfHistory}
          currentHtfCandle={htfCalc.currentHtfCandle}
          trades={displayedTrades}
          pendingOrders={pendingOrdersHook.pendingOrders}
          isReviewingHistory={isReviewingHistory}
          onBackToLive={handleBackToLive}
          onCandleClick={(ts) => {
            const trade = tradeManager.tradeHistory.find(t => Math.abs(t.entryTime - ts) < 300000);
            if (trade) handleReviewTrade(trade);
          }}
          previewPrices={previewPrices}
        />
        
        {(!isMobile || showMobileSidebar) && (
          <div 
            className={`flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 transition-all duration-200 ease-linear z-30 ${isMobile ? 'fixed inset-0 w-full' : 'relative'}`}
            style={{ width: isMobile ? '100%' : historyPanelWidth }}
          >
            {!isMobile && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50"
                onMouseDown={() => setIsResizingHistory(true)}
              ></div>
            )}

            {sidebarView === 'DASHBOARD' && (
              <DashboardPanel 
                balance={balance} initialBalance={INITIAL_BALANCE} session={session}
                comparisonStats={comparisonStats} loading={loading} isGeneratingReport={isGeneratingReport}
                finalReport={finalReport} currentTrades={tradeManager.tradeHistory}
                pendingOrders={pendingOrdersHook.pendingOrders}
                onReviewTrade={handleReviewTrade}
                onViewTradeOrder={handleViewTradeOrder}
                onViewPendingOrder={() => {}} 
                onCancelPendingOrder={pendingOrdersHook.cancelPendingOrder}
                onStartNewGame={() => setConfirmConfig({ isOpen: true, title: '重新开始', message: '确定要放弃当前进度并开始新的一局吗？', onConfirm: () => startNewGame() })}
                onEndGame={handleEndGame} onLoadSession={handleLoadSession}
                isReviewingHistory={isReviewingHistory} viewingTradeId={viewingTrade?.id}
              />
            )}
            {sidebarView === 'TRADE_PANEL' && (
              <TradePanel 
                onClose={() => {
                  setPreviewPrices(null);
                  isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD');
                }} 
                onConfirm={executeTrade} 
                onCreatePendingOrder={createPendingOrder}
                onAnalyze={handleAnalyzeTrade}
                currentPrice={allCandles[currentIndex]?.close || 0}
                direction={modalDirection} balance={balance}
                viewingTrade={viewingTrade} isLoading={tradeManager.aiLoading}
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
                analysisResult={aiAnalysis.marketAnalysis}
                isLoading={aiAnalysis.isMarketAnalyzing}
                onClose={() => isMobile ? setShowMobileSidebar(false) : setSidebarView('DASHBOARD')}
                symbol={session?.symbol}
                ltfTimeframe={session?.timeframe}
                htfTimeframe={session ? getHigherTimeframe(session.timeframe) : ''}
              />
            )}

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

      {!isMobile && isResizingHistory && (
        <div className="fixed inset-0 z-50 cursor-col-resize"
          onMouseMove={(e) => setHistoryPanelWidth(Math.max(250, Math.min(800, window.innerWidth - e.clientX)))}
          onMouseUp={() => { setIsResizingHistory(false); chartRef.current?.resize(); }}
        />
      )}

      <SessionRestoreModal isOpen={showRestoreModal} session={pendingRestoreSession} onDiscard={() => { setShowRestoreModal(false); startNewGame(); }} onResume={() => { setShowRestoreModal(false); if (pendingRestoreSession) startNewGame(undefined, pendingRestoreSession); }} />
      <ConfirmDialog isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={() => { confirmConfig.onConfirm(); setConfirmConfig({...confirmConfig, isOpen: false}); }} onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} />
      
      {loading && !session?.status && (
        <LoadingSpinner fullScreen message="Loading Market Data" />
      )}
    </div>
  );
};

export default App;