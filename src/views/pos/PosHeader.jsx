import React from 'react';
import { ShoppingBasket, Settings, History, Minus, X } from 'lucide-react';
import { usePosContext } from './PosContext';

export default function PosHeader({ handleInstallApp, showUISettings }) {
    const { 
        brand, 
        activeBranchId, 
        setActiveBranchId, 
        isAdmin, 
        settings, 
        isNetOnline, 
        offlineQueue, 
        syncOfflineOrdersRef,
        logoBg,
        headerClasses,
        displayedButtons,
        renderHeaderButton,
        showInstallBtn
    } = usePosContext();

    return (
        <header className={`px-4 sm:px-6 py-3 flex items-center justify-between z-10 shrink-0 w-full gap-2 sm:gap-4 border-b ${headerClasses}`}>
            {/* LEFT: LOGO */}
            <div className="flex items-center gap-3 shrink-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${logoBg}`}>
                    <ShoppingBasket size={22} className="font-black"/> 
                </div>
                <div className="flex flex-col justify-center">
                    <span className="font-black text-lg sm:text-xl truncate max-w-[120px] sm:max-w-[200px] leading-tight tracking-tight">
                        {brand?.texts?.posAppTitle || brand?.name || 'Mon Bocadillo'}
                    </span>
                    {activeBranchId && activeBranchId !== 'ALL' && !isAdmin && (
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest leading-tight text-gray-400">
                        Caisse {(settings?.branches || []).find(b => b.id === activeBranchId)?.name || ''}
                    </span>
                    )}
                    {isAdmin && (
                        <select
                            value={activeBranchId}
                            onChange={(e) => setActiveBranchId(e.target.value)}
                            className="mt-1 border px-1 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold outline-none cursor-pointer w-fit bg-gray-100 border-gray-200 text-gray-700"
                        >
                            <option value="ALL">Toutes les agences</option>
                            {(settings?.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                </div>
            </div>
            
            {/* MIDDLE: BUTTONS */}
            <div className="flex-1 flex flex-wrap items-center justify-center gap-1.5 py-1">
                {displayedButtons?.map((btnId, idx) => renderHeaderButton(btnId, idx))}
            </div>

            {/* RIGHT: CONFIG & WINDOW CONTROLS */}
            <div className="flex items-center gap-2 shrink-0 border-l border-gray-200/50 pl-2 sm:pl-4">
                {showInstallBtn && (
                    <button onClick={handleInstallApp} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-black uppercase rounded-xl shadow-md animate-bounce active:scale-95 transition-all">
                        📲 Installer
                    </button>
                )}
                {!isNetOnline ? (
                    <div className="flex items-center gap-1.5 bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-red-200">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                        <span className="hidden sm:inline">Hors Ligne</span> ({offlineQueue?.length || 0})
                    </div>
                ) : (offlineQueue?.length > 0) ? (
                    <button onClick={() => syncOfflineOrdersRef?.current && syncOfflineOrdersRef.current()} className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-yellow-300 hover:bg-yellow-200 transition-colors">
                        <History size={14} /> Sync ({offlineQueue.length})
                    </button>
                ) : null}

                <button onClick={() => showUISettings(true)} className="p-2 sm:px-3 sm:py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors shadow-md flex items-center gap-1.5 text-[10px] sm:text-xs font-bold" title="Configuration">
                    <Settings size={16}/> <span className="hidden sm:inline">Config</span>
                </button>
                
                {/* Electron Window Controls */}
                <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button onClick={() => {
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            ipcRenderer.send('minimize-window');
                        }
                    }} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm rounded-lg transition-all" title="Réduire">
                        <Minus size={16} strokeWidth={3} />
                    </button>
                    <button onClick={() => {
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            ipcRenderer.send('close-window');
                        } else {
                            window.close();
                        }
                    }} className="p-1.5 text-gray-500 hover:text-white hover:bg-red-500 hover:shadow-sm rounded-lg transition-all" title="Fermer">
                        <X size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </header>
    );
}
