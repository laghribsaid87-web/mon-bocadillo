import React from 'react';
import { Settings, X } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function UISettingsModal({ 
    posUI, setPosUI, defaultPosUI, 
    handleResetPositions, settings, saveSettings, 
    defaultPosDriver, setDefaultPosDriver, 
    clientsList, headerBtnsOrder 
}) {
    const { showUISettings, setShowUISettings, isAdmin, showNotify, printCuisine, setPrintCuisine, printAddition, setPrintAddition } = usePosContext();

    if (!showUISettings) return null;

    return (
        <>
            {/* MODAL REGLAGES D'AFFICHAGE SIMPLIFIÉ */}
            {showUISettings && (
                <div className="fixed inset-0 z-[5000] bg-black/40 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowUISettings(false)}>
                    <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight"><Settings size={22}/> Configuration Caisse</h2>
                            <button onClick={() => setShowUISettings(false)} className="p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 bg-[#f8fafc] space-y-6 overflow-y-auto flex-1 no-scrollbar">
                            
                            {/* 🔥 NOUVEAU: Khtiyar L-Livreur Manuel */}
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm mb-4">
                                <label className="flex justify-between text-xs font-black text-blue-800 mb-2">Livreur de cette Caisse (Manuel)</label>
                                <select
                                    className="w-full bg-white border border-blue-300 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                                    value={defaultPosDriver}
                                    onChange={(e) => {
                                        setDefaultPosDriver(e.target.value);
                                        localStorage.setItem('pos_default_driver', e.target.value);
                                        showNotify(e.target.value ? "Mode Manuel Activé 🛵" : "Mode Auto Activé 🤖", "success");
                                    }}
                                >
                                    <option value="">🤖 Automatique (Idara / Robot)</option>
                                    {(clientsList||[]).filter(c => c.isDriver).map(d => (
                                        <option key={d.id} value={d.uid || d.id}>🛵 {d.name || d.phone}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-blue-700 mt-2 font-bold leading-tight">Si sélectionné, toute commande Web acceptée ici sera envoyée DIRECTEMENT à ce livreur.</p>
                            </div>

                            <div className="flex gap-3 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <button onClick={() => setPrintCuisine(!printCuisine)} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border ${printCuisine ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-[0_2px_10px_-3px_rgba(249,115,22,0.2)]' : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-50'}`}>
                                    <ChefHat size={18}/> Cuisine {printCuisine ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => setPrintAddition(!printAddition)} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border ${printAddition ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.2)]' : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-50'}`}>
                                    <Printer size={18}/> Ticket {printAddition ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Panier</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cartWidth}px</span></label>
                                    <input type="range" min="150" max="800" step="5" value={posUI.cartWidth} onChange={e => setPosUI({...posUI, cartWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Boutons</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.actionBtnWidth}px</span></label>
                                    <input type="range" min="80" max="250" step="5" value={posUI.actionBtnWidth} onChange={e => setPosUI({...posUI, actionBtnWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Hauteur Boutons</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.actionBtnHeight}px</span></label>
                                    <input type="range" min="30" max="80" step="2" value={posUI.actionBtnHeight} onChange={e => setPosUI({...posUI, actionBtnHeight: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Produits</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cardWidth}px</span></label>
                                    <input type="range" min="100" max="400" step="5" value={posUI.cardWidth} onChange={e => setPosUI({...posUI, cardWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Hauteur Produits</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cardHeight}px</span></label>
                                    <input type="range" min="100" max="500" step="5" value={posUI.cardHeight} onChange={e => setPosUI({...posUI, cardHeight: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Taille Texte</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.fontSize}px</span></label>
                                    <input type="range" min="10" max="24" step="1" value={posUI.fontSize} onChange={e => setPosUI({...posUI, fontSize: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={() => setPosUI(defaultPosUI)} className="flex-1 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-sm">Réinitialiser par défaut</button>
                                {isAdmin && headerBtnsOrder.length > 0 && (
                                    <button onClick={handleResetPositions} className="flex-1 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-sm">↺ Réinitialiser l'ordre des boutons</button>
                                )}
                            </div>
                                
                                {isAdmin && (
                                    <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Activer / Désactiver les boutons (Admin)</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Bouton "Sur Place"</span>
                                                <input type="checkbox" checked={!settings?.hidePosSurPlace} onChange={(e) => saveSettings({...settings, hidePosSurPlace: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Bouton "À Emporter"</span>
                                                <input type="checkbox" checked={!settings?.hidePosAEmporter} onChange={(e) => saveSettings({...settings, hidePosAEmporter: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Connecter Imprimante BT</span>
                                                <input type="checkbox" checked={!settings?.hidePosBluetooth} onChange={(e) => saveSettings({...settings, hidePosBluetooth: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Tiroir / Historique / Rapports</span>
                                                <input type="checkbox" checked={!settings?.hidePosTiroir} onChange={(e) => saveSettings({...settings, hidePosTiroir: !e.target.checked, hidePosHistory: !e.target.checked, hidePosReports: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                        </div>
                                    </div>
                                )}
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                            <button onClick={() => setShowUISettings(false)} className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-xl text-sm transition-all shadow-[0_8px_16px_-6px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 uppercase tracking-widest">Valider et Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            
        </>
    );
}
