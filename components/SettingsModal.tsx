import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Sliders, Moon, Sun, ArrowLeft, Key, Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react';
import { Timeframe } from '../types';
import { 
  addApiKey, 
  removeApiKey, 
  getAllKeysWithUsage, 
  getDailyLimit,
  ApiKeyWithUsage 
} from '../services/apiKeyService';
import { getSetting, saveSetting, SETTINGS_KEYS, SUPPORTED_MODELS, DEFAULT_MODEL } from '../db';

interface SettingsModalProps {
  onClose: () => void;
  configSymbol: string;
  setConfigSymbol: (val: string) => void;
  configTimeframe: Timeframe;
  setConfigTimeframe: (val: Timeframe) => void;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  SUPPORTED_SYMBOLS: string[];
  SUPPORTED_TIMEFRAMES: Timeframe[];
  theme: 'dark' | 'light';
  setTheme: (val: 'dark' | 'light') => void;
}

const SettingsPanel: React.FC<SettingsModalProps> = ({
  onClose,
  configSymbol, setConfigSymbol,
  configTimeframe, setConfigTimeframe,
  customPrompt, setCustomPrompt,
  SUPPORTED_SYMBOLS, SUPPORTED_TIMEFRAMES,
  theme, setTheme
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'apikeys' | 'prompt'>('general');
  
  const [localSymbol, setLocalSymbol] = useState(configSymbol);
  const [localTimeframe, setLocalTimeframe] = useState(configTimeframe);
  const [localPrompt, setLocalPrompt] = useState(customPrompt);
  const [localTheme, setLocalTheme] = useState(theme);

  // API Keys 状态
  const [apiKeys, setApiKeys] = useState<ApiKeyWithUsage[]>([]);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  
  // 模型选择状态
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  const dailyLimit = getDailyLimit();

  // 加载 API Keys
  const loadApiKeys = async () => {
    const keys = await getAllKeysWithUsage();
    setApiKeys(keys);
  };

  useEffect(() => {
    setLocalSymbol(configSymbol);
    setLocalTimeframe(configTimeframe);
    setLocalPrompt(customPrompt);
    setLocalTheme(theme);
  }, [configSymbol, configTimeframe, customPrompt, theme]);

  useEffect(() => {
    if (activeTab === 'apikeys') {
      loadApiKeys();
      // 加载已保存的模型选择
      getSetting(SETTINGS_KEYS.SELECTED_MODEL).then(saved => {
        if (saved) setSelectedModel(saved);
      });
    }
  }, [activeTab]);

  // 保存模型选择
  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    await saveSetting(SETTINGS_KEYS.SELECTED_MODEL, model);
  };

  const handleSave = () => {
    setConfigSymbol(localSymbol);
    setConfigTimeframe(localTimeframe);
    setCustomPrompt(localPrompt);
    setTheme(localTheme);
    onClose();
  };

  // 添加新 Key
  const handleAddKey = async () => {
    const trimmedKey = newKeyInput.trim();
    if (!trimmedKey) {
      setKeyError('请输入 API Key');
      return;
    }
    if (trimmedKey.length < 10) {
      setKeyError('API Key 格式不正确');
      return;
    }
    // 检查重复
    if (apiKeys.some(k => k.key === trimmedKey)) {
      setKeyError('该 Key 已存在');
      return;
    }

    setIsAddingKey(true);
    setKeyError('');
    try {
      await addApiKey(trimmedKey);
      setNewKeyInput('');
      await loadApiKeys();
    } catch (e) {
      setKeyError('添加失败，请重试');
    } finally {
      setIsAddingKey(false);
    }
  };

  // 删除 Key
  const handleRemoveKey = async (id: string) => {
    if (window.confirm('确定要删除这个 API Key 吗？')) {
      await removeApiKey(id);
      await loadApiKeys();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950 w-full">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
             <div className="flex items-center gap-2">
                 <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                     <ArrowLeft size={20} />
                 </button>
                 <Settings className="text-blue-500" size={18} />
                 <span className="font-bold text-gray-900 dark:text-white">设置</span>
             </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden">
            {/* Header Tabs */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
                <div className="flex bg-gray-200 dark:bg-gray-800 rounded p-1 border border-gray-300 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 p-1.5 rounded transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                            activeTab === 'general' 
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Sliders size={14} /> 通用
                    </button>
                    <button
                        onClick={() => setActiveTab('apikeys')}
                        className={`flex-1 p-1.5 rounded transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                            activeTab === 'apikeys' 
                            ? 'bg-emerald-100 dark:bg-emerald-600 text-emerald-800 dark:text-white shadow' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Key size={14} /> API Keys
                    </button>
                    <button
                        onClick={() => setActiveTab('prompt')}
                        className={`flex-1 p-1.5 rounded transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                            activeTab === 'prompt' 
                            ? 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white shadow' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Cpu size={14} /> Prompt
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100">
            {activeTab === 'general' ? (
                <div className="space-y-6">
                <div className="space-y-4">
                    {/* Theme Switcher */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">外观</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setLocalTheme('light')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${localTheme === 'light' ? 'bg-blue-50 border-blue-500 text-blue-600 ring-1 ring-blue-500' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                <Sun size={18} />
                                <span className="font-bold text-sm">浅色</span>
                            </button>
                            <button 
                                onClick={() => setLocalTheme('dark')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${localTheme === 'dark' ? 'bg-gray-800 border-blue-500 text-white ring-1 ring-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Moon size={18} />
                                <span className="font-bold text-sm">深色</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">交易对</label>
                        <select 
                            value={localSymbol}
                            onChange={(e) => setLocalSymbol(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                        >
                            {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">时间周期</label>
                        <select 
                            value={localTimeframe}
                            onChange={(e) => setLocalTimeframe(e.target.value as Timeframe)}
                            className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                        >
                            {SUPPORTED_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded text-xs text-blue-600 dark:text-blue-300">
                    <p>💡 交易设置变更将在<strong>下一局新游戏</strong>生效。</p>
                </div>
                </div>
            ) : activeTab === 'apikeys' ? (
                <div className="space-y-4">
                    {/* 添加新 Key */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">添加 Gemini API Key</label>
                        <div className="flex gap-2">
                            <input 
                                type="password"
                                value={newKeyInput}
                                onChange={(e) => {
                                    setNewKeyInput(e.target.value);
                                    setKeyError('');
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                                placeholder="输入你的 API Key..."
                                className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono"
                            />
                            <button 
                                onClick={handleAddKey}
                                disabled={isAddingKey}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-400 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-1.5"
                            >
                                <Plus size={16} />
                                添加
                            </button>
                        </div>
                        {keyError && (
                            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle size={12} /> {keyError}
                            </p>
                        )}
                    </div>

                    {/* 模型选择 */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Sparkles size={14} className="text-purple-500" /> AI 模型选择
                        </label>
                        <select 
                            value={selectedModel}
                            onChange={(e) => handleModelChange(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono text-sm"
                        >
                            {SUPPORTED_MODELS.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-400">
                            选择后所有 AI 分析功能将使用该模型，立即生效
                        </p>
                    </div>

                    {/* Key 列表 */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">已添加的 Keys</label>
                            <span className="text-xs text-gray-400">每日限制: {dailyLimit} 次/Key</span>
                        </div>
                        
                        {apiKeys.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Key size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">还没有添加 API Key</p>
                                <p className="text-xs mt-1">添加 Key 后才能使用 AI 分析功能</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {apiKeys.map((keyItem) => (
                                    <div 
                                        key={keyItem.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                            keyItem.isExhausted 
                                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30' 
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${keyItem.isExhausted ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                                {keyItem.maskedKey}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                keyItem.isExhausted 
                                                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' 
                                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                                {keyItem.todayUsage}/{dailyLimit}
                                            </span>
                                            <button 
                                                onClick={() => handleRemoveKey(keyItem.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                title="删除此 Key"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 说明 */}
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded text-xs text-emerald-600 dark:text-emerald-300 space-y-1">
                        <p>🔑 每个 Key 每天最多使用 <strong>{dailyLimit} 次</strong>，超过后自动切换其他 Key</p>
                        <p>🌍 每日额度在 <strong>UTC 0:00</strong> (北京时间 08:00) 重置</p>
                        <p>🎲 多个 Key 会<strong>随机轮换</strong>使用，分摊调用压力</p>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col">
                <div className="mb-2 flex justify-between items-end">
                    <label className="block text-xs font-bold text-blue-500 dark:text-blue-400 uppercase">
                        System Prompt
                    </label>
                    <span className="text-[10px] text-gray-500 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700">
                        Markdown
                    </span>
                </div>
                
                <div className="flex-1 relative group min-h-[300px]">
                    <textarea
                        className="w-full h-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none leading-relaxed resize-none shadow-inner custom-scrollbar"
                        placeholder="# Role Setup..."
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                    />
                </div>
                </div>
            )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 flex gap-3">
            <button
                onClick={onClose}
                className="flex-1 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-transparent hover:border-gray-300 dark:hover:border-gray-700"
            >
                取消
            </button>
            <button
                onClick={handleSave}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
            >
                保存
            </button>
            </div>
        </div>
    </div>
  );
};

export default SettingsPanel;