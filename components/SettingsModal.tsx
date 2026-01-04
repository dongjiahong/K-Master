import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Sliders, Moon, Sun, ArrowLeft } from 'lucide-react';
import { Timeframe } from '../types';

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
  const [activeTab, setActiveTab] = useState<'general' | 'prompt'>('general');
  
  const [localSymbol, setLocalSymbol] = useState(configSymbol);
  const [localTimeframe, setLocalTimeframe] = useState(configTimeframe);
  const [localPrompt, setLocalPrompt] = useState(customPrompt);
  const [localTheme, setLocalTheme] = useState(theme);

  useEffect(() => {
      setLocalSymbol(configSymbol);
      setLocalTimeframe(configTimeframe);
      setLocalPrompt(customPrompt);
      setLocalTheme(theme);
  }, [configSymbol, configTimeframe, customPrompt, theme]);

  const handleSave = () => {
    setConfigSymbol(localSymbol);
    setConfigTimeframe(localTimeframe);
    setCustomPrompt(localPrompt);
    setTheme(localTheme);
    onClose();
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
                        className={`flex-1 p-1.5 rounded transition-all flex items-center justify-center gap-2 text-xs font-bold ${
                            activeTab === 'general' 
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Sliders size={14} /> General
                    </button>
                    <button
                        onClick={() => setActiveTab('prompt')}
                        className={`flex-1 p-1.5 rounded transition-all flex items-center justify-center gap-2 text-xs font-bold ${
                            activeTab === 'prompt' 
                            ? 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white shadow' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Cpu size={14} /> AI Prompt
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
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Appearance</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setLocalTheme('light')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${localTheme === 'light' ? 'bg-blue-50 border-blue-500 text-blue-600 ring-1 ring-blue-500' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                <Sun size={18} />
                                <span className="font-bold text-sm">Light</span>
                            </button>
                            <button 
                                onClick={() => setLocalTheme('dark')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${localTheme === 'dark' ? 'bg-gray-800 border-blue-500 text-white ring-1 ring-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <Moon size={18} />
                                <span className="font-bold text-sm">Dark</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Symbol</label>
                        <select 
                            value={localSymbol}
                            onChange={(e) => setLocalSymbol(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                        >
                            {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Timeframe</label>
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
                    <p>💡 Gameplay changes (Symbol/Timeframe) will apply to the <strong>next new game</strong>.</p>
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
                Cancel
            </button>
            <button
                onClick={handleSave}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
            >
                Save
            </button>
            </div>
        </div>
    </div>
  );
};

export default SettingsPanel;