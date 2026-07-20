import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator, FileText, BookOpen
} from 'lucide-react';
import { collection, query, limit, startAfter, getDocs, where, orderBy } from 'firebase/firestore';

export default function AdminGlovoReport(props) {
    const {
        role, db, appId, settings, brand, showNotify, 
        glovoDates, setGlovoDates, glovoPenalties, setGlovoPenalties,
        glovoBranch, setGlovoBranch, glovoData, setGlovoData,
        glovoCancellations, setGlovoCancellations, isFetchingGlovo, setIsFetchingGlovo,
        getL, formatPhoneNumber,
        ...rest
    } = props;

    
                        const totalCA = glovoData.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        const totalEspece = glovoData.filter(o => o.paymentMethod === 'espece' || o.paymentMethod === 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        const totalPrepaye = glovoData.filter(o => o.paymentMethod !== 'espece' && o.paymentMethod !== 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        
                        const commission = totalCA * 0.28;
                        const tva = commission * 0.20;
                        const totalRetenu = commission + tva + Number(glovoPenalties || 0);
                        const solde = totalPrepaye - totalRetenu;

                        const fetchGlovoReport = async () => {
                            if (!glovoDates.start || !glovoDates.end) return showNotify("Veuillez sélectionner les dates (Du / Au).", "error");
                            setIsFetchingGlovo(true);
                            try {
                                const start = new Date(glovoDates.start); start.setHours(0,0,0,0);
                                const end = new Date(glovoDates.end); end.setHours(23,59,59,999);
                                
                                const q = query(
                                    collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                                    where('createdAt', '>=', start),
                                    where('createdAt', '<=', end)
                                );
                                const snap = await getDocs(q);
                                let allOrders = snap.docs.map(d => ({id: d.id, ...d.data()}));
                                
                                let filtered = allOrders.filter(o => o.source === 'glovo' && o.status !== 'rejected');
                                
                                if (glovoBranch !== 'ALL') {
                                    filtered = filtered.filter(o => o.nearestBranch?.id === glovoBranch);
                                }
                                setGlovoData(filtered);

                                // Fetch cancellations
                                const qCancel = query(
                                    collection(db, 'artifacts', appId, 'public', 'data', 'glovo_cancellations'),
                                    where('createdAt', '>=', start),
                                    where('createdAt', '<=', end)
                                );
                                const snapCancel = await getDocs(qCancel);
                                setGlovoCancellations(snapCancel.docs.map(d => ({id: d.id, ...d.data()})));

                                showNotify(`Données Glovo chargées : ${filtered.length} commandes ✅`, "success");
                            } catch(e) {
                                console.error(e);
                                showNotify("Erreur de chargement", "error");
                            }
                            setIsFetchingGlovo(false);
                        };

                        return (
                            <div className="space-y-6 animate-in fade-in pb-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-gray-200 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-lg"><Calculator size={24} strokeWidth={2}/></div>
                                        <div><h2 className="text-xl font-semibold text-gray-900">Rapport Comptable Glovo</h2><p className="text-xs text-gray-500">Calculez vos factures de la quinzaine</p></div>
                                    </div>
                                    <button onClick={() => {
                                        const menuToExport = settings?.menuItems || DEFAULT_MENU_ITEMS;
                                        const rows = menuToExport.map(item => `"${item.name}","${item.id}"`);
                                        const csv = "data:text/csv;charset=utf-8,\uFEFFNom du Produit (Glovo),ID POS (Mon Bocadillo)\n" + rows.join("\n");
                                        const link = document.createElement("a");
                                        link.href = encodeURI(csv);
                                        link.download = "Menu_Mapping_Glovo.csv";
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        if(showNotify) showNotify("Menu exporté ! Envoyez ce fichier à Glovo ✅", "success");
                                    }} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Download size={18}/> Exporter Menu (Mapping)
                                    </button>
                                </div>

                                <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 items-end">
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Agence</label>
                                        <select value={glovoBranch} onChange={e=>setGlovoBranch(e.target.value)} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm cursor-pointer min-w-[150px]">
                                            <option value="ALL">Toutes Agences</option>
                                            {(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Du (Date de début)</label>
                                        <input type="date" value={glovoDates.start} onChange={e=>setGlovoDates({...glovoDates, start: e.target.value})} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                                    </div>
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Au (Date de fin)</label>
                                        <input type="date" value={glovoDates.end} onChange={e=>setGlovoDates({...glovoDates, end: e.target.value})} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                                    </div>
                                    <button onClick={fetchGlovoReport} disabled={isFetchingGlovo} className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-black text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 h-[42px]">
                                        {isFetchingGlovo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={18}/>} Calculer
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                    <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Total Commandes Glovo</p>
                                        <p className="text-3xl font-black text-gray-900">{glovoData.length} <span className="text-sm font-bold text-gray-500">Cmds</span></p>
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                            <span className="text-sm font-bold text-gray-600">Chiffre d'Affaires Brut</span>
                                            <span className="text-lg font-black text-blue-600">{totalCA.toFixed(2)} DH</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border-2 border-green-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2"><DollarSign size={14}/> Total Espèce (Encaissé)</p>
                                        <p className="text-2xl font-black text-gray-900">{totalEspece.toFixed(2)} <span className="text-sm font-bold text-gray-500">DH</span></p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-1">L'argent que le livreur vous a donné</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Total Prépayé (En ligne)</p>
                                        <p className="text-2xl font-black text-gray-900">{totalPrepaye.toFixed(2)} <span className="text-sm font-bold text-gray-500">DH</span></p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-1">L'argent chez Glovo</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                                    <h3 className="font-black text-lg text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4"><Calculator size={20} className="text-gray-500"/> Détail des Déductions</h3>
                                    
                                    <div className="space-y-4 max-w-2xl mx-auto">
                                        <div className="flex justify-between items-center bg-red-50/50 p-4 rounded-xl border border-red-100">
                                            <div>
                                                <p className="font-bold text-red-800">Commission Glovo (28%)</p>
                                                <p className="text-[10px] text-red-600">Calculée sur le CA Brut de {totalCA.toFixed(2)} DH</p>
                                            </div>
                                            <span className="font-black text-red-600 text-lg">- {commission.toFixed(2)} DH</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center bg-red-50/50 p-4 rounded-xl border border-red-100">
                                            <div>
                                                <p className="font-bold text-red-800">TVA sur Commission (20%)</p>
                                                <p className="text-[10px] text-red-600">Calculée sur les {commission.toFixed(2)} DH de commission</p>
                                            </div>
                                            <span className="font-black text-red-600 text-lg">- {tva.toFixed(2)} DH</span>
                                        </div>

                                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div>
                                                <p className="font-bold text-gray-800">Pénalités (Retards, Annulations)</p>
                                                <p className="text-[10px] text-gray-500">Regardez sur votre facture PDF Glovo</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-gray-600 text-lg">-</span>
                                                <input type="number" min="0" value={glovoPenalties} onChange={e => setGlovoPenalties(e.target.value)} className="w-24 bg-white border border-gray-300 p-2 rounded-lg text-right font-bold outline-none focus:border-blue-500" />
                                                <span className="font-bold text-gray-600">DH</span>
                                            </div>
                                        </div>

                                        <div className={`mt-6 p-6 rounded-2xl border-2 flex justify-between items-center ${solde >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                            <div>
                                                <p className={`font-black text-xl uppercase ${solde >= 0 ? 'text-green-800' : 'text-red-800'}`}>Net à Recevoir (Solde)</p>
                                                <p className={`text-xs font-bold mt-1 ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {solde >= 0 ? 'Ce que Glovo va vous virer' : 'Ce que vous devez à Glovo (Facture à payer)'}
                                                </p>
                                            </div>
                                            <span className={`text-3xl font-black ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {solde >= 0 ? '+' : ''}{solde.toFixed(2)} DH
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {glovoCancellations.length > 0 && (
                                    <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm mt-6">
                                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                            <h3 className="font-black text-lg text-red-700 flex items-center gap-2"><AlertTriangle size={20}/> Annulations Glovo Détectées</h3>
                                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold text-sm">{glovoCancellations.length} annulation(s)</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-4 font-bold">Utilisez ces données pour comparer avec votre facture Glovo et faire vos réclamations :</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {glovoCancellations.map(c => (
                                                <div key={c.id} className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-black text-lg text-gray-900">#{c.orderNumber}</span>
                                                        <span className="text-xs font-bold text-gray-500">{c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString('fr-FR') : new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-700 bg-white p-2 rounded-lg border border-red-50 whitespace-pre-wrap max-h-24 overflow-y-auto font-mono">
                                                        {c.reasonText}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    
}
