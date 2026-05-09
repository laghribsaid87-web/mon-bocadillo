import React, { useState, useEffect } from 'react';
import { 
    Edit3, Palette, Settings, Zap, ImageIcon, Type, AlignLeft, Save,
    MessageCircle, MapIcon, MousePointer2, Home, ShoppingBag, User, Trash2,
    Plus, Eye, Truck, Monitor, LayoutDashboard, History, Menu, MapPin, Printer,
    ChevronDown, ChevronUp, Smartphone, ChefHat
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc } from 'firebase/firestore';
import { FONTS_OPTIONS, DEFAULT_BRAND } from '../../config/constants';
import AdminMenuEditor from './AdminMenuEditor';

// قاموس النصوص الشامل للتطبيقات الأربعة
const TEXT_ZONES = {
    client: [
        { key: 'navMenu', label: 'Bouton Menu (Bas)', def: 'VOIR MENU' },
        { key: 'navTrack', label: 'Bouton Suivi (Bas)', def: 'SUIVI' },
        { key: 'navProfile', label: 'Bouton Profil (Bas)', def: 'PROFIL' },
        { key: 'btnAdd', label: 'Bouton Ajouter (+)', def: 'Ajouter' },
        { key: 'btnCart', label: 'Titre Panier', def: 'Panier' },
        { key: 'btnOrder', label: 'Bouton Commander', def: 'Commander' },
        { key: 'topQuality', label: 'Badge Qualité (Menu)', def: 'Top Qualité' },
        { key: 'coverTitle', label: 'Titre Couverture', def: 'A7san Mada9' }
    ],
    driver: [
        { key: 'driverAppTitle', label: 'Titre App Livreur', def: 'LIVREUR' },
        { key: 'driverBtnAccept', label: 'Bouton Accepter', def: 'Accepter (Prendre)' },
        { key: 'driverBtnReject', label: 'Bouton Refuser', def: 'Refuser' },
        { key: 'driverMapBtn', label: 'Bouton Carte GPS', def: 'Carte Live GPS' },
        { key: 'driverTabMissions', label: 'Onglet Missions', def: 'Missions' },
        { key: 'driverTabHistory', label: 'Onglet Historique', def: 'Historique' }
    ],
    pos: [
        { key: 'posAppTitle', label: 'Titre Caisse POS', def: 'CAISSE POS' },
        { key: 'posTabOrder', label: 'Titre Commande', def: 'Commande' },
        { key: 'posBtnPay', label: 'Bouton Payer', def: 'Encaissement' },
        { key: 'posTotal', label: 'Texte Total', def: 'Total à payer' },
        { key: 'posCash', label: 'Bouton Espèce', def: 'Espèce' },
        { key: 'posCard', label: 'Bouton Carte', def: 'Carte' }
    ],
    admin: [
        { key: 'adminAppTitle', label: 'Titre Idara', def: 'IDARA' },
        { key: 'adminStatusOpen', label: 'Badge Ouvert', def: 'Ouvert' },
        { key: 'adminBoxPending', label: 'Boîte Attente', def: 'En Attente' },
        { key: 'adminBoxEnRoute', label: 'Boîte En Route', def: 'En Route' },
        { key: 'adminBoxNewCmd', label: 'Nouvelles Cmds', def: 'Nouvelles Commandes' },
        { key: 'btnAdminOfficial', label: 'Bouton Officiel', def: '1. Officiel' },
        { key: 'btnAdminFreelance', label: 'Bouton Livreur', def: 'Livreur' },
        { key: 'adminTabCmds', label: 'Onglet Cmds', def: 'Cmds' },
        { key: 'adminTabHistory', label: 'Onglet Histo', def: 'Histo' },
        { key: 'adminTabDrivers', label: 'Onglet Livreurs', def: 'Livreurs' },
        { key: 'adminTabMenu', label: 'Onglet Menu', def: 'Menu' },
        { key: 'kdsTitle', label: 'Titre Cuisine (KDS)', def: 'Cuisine (KDS)' },
        { key: 'btnKdsStart', label: 'Bouton KDS Prép.', def: 'En préparation' },
        { key: 'btnKdsReady', label: 'Bouton KDS Wajda', def: 'Commande Wajda' },
        { key: 'ttsNewOrder', label: 'Audio: Nouvelle Cmd', def: 'Nouvelle commande' }
    ]
};

const APP_TABS = {
    client: [
        {id: 'apparence', label: '🎨 Couleurs & Style'},
        {id: 'textes', label: '📝 Textes & Msg'},
        {id: 'menu', label: '🍔 Menu'},
        {id: 'features', label: '⚡ Fonctions'}
    ],
    driver: [
        {id: 'apparence', label: '🎨 Couleurs & Style'},
        {id: 'textes', label: '📝 Textes'}
    ],
    pos: [
        {id: 'apparence', label: '🎨 Couleurs & Style'},
        {id: 'textes', label: '📝 Textes'},
        {id: 'print', label: '🖨️ Ticket Caisse'}
    ],
    admin: [
        {id: 'apparence', label: '🎨 Couleurs & Style'},
        {id: 'textes', label: '📝 Textes'},
        {id: 'agences', label: '🏢 Agences'},
        {id: 'features', label: '⚡ Config Système'}
    ],
    kds: [
        {id: 'apparence', label: '🎨 Couleurs & Style'},
        {id: 'textes', label: '📝 Textes'},
        {id: 'features', label: '⚡ Config Cuisine'}
    ]
};

export default function AdminConfig({
    brand, setBrand,
    settings, saveSettings,
    editableMenu, setEditableMenu,
    editableBranches, setEditableBranches,
    configTab, setConfigTab,
    activeEditZone, setActiveEditZone,
    db, appId, showNotify
}) {
    const [showSimulator, setShowSimulator] = useState(false);
    const [previewApp, setPreviewApp] = useState('client'); // 'client' | 'driver' | 'pos' | 'admin'
    const [availableVoices, setAvailableVoices] = useState([]);
    const [expandedSec, setExpandedSec] = useState({ app_colors: true, txt_ui: true, txt_feat: true });
    const [expandedBranches, setExpandedBranches] = useState({});

    const toggleSec = (sec) => setExpandedSec(prev => ({ ...prev, [sec]: !prev[sec] }));
    const toggleBranch = (id) => setExpandedBranches(prev => ({ ...prev, [id]: !prev[id] }));

    useEffect(() => {
        const fetchVoices = () => {
            if ('speechSynthesis' in window) {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) setAvailableVoices(voices);
            }
        };
        fetchVoices();
        if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = fetchVoices;
        }
    }, []);

    const handlePreviewClick = (e, tab, zone) => {
        e.stopPropagation();
        setConfigTab(tab);
        setActiveEditZone(zone);
        
        // Auto-expand section when clicked from simulator
        if (tab === 'apparence') {
            if (zone.toLowerCase().includes('color')) setExpandedSec(p => ({...p, app_colors: true}));
            else if (['theme', 'cardStyle', 'layoutStyle', 'buttonStyle', 'fontFamily', 'adminDarkMode'].includes(zone)) setExpandedSec(p => ({...p, app_style: true}));
            else if (zone.startsWith('anim_')) setExpandedSec(p => ({...p, app_anims: true}));
            else setExpandedSec(p => ({...p, app_brand: true}));
        } else if (tab === 'textes') {
            if (zone.startsWith('msg')) setExpandedSec(p => ({...p, txt_msg: true}));
            else setExpandedSec(p => ({...p, txt_ui: true}));
        }

        setTimeout(() => {
            let elId = `edit-${zone}`;
            if (tab === 'menu' && zone.startsWith('menuItem_')) {
                elId = `edit-item-${zone.replace('menuItem_', '')}`;
            }
            const el = document.getElementById(elId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') { el.focus(); }
            }
        }, 150);
    };

    // دالة لجلب المفاتيح الديناميكية الخاصة بكل تطبيق (لكي نتحكم في ألوان كل تطبيق على حدة)
    const getAppKeys = (app) => {
        switch(app) {
            case 'driver': return { color: 'driverColor', bgColor: 'driverBgColor', headerColor: 'driverHeaderColor', textColor: 'driverTextColor', theme: 'driverTheme' };
            case 'pos': return { color: 'posColor', bgColor: 'posBgColor', headerColor: 'posHeaderColor', textColor: 'posTextColor', theme: 'posTheme' };
            case 'admin': return { color: 'adminColor', bgColor: 'adminBgColor', headerColor: 'adminHeaderColor', textColor: 'adminTextColor', theme: 'adminTheme' };
            default: return { color: 'color', bgColor: 'bgColor', headerColor: 'headerColor', textColor: 'textColor', theme: 'theme' };
        }
    };
    const appKeys = getAppKeys(previewApp);

    const currentTexts = TEXT_ZONES[previewApp] || TEXT_ZONES['client'];

    return (
      <div className="flex flex-col xl:flex-row gap-8 lg:gap-12 animate-in slide-in-from-bottom-5 w-full">
        <div className="flex-1 min-w-0 w-full">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl flex flex-col h-full min-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center border-b-2 border-gray-50 px-8 py-8 bg-white shrink-0">
                  <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-800 flex items-center gap-3"><Settings size={24} className="text-[#da291c]"/> Configurer le Design</h2>
                      <p className="text-xs font-bold text-gray-500 mt-1">Personnalisez l'apparence et les paramètres de l'application.</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setShowSimulator(!showSimulator)} className={`px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-sm transition-all flex items-center gap-2 border-2 ${showSimulator ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                          <Smartphone size={18}/> {showSimulator ? 'Masquer App' : 'Afficher App'}
                      </button>
                      <button onClick={async()=> { await saveSettings({...settings, menuItems: editableMenu, branches: editableBranches}); await setDoc(doc(db,'artifacts',appId,'public','data','settings','brand'), brand); showNotify("Modifications enregistrées ✅", "success"); }} className="bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2"><Save size={18}/> Enregistrer</button>
                  </div>
              </div>
              
              <div className="px-8 pt-4 pb-6 border-b-2 border-gray-50 shrink-0 bg-white">
                  {/* Multi-App Selector (The Engine Hub) */}
                  <div className="flex gap-2 mb-6 p-2 bg-gray-100 rounded-2xl w-fit border border-gray-200 shadow-inner flex-wrap">
                      <button onClick={() => { setPreviewApp('client'); setConfigTab('apparence'); }} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${previewApp === 'client' ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-800'}`}><Home size={16}/> App Client</button>
                      <button onClick={() => { setPreviewApp('driver'); setConfigTab('apparence'); }} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${previewApp === 'driver' ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-800'}`}><Truck size={16}/> App Livreur</button>
                      <button onClick={() => { setPreviewApp('pos'); setConfigTab('apparence'); }} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${previewApp === 'pos' ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-800'}`}><Monitor size={16}/> Caisse POS</button>
                      <button onClick={() => { setPreviewApp('admin'); setConfigTab('apparence'); }} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${previewApp === 'admin' ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-800'}`}><LayoutDashboard size={16}/> Idara (Admin)</button>
                      <button onClick={() => { setPreviewApp('kds'); setConfigTab('apparence'); }} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${previewApp === 'kds' ? 'bg-white shadow-md text-black' : 'text-gray-500 hover:text-gray-800'}`}><ChefHat size={16}/> Cuisine (KDS)</button>
                  </div>

                  {/* Editor Tabs */}
                  <div className="flex gap-3 overflow-x-auto no-scrollbar">
                      {(APP_TABS[previewApp] || APP_TABS['client']).map(t => (
                          <button key={t.id} onClick={() => setConfigTab(t.id)} className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all shadow-sm border ${configTab === t.id ? 'bg-black text-white border-black scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                              {t.label}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">
                 {configTab === 'apparence' && (
                 <div className="space-y-8 animate-in fade-in">
                     <div id="section-colors" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('app_colors')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Palette size={18} className="text-blue-500"/> 1. Couleurs de l'application ({previewApp.toUpperCase()})</h3>
                             {expandedSec.app_colors ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.app_colors && (
                         <div className="divide-y divide-gray-100 animate-in slide-in-from-top-2">
                             {previewApp !== 'kds' ? (
                                 [
                                 { key: appKeys.color, fallback: brand.color || '#ffbc0d', label: 'Couleur Principale (Boutons/Accents)' },
                                 { key: appKeys.textColor, fallback: brand.textColor || '#000000', label: 'Couleur des Textes Principaux' },
                                 { key: appKeys.bgColor, fallback: brand.bgColor || '#f8f9fa', label: "Arrière-plan (Background)" },
                                 { key: appKeys.headerColor, fallback: brand.headerColor || '#ffffff', label: "En-tête (Header/Navbar)" },
                             ].map(c => (
                                 <div key={c.key} className={`px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors ${activeEditZone === c.key ? 'bg-blue-50/30' : ''}`}>
                                     <span className="text-sm font-semibold text-gray-700">{c.label}</span>
                                     <div className={`flex items-center gap-3 p-1.5 rounded-xl border transition-all w-fit ${activeEditZone === c.key ? 'ring-2 ring-blue-500/20 border-blue-300 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                                         <input type="color" id={`edit-color-${c.key}`} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent" value={brand[c.key] || c.fallback} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                         <input id={`edit-${c.key}`} className="bg-transparent text-sm text-gray-800 font-mono outline-none w-24 uppercase font-bold" value={brand[c.key] || c.fallback} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                     </div>
                                 </div>
                                 ))
                             ) : (
                             <div className="px-6 py-4 bg-gray-50/30 border-t-4 border-gray-100">
                             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                 {[
                                     { key: 'kdsBgColor', fallback: brand.kdsBgColor || '#f1f5f9', label: 'Fond de la Cuisine' },
                                     { key: 'kdsBtnReadyColor', fallback: brand.kdsBtnReadyColor || '#22c55e', label: 'Bouton Prêt (Wajad)' }
                                 ].map(c => (
                                     <div key={c.key} className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${activeEditZone === c.key ? 'ring-2 ring-blue-500/20 border-blue-300 bg-white' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                         <span className="text-xs font-semibold text-gray-600">{c.label}</span>
                                         <div className="flex items-center gap-2">
                                             <input type="color" id={`edit-color-${c.key}`} className="w-6 h-6 rounded-md cursor-pointer border-0 p-0 bg-transparent" value={brand[c.key] || c.fallback} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                             <input id={`edit-${c.key}`} className="bg-transparent text-xs text-gray-800 font-mono outline-none flex-1 uppercase font-bold" value={brand[c.key] || c.fallback} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                             </div>
                             )}
                         </div>
                         )}
                     </div>

                     <div id="section-style" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('app_style')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18} className="text-blue-500"/> 2. Thème & Style</h3>
                             {expandedSec.app_style ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.app_style && (
                         <div className="divide-y divide-gray-100 animate-in slide-in-from-top-2">
                             {previewApp === 'admin' && (
                             <label className="px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors">
                                 <div className="flex flex-col">
                                     <span className="text-sm font-bold text-gray-800">Mode Sombre (Idara) 🌙</span>
                                     <span className="text-xs text-gray-500 mt-0.5">Interface d'administration en mode nuit.</span>
                                 </div>
                                 <div className={`w-12 h-6 rounded-full relative transition-all border-2 ${brand.adminDarkMode ? 'bg-blue-600 border-blue-500' : 'bg-gray-200 border-gray-300'}`}>
                                     <input type="checkbox" className="hidden" checked={brand.adminDarkMode || false} onChange={e => setBrand({...brand, adminDarkMode: e.target.checked})} />
                                     <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${brand.adminDarkMode ? 'left-6' : 'left-1'}`}></div>
                                 </div>
                             </label>
                             )}

                             {previewApp !== 'kds' && (
                             <div className="px-6 py-5 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                                 <span className="text-sm font-bold text-gray-800">Thème Layout ({previewApp})</span>
                                 <div className="flex flex-wrap gap-2">
                                     {['grid', 'list', 'premium', 'dynamic_anim'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, [appKeys.theme]: t})} onFocus={()=>setActiveEditZone(appKeys.theme)} className={`px-4 py-2 border-2 text-xs font-bold uppercase transition-all rounded-xl ${(brand[appKeys.theme] || brand.theme) === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}>{t.replace('_anim', '')}</button>
                                     ))}
                                 </div>
                             </div>
                             )}

                             {['client', 'pos', 'driver'].includes(previewApp) && (
                                 <>
                             <div className="px-6 py-5 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                                 <span className="text-sm font-bold text-gray-800">Style des Cartes</span>
                                 <div className="flex flex-wrap gap-2">
                                     {['shadow', 'border', 'flat'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, cardStyle: t})} onFocus={()=>setActiveEditZone('cardStyle')} className={`px-4 py-2 border-2 text-xs font-bold uppercase transition-all rounded-xl ${brand.cardStyle===t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}>{t}</button>
                                     ))}
                                 </div>
                             </div>

                             <div className="px-6 py-5 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                                 <span className="text-sm font-bold text-gray-800">Style de l'Interface</span>
                                 <div className="flex flex-wrap gap-2">
                                     {['modern', 'classic', 'compact'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, layoutStyle: t})} onFocus={()=>setActiveEditZone('layoutStyle')} className={`px-4 py-2 border-2 text-xs font-bold uppercase transition-all rounded-xl ${brand.layoutStyle===t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}>{t}</button>
                                     ))}
                                 </div>
                             </div>

                             <div className="px-6 py-5 flex flex-col gap-3 hover:bg-gray-50/50 transition-colors">
                                 <span className="text-sm font-bold text-gray-800">Forme des Boutons</span>
                                 <div className="flex flex-wrap gap-2">
                                     {['pill', 'rounded', 'square'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, buttonStyle: t})} onFocus={()=>setActiveEditZone('buttonStyle')} className={`px-4 py-2 border-2 text-xs font-bold uppercase transition-all ${brand.buttonStyle===t ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'} ${t==='pill'?'rounded-full':t==='rounded'?'rounded-xl':'rounded-md'}`}>{t}</button>
                                     ))}
                                 </div>
                             </div>

                             <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                                 <span className="text-sm font-bold text-gray-800">Police d'écriture (Khtot)</span>
                                 <select id="edit-fontFamily" className={`w-full md:w-64 bg-white border-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-800 outline-none transition-all cursor-pointer ${activeEditZone === 'fontFamily' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`} value={brand.fontFamily} onChange={e=>setBrand({...brand, fontFamily: e.target.value})} onFocus={()=>setActiveEditZone('fontFamily')} style={{ fontFamily: brand.fontFamily }}>
                                     {FONTS_OPTIONS.map(font => <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.name}</option>)}
                                 </select>
                             </div>
                                </>
                            )}
                         </div>
                         )}
                     </div>

                     {previewApp === 'client' && (
                     <>
                     <div id="section-animations" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('app_anims')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Zap size={18} className="text-yellow-500"/> 3. Animations <span className="ml-2">{expandedSec.app_anims ? <ChevronUp size={18} className="text-gray-500 inline"/> : <ChevronDown size={18} className="text-gray-500 inline"/>}</span></h3>
                             <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                 <input type="checkbox" className="sr-only peer" checked={brand.isAnimated || false} onChange={e => setBrand({...brand, isAnimated: e.target.checked})} />
                                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                             </label>
                         </div>
                         {brand.isAnimated && (
                             <div className={`p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in slide-in-from-top-2 ${!expandedSec.app_anims ? 'hidden' : ''}`}>
                                 {Object.entries({ photoZoom: "Zoom Photos", priceBounce: "Prix Animés", titleFloat: "Titres", categoryFloat: "Catégories", boutiqueFloat: "Logo & Header", plusPulse: "Bouton (+)", promoMarquee: "Promo" }).map(([key, label]) => {
                                     const currentAnims = brand.animations || { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false };
                                     return (
                                         <label key={key} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${activeEditZone === 'anim_'+key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                             <span className="text-xs font-bold text-gray-700">{label}</span>
                                             <input type="checkbox" checked={currentAnims[key]} onChange={(e) => setBrand({...brand, animations: {...currentAnims, [key]: e.target.checked}})} onFocus={()=>setActiveEditZone('anim_'+key)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer" />
                                         </label>
                                     )
                                 })}
                             </div>
                         )}
                     </div>
                     
                     <div id="section-brand" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('app_brand')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><ImageIcon size={18} className="text-blue-500"/> 4. Images & Marque</h3>
                             {expandedSec.app_brand ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.app_brand && (
                         <div className="divide-y divide-gray-100 animate-in slide-in-from-top-2">
                             <div className="p-6 space-y-4">
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Lien du Logo (Remplace le texte)</span>
                                     <input id="edit-logoUrl" className={`w-full bg-white border px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all ${activeEditZone === 'logoUrl' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}`} value={brand.logoUrl || ''} onChange={e=>setBrand({...brand, logoUrl: e.target.value.trim()})} onFocus={()=>setActiveEditZone('logoUrl')} placeholder="https://..." />
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Nom du Restaurant</span>
                                     <input id="edit-brandName" className={`w-full bg-white border px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all ${activeEditZone === 'brandName' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}`} value={brand.name || ''} onChange={e=>setBrand({...brand, name: e.target.value})} onFocus={()=>setActiveEditZone('brandName')} />
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Annonce Promo (Bandeau en haut)</span>
                                     <input id="edit-promoMsg" className={`w-full bg-white border px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all ${activeEditZone === 'promoMsg' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}`} value={brand.promoMsg || ''} onChange={e=>setBrand({...brand, promoMsg: e.target.value})} onFocus={()=>setActiveEditZone('promoMsg')} />
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Image de Couverture (URL)</span>
                                     <input id="edit-coverUrl" className={`w-full bg-white border px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all ${activeEditZone === 'coverUrl' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}`} value={brand.coverUrl || ''} onChange={e=>setBrand({...brand, coverUrl: e.target.value.trim()})} onFocus={()=>setActiveEditZone('coverUrl')} />
                                 </label>
                             </div>
 
                             <div className="p-6 bg-gray-50/30">
                                 <span className="text-sm font-bold text-gray-800 block mb-4">Images du Slider (Promo Client)</span>
                                 <div className="space-y-4">
                                 {[0, 1, 2].map((index) => (
                                         <div key={index} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                                             <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">Slider {index + 1}</span>
                                             <div className="space-y-3">
                                         <input 
                                                 className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                                             value={typeof brand.sliders?.[index] === 'string' ? brand.sliders[index] : (brand.sliders?.[index]?.img || '')} 
                                             onChange={(e) => {
                                                 const newSliders = [...(brand.sliders || [brand.coverUrl, '', ''])];
                                                 const current = typeof newSliders[index] === 'string' ? { img: newSliders[index], title: '', badge: '' } : (newSliders[index] || { img: '', title: '', badge: '' });
                                                 newSliders[index] = { ...current, img: e.target.value.trim() };
                                                 setBrand({ ...brand, sliders: newSliders });
                                             }} 
                                             placeholder="URL Image (https://...)" 
                                         />
                                             <div className="flex gap-3">
                                                 <input className="flex-1 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Titre (ex: Nouveau)" value={typeof brand.sliders?.[index] === 'object' ? brand.sliders[index].title || '' : ''} onChange={(e) => { const newS = [...(brand.sliders||[])]; const cur = typeof newS[index] === 'string' ? {img: newS[index]} : (newS[index] || {img:''}); newS[index] = {...cur, title: e.target.value}; setBrand({...brand, sliders: newS}); }} />
                                                 <input className="flex-1 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Badge (ex: -50%)" value={typeof brand.sliders?.[index] === 'object' ? brand.sliders[index].badge || '' : ''} onChange={(e) => { const newS = [...(brand.sliders||[])]; const cur = typeof newS[index] === 'string' ? {img: newS[index]} : (newS[index] || {img:''}); newS[index] = {...cur, badge: e.target.value}; setBrand({...brand, sliders: newS}); }} />
                                         </div>
                                     </div>
                                         </div>
                                 ))}
                             </div>
                                 <button onClick={async () => { await setDoc(doc(db,'artifacts',appId,'public','data','settings','brand'), brand); showNotify("Sliders sauvegardés dans Firebase ✅", "success"); }} className="mt-4 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                                     <Save size={16}/> Sauvegarder Sliders Directement
                                 </button>
                             </div>
                         </div>
                         )}
                     </div>
                     </>
                     )}
                 </div>
                 )}

                 {configTab === 'textes' && (
                 <div className="space-y-8 animate-in fade-in">
                     {/* Dynamic Text Editor based on selected app */}
                     <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('txt_ui')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><Type size={18} className="text-blue-500"/> 1. Textes & Boutons ({previewApp.toUpperCase()})</h3>
                             {expandedSec.txt_ui ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.txt_ui && (
                         <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
                             {currentTexts.map(t => (
                                 <label key={t.key} className="block">
                                     <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">{t.label}</span>
                                     <input id={`edit-${t.key}`} className={`w-full bg-white border px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none transition-all ${activeEditZone === t.key ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 hover:border-gray-400'}`} value={brand.texts?.[t.key] || t.def} onChange={e=>setBrand({...brand, texts: {...brand.texts, [t.key]: e.target.value}})} onFocus={()=>setActiveEditZone(t.key)} />
                                 </label>
                             ))}
                         </div>
                         )}
                     </div>

                     {previewApp === 'client' && (
                     <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('txt_msg')}>
                             <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageCircle size={18} className="text-green-500"/> 2. Messages (Automation WhatsApp)</h3>
                             {expandedSec.txt_msg ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.txt_msg && (
                         <div className="p-6 space-y-6 animate-in slide-in-from-top-2">
                             {[
                                 { id: 'msgOtp', key: 'otp', label: 'Message Inscription (Code OTP)', def: DEFAULT_BRAND.messages.otp, h: 'h-24' },
                                 { id: 'msgNewOrder', key: 'newOrder', label: 'Nouvelle Commande (App)', def: DEFAULT_BRAND.messages.newOrder, h: 'h-40' },
                                 { id: 'msgStandard', key: 'standardOrder', label: 'Commande Standard (Tél)', def: DEFAULT_BRAND.messages.standardOrder, h: 'h-32' },
                                 { id: 'msgPreparing', key: 'orderPreparing', label: 'Commande en Préparation', def: DEFAULT_BRAND.messages.orderPreparing, h: 'h-24' },
                                 { id: 'msgOutForDelivery', key: 'orderOutForDelivery', label: 'Commande en Route', def: DEFAULT_BRAND.messages.orderOutForDelivery, h: 'h-24' },
                                 { id: 'msgDelivered', key: 'orderDelivered', label: 'Commande Livrée', def: DEFAULT_BRAND.messages.orderDelivered, h: 'h-24' },
                                 { id: 'msgRejected', key: 'orderRejected', label: 'Commande Annulée', def: DEFAULT_BRAND.messages.orderRejected, h: 'h-24' }
                             ].map(t => (
                                 <label key={t.key} className="block">
                                     <span className="text-xs font-semibold text-gray-800 block mb-2">{t.label}</span>
                                     <textarea id={`edit-${t.key}`} className={`w-full bg-gray-50 border px-4 py-3 rounded-xl text-sm font-medium text-gray-700 outline-none transition-all resize-none ${activeEditZone === t.id ? 'border-green-500 ring-2 ring-green-500/20 bg-white' : 'border-gray-200 hover:border-gray-300'} ${t.h}`} value={brand.messages?.[t.key] || t.def} onChange={e=>setBrand({...brand, messages: {...brand.messages, [t.key]: e.target.value}})} onFocus={()=>setActiveEditZone(t.id)} />
                                 </label>
                             ))}
                         </div>
                         )}
                     </div>
                     )}
                 </div>
                 )}

                 {configTab === 'print' && previewApp === 'pos' && (
                     <div className="space-y-8 animate-in fade-in">
                         <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                             <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('txt_print')}>
                                 <h3 className="font-bold text-gray-800 flex items-center gap-2"><Printer size={18} className="text-gray-500"/> 3. Paramètres d'Impression (Ticket de Caisse)</h3>
                                 {expandedSec.txt_print ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                             </div>
                             {expandedSec.txt_print && (
                             <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-top-2">
                                 <label className="block md:col-span-2">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Logo du Ticket (Importer depuis PC ou URL - Noir & Blanc)</span>
                                     <div className="flex gap-2">
                                         <input className="flex-1 bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors" value={brand.ticketLogoUrl || ''} onChange={e=>setBrand({...brand, ticketLogoUrl: e.target.value})} placeholder="https://... ou cliquez sur Uploader 👉" />
                                         <label className="bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer border border-gray-900 transition-colors flex items-center justify-center whitespace-nowrap shadow-sm active:scale-95">
                                             <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={(e) => {
                                                 const file = e.target.files[0];
                                                 if (file) {
                                                     if (file.size > 200 * 1024) { 
                                                         if(showNotify) showNotify("L'image est trop grande ! Choisissez une petite image (< 200KB).", "error");
                                                         return;
                                                     }
                                                     const reader = new FileReader();
                                                     reader.onloadend = () => setBrand({ ...brand, ticketLogoUrl: reader.result });
                                                     reader.readAsDataURL(file);
                                                 }
                                             }} />
                                             📁 Uploader PC
                                         </label>
                                     </div>
                                 </label>
                                 <label className="block md:col-span-2">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Format Imprimante (عبار الورق)</span>
                                     <select className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors cursor-pointer" value={brand.ticketWidth || '100%'} onChange={e=>setBrand({...brand, ticketWidth: e.target.value})}>
                                         <option value="100%">Automatique (S'adapte à la machine) 🌟</option>
                                         <option value="58mm">صغيرة (58mm) - فرض العبار</option>
                                         <option value="80mm">كبيرة (80mm) - فرض العبار</option>
                                     </select>
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Texte d'En-tête (Sous le nom)</span>
                                     <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors" value={brand.ticketHeader || ''} onChange={e=>setBrand({...brand, ticketHeader: e.target.value})} placeholder="Ex: Bienvenue chez nous !" />
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Numéro de Téléphone (Ticket)</span>
                                     <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors" value={brand.ticketPhone || ''} onChange={e=>setBrand({...brand, ticketPhone: e.target.value})} placeholder="Ex: 06 00 00 00 00" />
                                 </label>
                                 <label className="block">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Site Web ou Instagram</span>
                                     <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors" value={brand.ticketWebsite || ''} onChange={e=>setBrand({...brand, ticketWebsite: e.target.value})} placeholder="Ex: www.monresto.ma" />
                                 </label>
                                 <label className="block md:col-span-2">
                                     <span className="text-xs font-semibold text-gray-700 block mb-1.5">Message de Fin (Footer)</span>
                                     <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors" value={brand.ticketFooter || ''} onChange={e=>setBrand({...brand, ticketFooter: e.target.value})} placeholder="Ex: Merci de votre visite et à très bientôt !" />
                                 </label>
                             </div>
                             )}
                         </div>
                     </div>
                 )}

                 {configTab === 'features' && (
                     <div className="space-y-8 animate-in fade-in">
                         <div id="section-features" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                         <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-100/50 transition-colors" onClick={() => toggleSec('txt_feat')}>
                                 <h3 className="font-bold text-gray-800 flex items-center gap-2"><Zap size={18} className="text-yellow-500"/> Configuration & Fonctionnalités ({previewApp.toUpperCase()})</h3>
                             {expandedSec.txt_feat ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                         </div>
                         {expandedSec.txt_feat && (
                         <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-top-2">
                                 {previewApp === 'client' && (
                                     <>
                             <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-sm">
                                 <input type="checkbox" checked={settings?.promoEnabled !== false} onChange={(e) => { saveSettings({...settings, promoEnabled: e.target.checked}); showNotify(e.target.checked ? "Promos activées ✅" : "Promos désactivées ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-sm font-bold text-gray-800">Activer les Codes Promo</span>
                             </label>
                             <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-sm">
                                 <input type="checkbox" checked={settings?.loyaltyEnabled !== false} onChange={(e) => { saveSettings({...settings, loyaltyEnabled: e.target.checked}); showNotify(e.target.checked ? "Fidélité activée ✅" : "Fidélité désactivée ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-sm font-bold text-gray-800">Activer les Points de Fidélité</span>
                             </label>
                             <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-sm">
                                 <input type="checkbox" checked={settings?.kitchenNoteEnabled !== false} onChange={(e) => { saveSettings({...settings, kitchenNoteEnabled: e.target.checked}); showNotify(e.target.checked ? "Notes cuisine activées ✅" : "Notes cuisine désactivées ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-sm font-bold text-gray-800">Activer les Notes de Cuisine</span>
                             </label>
                             
                             <div className="flex flex-col gap-2 p-4 rounded-xl border border-gray-200 bg-white shadow-sm md:col-span-2">
                                 <span className="text-sm font-bold text-gray-800 block">Voix Audio (Lecteur KDS/Idara)</span>
                                 <select className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500 cursor-pointer"
                                         value={brand.ttsVoiceURI || ''}
                                         onChange={e => setBrand({...brand, ttsVoiceURI: e.target.value})}>
                                     <option value="">Par défaut (Système - Français)</option>
                                     {availableVoices.map(v => (
                                         <option key={v.voiceURI} value={v.voiceURI}>
                                             {v.name} ({v.lang})
                                         </option>
                                     ))}
                                 </select>
                                         <p className="text-[11px] text-gray-500 font-medium">Choisissez la voix pour la lecture des commandes à haute voix.</p>
                             </div>
                                     </>
                                 )}

                                 {previewApp === 'kds' && (
                                     <>
                             <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm md:col-span-2">
                                 <span className="text-sm font-bold text-gray-800 block">Compte Cuisine (KDS)</span>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <input type="email" value={settings?.kdsEmail || ''} onChange={(e) => saveSettings({...settings, kdsEmail: e.target.value})} className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500" placeholder="cuisine@bocadillo.com" />
                                     <div className="flex gap-2">
                                         <input id="pwd-kds" type="password" value={settings?.kdsPassword || ''} onChange={(e) => saveSettings({...settings, kdsPassword: e.target.value})} className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500" placeholder="Mot de passe" />
                                         <button type="button" onClick={(e) => { e.preventDefault(); const el = document.getElementById(`pwd-kds`); if (el) el.type = el.type === 'password' ? 'text' : 'password'; }} className="px-4 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 shadow-sm active:scale-95 transition-all"><Eye size={18}/></button>
                                     </div>
                                 </div>
                                 <button onClick={async () => {
                                     try {
                                         if (!settings?.kdsEmail || !settings?.kdsPassword) return showNotify("Dkhel Email w Mot de passe!", "error");
                                         showNotify("Jari l'modification...", "info");
                                         const fns = getFunctions();
                                         const updateAcc = httpsCallable(fns, 'updateSecureAccount');
                                         try {
                                             await updateAcc({ email: settings.kdsEmail, password: settings.kdsPassword, appId: appId });
                                             showNotify("Mot de passe modifié b naja7 ✅", "success");
                                         } catch(updateErr) {
                                             if (updateErr.message === 'User not found' || updateErr.code === 'not-found' || updateErr.message.includes('not found')) {
                                                 const createAcc = httpsCallable(fns, 'createSecureAccount');
                                                 await createAcc({ email: settings.kdsEmail, password: settings.kdsPassword, role: 'kds', appId: appId });
                                                 showNotify("Compte Cuisine t-creya b naja7 ✅", "success");
                                             } else { throw updateErr; }
                                         }
                                     } catch(err) { console.error(err); showNotify("Erreur: " + err.message, "error"); }
                                 }} className="mt-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-700 transition-all shadow-sm active:scale-95 w-fit flex items-center gap-2"><Save size={16}/> Sauvegarder Compte Cuisine</button>
                             </div>
                             <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all shadow-sm md:col-span-2">
                                 <div className="flex-1">
                                                 <span className="text-sm font-bold text-gray-800 mb-2 block">Temps max de préparation</span>
                                     <div className="flex items-center gap-2 w-48">
                                        <input type="number" value={settings?.kitchenLateTime || 15} onChange={(e) => saveSettings({...settings, kitchenLateTime: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium outline-none focus:border-blue-500" placeholder="15" />
                                        <span className="text-sm font-medium text-gray-600">min</span>
                                     </div>
                                 </div>
                             </label>
                                     </>
                                 )}

                                 {previewApp === 'admin' && (
                                     <>
                                         <label className="flex items-start gap-3 p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-all shadow-sm md:col-span-2 cursor-pointer">
                                             <input type="checkbox" checked={settings?.isBotMaestroEnabled || false} onChange={(e) => { saveSettings({...settings, isBotMaestroEnabled: e.target.checked}); showNotify(e.target.checked ? "Bot Maestro Activé ⚡" : "Bot Maestro Désactivé ⏸️", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600 mt-0.5" />
                                             <div className="flex flex-col">
                                                 <span className="text-sm font-black text-blue-900 flex items-center gap-2"><Zap size={18} className={settings?.isBotMaestroEnabled ? "text-yellow-500 fill-yellow-500 animate-pulse" : "text-blue-400"}/> Activer Bot Maestro (Intelligence Artificielle)</span>
                                                 <span className="text-xs font-bold text-blue-700/80 mt-1 leading-relaxed">Le bot gère automatiquement les surcharges de la cuisine (Cloud Kitchen vers Zoubire) et redirige les livreurs intelligents (Mounqid) en cas de rush.</span>
                                             </div>
                                         </label>
                                     </>
                                 )}
                         </div>
                         )}
                     </div>
                 </div>
                 )}

                 {configTab === 'menu' && previewApp === 'client' && (
                        <AdminMenuEditor editableMenu={editableMenu} setEditableMenu={setEditableMenu} activeEditZone={activeEditZone} settings={settings} saveSettings={saveSettings} showNotify={showNotify} />
                 )}

                 {configTab === 'agences' && previewApp === 'admin' && (
                 <div className="animate-in fade-in space-y-8">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><MapIcon size={18} className="text-[#da291c]"/> Points de Vente</h3>
                         <button onClick={() => {
                             const newId = 'branch_'+Date.now();
                             setEditableBranches([{ id: newId, name: 'Nouvelle Agence', lat: 33.55, lng: -7.67, radius: 5, phone: '', isOpen: true, managerPin: '0000' }, ...editableBranches]);
                             setExpandedBranches(prev => ({...prev, [newId]: true}));
                         }} className="bg-black text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-gray-800 transition-all flex items-center gap-2"><Plus size={16}/> Ajouter Agence</button>
                     </div>
                     
                     <div className="space-y-4">
                         {editableBranches.map((branch, idx) => (
                             <div key={branch.id} className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden transition-all">
                                 
                                 <div className="bg-gray-50/50 px-6 py-5 cursor-pointer flex justify-between items-center hover:bg-gray-100/80 transition-colors" onClick={() => toggleBranch(branch.id)}>
                                     <div className="flex items-center gap-4">
                                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm ${branch.isOpen !== false ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                                             <MapIcon size={20}/>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="font-bold text-gray-900 text-lg">{branch.name || `Agence ${idx + 1}`}</span>
                                             <div className="flex items-center gap-2 mt-1">
                                                 <span className={`w-2 h-2 rounded-full ${branch.isOpen !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                 <span className="text-xs font-medium text-gray-500">{branch.isOpen !== false ? 'Ouverte' : 'Fermée'} • {branch.phone || 'Sans numéro'}</span>
                                             </div>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-4">
                                         <button onClick={(e)=> { e.stopPropagation(); if(window.confirm('Wach met2ked bghiti tsprimi had l-agence ?')) setEditableBranches(editableBranches.filter((_, i) => i !== idx)) }} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all border border-transparent hover:border-red-100"><Trash2 size={18}/></button>
                                         <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                                             {expandedBranches[branch.id] ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                                         </div>
                                     </div>
                                 </div>
                                 
                                 {expandedBranches[branch.id] ? (
                                 <div className="p-6 md:p-8 border-t border-gray-100 animate-in slide-in-from-top-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Nom de l'Agence</span>
                                         <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={branch.name} onChange={e=>{const b=[...editableBranches]; b[idx].name=e.target.value; setEditableBranches(b);}} placeholder="Ex: Agence Centre" />
                                     </label>
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Téléphone</span>
                                         <input className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium font-mono text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={branch.phone || ''} onChange={e=>{const b=[...editableBranches]; b[idx].phone=e.target.value; setEditableBranches(b);}} placeholder="06..." />
                                     </label>
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Latitude (GPS)</span>
                                         <input type="number" step="any" className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium font-mono text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={branch.lat || ''} onChange={e=>{const b=[...editableBranches]; b[idx].lat=parseFloat(e.target.value); setEditableBranches(b);}} placeholder="33.xxxx" />
                                     </label>
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Longitude (GPS)</span>
                                         <input type="number" step="any" className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium font-mono text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={branch.lng || ''} onChange={e=>{const b=[...editableBranches]; b[idx].lng=parseFloat(e.target.value); setEditableBranches(b);}} placeholder="-7.xxxx" />
                                     </label>
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Zone Couverture (Km)</span>
                                         <input type="number" className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" value={branch.radius || ''} onChange={e=>{const b=[...editableBranches]; b[idx].radius=Number(e.target.value); setEditableBranches(b);}} placeholder="Ex: 5" />
                                     </label>
                                     <label className="block">
                                         <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Statut</span>
                                         <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center h-[42px] shadow-sm">
                                             <label className="flex items-center gap-4 w-full cursor-pointer">
                                                 <input type="checkbox" checked={branch.isOpen !== false} onChange={e=>{const b=[...editableBranches]; b[idx].isOpen=e.target.checked; setEditableBranches(b);}} className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 accent-green-600 cursor-pointer" />
                                                 <span className={`text-sm font-bold uppercase tracking-wide ${branch.isOpen !== false ? 'text-green-700' : 'text-red-500'}`}>{branch.isOpen !== false ? 'Ouvert' : 'Fermé'}</span>
                                             </label>
                                         </div>
                                     </label>
                                 </div>

                                 {/* 🔥 MODULES AUTORISÉS (GESTION DES ACCÈS PAR AGENCE) */}
                                 <div className="p-6 bg-purple-50/50 rounded-2xl border border-purple-100 shadow-sm mb-5 mt-5">
                                     <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2"><LayoutDashboard size={18}/> Modules Autorisés (Ce que l'agence peut voir)</h4>
                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                         {[
                                             { id: 'pos', label: 'Caisse (POS)' },
                                            { id: 'pos_drawer', label: 'POS: Tiroir Caisse' },
                                            { id: 'pos_history', label: 'POS: Historique Ventes' },
                                            { id: 'pos_reports', label: 'POS: Rapports (X/Z)' },
                                            { id: 'pos_delete', label: 'POS: Supprimer Articles' },
                                             { id: 'kds', label: 'Cuisine (KDS)' },
                                             { id: 'tv', label: 'Écran TV' },
                                             { id: 'active', label: 'Commandes' },
                                             { id: 'problems', label: 'Problèmes' },
                                             { id: 'standard', label: 'Standard Tél' },
                                             { id: 'history', label: 'Historique' },
                                             { id: 'drivers', label: 'Livreurs' },
                                             { id: 'maps', label: 'Live Maps' },
                                             { id: 'clients', label: 'Comptes & Livreurs' }
                                         ].map(mod => {
                                             const hasAccess = branch.modules ? branch.modules.includes(mod.id) : true;
                                             return (
                                                 <label key={mod.id} className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-purple-100 shadow-sm hover:bg-purple-50 transition-colors">
                                                     <input 
                                                         type="checkbox" 
                                                         className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                                                         checked={hasAccess}
                                                         onChange={(e) => {
                                                             const b = [...editableBranches];
                                                            let currentMods = b[idx].modules || ['pos', 'kds', 'tv', 'active', 'problems', 'standard', 'history', 'drivers', 'maps', 'clients', 'pos_drawer', 'pos_history', 'pos_reports', 'pos_delete'];
                                                             if (e.target.checked) {
                                                                 if (!currentMods.includes(mod.id)) currentMods.push(mod.id);
                                                             } else {
                                                                 currentMods = currentMods.filter(m => m !== mod.id);
                                                             }
                                                             b[idx].modules = currentMods;
                                                             setEditableBranches(b);
                                                         }}
                                                     />
                                                     <span className="text-xs font-bold text-gray-700">{mod.label}</span>
                                                 </label>
                                             )
                                         })}
                                     </div>
                                 </div>

                                {/* 🔥 BOUTONS DE L'EN-TÊTE (CAISSE POS) */}
                                <div className="p-6 bg-orange-50/50 rounded-2xl border border-orange-100 shadow-sm mb-5 mt-5">
                                    <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                                        <Monitor size={18} /> Boutons de l'En-tête (Caisse POS)
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { id: 'commandes_web', label: 'Commandes Web' },
                                            { id: 'problemes', label: 'Problèmes' },
                                            { id: 'suivi', label: 'Suivi Web/Tél' },
                                            { id: 'pretes', label: 'Prêtes (Servir)' },
                                            { id: 'tv', label: 'Écran TV' },
                                            { id: 'standard', label: 'Standard Tél' },
                                            { id: 'kds', label: 'Cuisine (KDS)' },
                                            { id: 'quitter', label: 'Bouton Quitter' }
                                        ].map(btn => (
                                            <label key={btn.id} className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-orange-100 shadow-sm hover:bg-orange-50 transition-colors">
                                                <input type="checkbox" className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 accent-orange-600 cursor-pointer" checked={branch.posButtons ? branch.posButtons.includes(btn.id) : true} onChange={ev => { const b = [...editableBranches]; let branchPosBtns = b[idx].posButtons || ['commandes_web', 'problemes', 'suivi', 'pretes', 'tv', 'standard', 'kds', 'quitter']; if (ev.target.checked) { if (!branchPosBtns.includes(btn.id)) branchPosBtns.push(btn.id); } else { branchPosBtns = branchPosBtns.filter(id => id !== btn.id); } b[idx].posButtons = branchPosBtns; setEditableBranches(b); }} />
                                                <span className="text-xs font-bold text-gray-700">{btn.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                 <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm">
                                     <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2"><User size={18}/> Compte Manager</h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                         <label className="block">
                                             <span className="text-xs font-semibold text-blue-800 mb-1.5 block">Email</span>
                                             <input type="email" className="w-full bg-white border border-blue-200 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm" value={branch.managerEmail || ''} onChange={e=>{const b=[...editableBranches]; b[idx].managerEmail=e.target.value; setEditableBranches(b);}} placeholder="manager@..." />
                                         </label>
                                         <label className="block">
                                             <span className="text-xs font-semibold text-blue-800 mb-1.5 block">Mot de passe</span>
                                             <div className="flex gap-2">
                                                 <input id={`pwd-${idx}`} type="password" className="w-full bg-white border border-blue-200 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm" value={branch.managerPassword || ''} onChange={e=>{const b=[...editableBranches]; b[idx].managerPassword=e.target.value; setEditableBranches(b);}} />
                                                 <button type="button" onClick={(e) => { e.preventDefault(); const el = document.getElementById(`pwd-${idx}`); if (el) el.type = el.type === 'password' ? 'text' : 'password'; }} className="px-4 bg-white border border-blue-200 rounded-xl text-gray-500 hover:text-gray-900 shadow-sm active:scale-95 transition-all"><Eye size={18}/></button>
                                             </div>
                                         </label>
                                     </div>
                                     <button onClick={async () => {
                                         try {
                                             if (!branch.managerEmail || !branch.managerPassword) return showNotify("Dkhel Email w Mot de passe!", "error");
                                             showNotify("Jari l'modification...", "info");
                                             const fns = getFunctions();
                                             const updateAcc = httpsCallable(fns, 'updateSecureAccount');
                                             try {
                                                 await updateAcc({ email: branch.managerEmail, password: branch.managerPassword, appId: appId });
                                                 showNotify("Mot de passe modifié b naja7 ✅", "success");
                                             } catch(updateErr) {
                                                 if (updateErr.message === 'User not found' || updateErr.code === 'not-found' || updateErr.message.includes('not found')) {
                                                     const createAcc = httpsCallable(fns, 'createSecureAccount');
                                                     await createAcc({ email: branch.managerEmail, password: branch.managerPassword, role: 'manager', branchId: branch.id, appId: appId });
                                                     showNotify("Compte Manager t-creya b naja7 ✅", "success");
                                                 } else {
                                                     throw updateErr;
                                                 }
                                             }
                                         } catch(err) {
                                             console.error(err);
                                             showNotify("Erreur: " + err.message, "error");
                                         }
                                     }} className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95 w-full flex items-center justify-center gap-2"><Save size={16}/> Sauvegarder Compte</button>
                                 </div>
                                 </div>
                                 ) : null}
                             </div>
                         ))}
                     </div>
                 </div>
                 )}
              </div>
           </div>
        </div>

        {/* SMART PHONE / TABLET SIMULATOR */}
        {showSimulator && (
        <div className={`hidden xl:flex shrink-0 justify-center sticky top-8 h-fit animate-in slide-in-from-right-10 transition-all duration-500 ${previewApp === 'pos' ? 'w-[600px]' : 'w-[380px]'}`}>
           <div className="absolute -top-12 bg-black text-white px-4 py-2 rounded-full font-black text-xs uppercase flex items-center gap-2 shadow-lg animate-bounce z-50"><MousePointer2 size={16}/> Prévisualisation Live: {previewApp.toUpperCase()}</div>
           
           <div className={`border-[12px] border-neutral-800 ${previewApp === 'pos' ? 'rounded-[2rem] h-[500px]' : 'rounded-[3.5rem] h-[750px]'} w-full overflow-hidden relative shadow-2xl flex flex-col edit-highlight ${activeEditZone === appKeys.bgColor ? 'edit-active' : ''}`} style={{backgroundColor: brand[appKeys.bgColor] || brand.bgColor, fontFamily: brand.fontFamily}} onClick={(e) => { setConfigTab('apparence'); setActiveEditZone(appKeys.bgColor); }}>
               {previewApp !== 'pos' && <div className="absolute top-0 inset-x-0 h-7 bg-neutral-800 rounded-b-3xl w-[40%] mx-auto z-[5000]"></div>}
               
               {/* SIMULATOR: APP CLIENT */}
               {previewApp === 'client' && (() => {
                   const isAnim = brand.isAnimated === true;
                   const anims = brand.animations || { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false };
                   return (
                     <>
                  {brand.promoMsg && <div className={`text-[10px] font-black uppercase tracking-widest py-2 px-4 text-center cursor-pointer hover:opacity-80 transition-opacity z-50 relative ${activeEditZone === 'promoMsg' ? 'ring-2 ring-blue-500' : ''}`} style={{backgroundColor: brand.color, color: '#000'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'promoMsg')}>{brand.promoMsg}</div>}
                  <div className={`h-20 shrink-0 border-b relative z-40 bg-white shadow-sm flex flex-col justify-end pb-3 px-4 cursor-pointer hover:opacity-90 ${activeEditZone === 'headerColor' ? 'ring-2 ring-blue-500 inset-0' : ''}`} style={{backgroundColor: brand.headerColor}} onClick={(e) => handlePreviewClick(e, 'apparence', 'headerColor')}>
                      {brand.logoUrl ? <img src={brand.logoUrl} className={`h-8 object-contain mb-1 cursor-pointer hover:opacity-80`} onClick={(e)=>{e.stopPropagation(); handlePreviewClick(e, 'apparence', 'logoUrl');}} /> : <div className={`font-black uppercase italic cursor-pointer hover:underline`} style={{color: brand.color}} onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'apparence', 'brandName');}}>{brand.name || 'Mon Bocadillo'}</div>}
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar bg-gray-50 pb-20 relative">
                      <div className={`h-40 bg-gray-200 relative mb-4 cursor-pointer hover:opacity-90 ${activeEditZone === 'coverUrl' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundImage: `url(${brand.coverUrl})`, backgroundSize: 'cover'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'coverUrl')}>
                          <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
                          <div className="absolute bottom-4 left-4 z-10 w-full">
                              <span onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'topQuality');}} className="text-black text-[7px] font-black uppercase px-2 py-1 rounded-sm mb-1 inline-block shadow-md hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 cursor-pointer transition-all" style={{backgroundColor: brand.color}}>{brand.texts?.topQuality || 'Top Qualité'}</span>
                              <h2 onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'coverTitle');}} className="text-lg font-black italic uppercase text-white drop-shadow-md hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 cursor-pointer transition-all w-fit">{brand.texts?.coverTitle || 'A7san Mada9'}</h2>
                          </div>
                          </div>
                          <div className="px-4 grid grid-cols-2 gap-3 pb-8">
                              {(editableMenu || []).slice(0,4).map(item => (
                              <div key={item.id} className={`bg-white p-3 rounded-2xl shadow-sm flex flex-col items-center text-center edit-highlight cursor-pointer hover:ring-4 hover:ring-blue-500 transition-all ${activeEditZone === 'menuItem_' + item.id ? 'ring-4 ring-blue-500' : ''}`} onClick={(e) => handlePreviewClick(e, 'menu', 'menuItem_' + item.id)}>
                                  <div className="w-16 h-16 bg-gray-100 rounded-full mb-2 flex items-center justify-center text-2xl overflow-hidden pointer-events-none">{item.img?.startsWith('http') ? <img src={item.img} className="w-full h-full object-cover" alt="" /> : item.img}</div>
                                  <div className={`font-black text-[10px] uppercase line-clamp-1 pointer-events-none`} style={{color: brand.textColor}}>{item.name}</div>
                                  <div className={`font-black text-sm italic mt-1 pointer-events-none`} style={{color: brand.color}}>{item.price} DH</div>
                                  {item.outOfStock && <div className="mt-1 text-[8px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200 pointer-events-none">Rupture</div>}
                                  <button className={`mt-2 w-full py-1 text-[8px] font-black uppercase text-white rounded-md shadow-sm pointer-events-auto hover:ring-2 hover:ring-blue-500 transition-all ${activeEditZone === 'btnAdd' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.color}} onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'btnAdd');}}>{brand.texts?.btnAdd || 'Ajouter'}</button>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="absolute bottom-20 right-4 z-50">
                          <div className={`bg-black text-white p-3 rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all ${activeEditZone === 'btnCart' ? 'ring-4 ring-blue-500' : ''}`} onClick={(e) => handlePreviewClick(e, 'textes', 'btnCart')}>
                              <ShoppingBag size={20}/>
                              <span className="text-[10px] font-black uppercase">{brand.texts?.btnCart || 'Panier'}</span>
                              <div className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black absolute -top-1 -right-1">3</div>
                          </div>
                      </div>
                      <div className="h-16 shrink-0 bg-white border-t rounded-t-3xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] flex justify-around items-center px-4 relative z-50">
                      <div className={`flex flex-col items-center gap-1 text-gray-400 cursor-pointer hover:text-blue-500 p-2 rounded-lg transition-all ${activeEditZone === 'navMenu' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-500'}`} onClick={(e) => handlePreviewClick(e, 'textes', 'navMenu')}><Home size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navMenu || 'VOIR MENU'}</span></div>
                      <div className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 p-2 rounded-lg transition-all ${activeEditZone === 'navTrack' ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-500'}`} style={{color: brand.color}} onClick={(e) => handlePreviewClick(e, 'textes', 'navTrack')}><ShoppingBag size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navTrack || 'SUIVI'}</span></div>
                      <div className={`flex flex-col items-center gap-1 text-gray-400 cursor-pointer hover:text-blue-500 p-2 rounded-lg transition-all ${activeEditZone === 'navProfile' ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-500'}`} onClick={(e) => handlePreviewClick(e, 'textes', 'navProfile')}><User size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navProfile || 'PROFIL'}</span></div>
                      </div>
                    </>
                   );
               })()}

               {/* SIMULATOR: APP LIVREUR */}
               {previewApp === 'driver' && (
                   <div className="flex-1 flex flex-col w-full h-full relative" style={{color: brand.driverTextColor || brand.textColor || '#000'}}>
                       <div className={`h-24 pt-10 flex justify-between items-center px-5 shrink-0 shadow-md relative z-40 rounded-b-3xl border-b cursor-pointer hover:opacity-90 ${activeEditZone === 'driverHeaderColor' ? 'ring-2 ring-blue-500 inset-0' : ''}`} style={{backgroundColor: brand.driverHeaderColor || brand.headerColor || '#171717', color: '#fff'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'driverHeaderColor')}>
                           <div className="font-black italic text-lg flex items-center gap-2 hover:ring-2 hover:ring-blue-500 p-1 rounded transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'driverAppTitle');}}><Truck size={20}/> {brand.texts?.driverAppTitle || 'LIVREUR'}</div>
                           <div className="w-14 h-8 bg-green-500 rounded-full border-2 border-white/20 relative shadow-inner"><div className="w-6 h-6 bg-white rounded-full absolute right-1 top-0.5 shadow-sm"></div></div>
                       </div>
                       <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                           <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-gray-100 flex flex-col gap-3 relative overflow-hidden">
                               <div className="absolute top-0 left-0 w-full h-2" style={{backgroundColor: brand.driverColor || brand.color || '#3b82f6'}}></div>
                               <div className="flex justify-between items-start mt-2">
                                   <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CMD #8A2F</span>
                                       <span className="text-xl font-black text-gray-900 uppercase italic leading-none mt-1">Client Test</span>
                                   </div>
                                   <span className="text-2xl font-black" style={{color: brand.driverColor || brand.color || '#3b82f6'}}>85 DH</span>
                               </div>
                               <div className="h-32 bg-blue-50 border-2 border-blue-100 rounded-xl mt-2 flex flex-col items-center justify-center text-blue-400 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'driverMapBtn')}>
                                   <MapIcon size={32} className="mb-2 opacity-50"/>
                                   <span className="text-[10px] font-bold uppercase">{brand.texts?.driverMapBtn || 'Carte Live GPS'}</span>
                               </div>
                               <div className="flex gap-2 mt-2">
                                   <button className="flex-1 py-4 rounded-xl text-red-600 bg-red-50 font-black uppercase text-[10px] border border-red-100 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'driverBtnReject')}>{brand.texts?.driverBtnReject || 'Refuser'}</button>
                                   <button className={`flex-[2] py-4 rounded-xl text-white font-black uppercase text-xs shadow-lg cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all ${activeEditZone === 'driverColor' || activeEditZone === 'driverBtnAccept' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.driverColor || brand.color || '#3b82f6'}} onClick={(e) => handlePreviewClick(e, 'textes', 'driverBtnAccept')}>{brand.texts?.driverBtnAccept || 'Accepter (Prendre)'}</button>
                               </div>
                           </div>
                       </div>
                       <div className="h-16 shrink-0 bg-white border-t flex justify-around items-center px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] rounded-t-3xl relative z-50">
                           <div className="flex flex-col items-center cursor-pointer hover:ring-2 hover:ring-blue-500 p-1 rounded transition-all" style={{color: brand.driverColor || brand.color || '#3b82f6'}} onClick={(e) => handlePreviewClick(e, 'textes', 'driverTabMissions')}><Truck size={22}/><span className="text-[9px] font-black uppercase mt-1">{brand.texts?.driverTabMissions || 'Missions'}</span></div>
                           <div className="flex flex-col items-center text-gray-400 cursor-pointer hover:ring-2 hover:ring-blue-500 p-1 rounded transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'driverTabHistory')}><History size={22}/><span className="text-[9px] font-black uppercase mt-1">{brand.texts?.driverTabHistory || 'Historique'}</span></div>
                       </div>
                   </div>
               )}

               {/* SIMULATOR: CAISSE POS (Landscape/Tablet style) */}
               {previewApp === 'pos' && (
                   <div className="flex-1 flex flex-col w-full h-full relative" style={{color: brand.posTextColor || brand.textColor || '#000'}}>
                       <div className={`h-16 flex justify-between items-center px-6 shrink-0 shadow-sm border-b cursor-pointer hover:opacity-90 ${activeEditZone === 'posHeaderColor' ? 'ring-2 ring-blue-500 inset-0' : ''}`} style={{backgroundColor: brand.posHeaderColor || brand.headerColor || '#ffffff', color: brand.posColor || brand.color || '#4f46e5'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'posHeaderColor')}>
                           <div className="font-black italic text-xl flex items-center gap-3 hover:ring-2 hover:ring-blue-500 p-1 rounded cursor-pointer transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'posAppTitle');}}><Monitor size={24}/> {brand.texts?.posAppTitle || 'CAISSE POS'}</div>
                           <div className="flex gap-2"><div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500"><History size={16}/></div></div>
                       </div>
                       <div className="flex-1 flex overflow-hidden">
                           <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col">
                               <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
                                   <div className={`px-5 py-2 rounded-xl text-white text-[11px] font-black shadow-md cursor-pointer hover:opacity-90 ${activeEditZone === 'posColor' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.posColor || brand.color || '#4f46e5'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'posColor')}>Burgers</div>
                                   <div className="px-5 py-2 rounded-xl bg-white text-gray-600 text-[11px] font-black border border-gray-200 shadow-sm">Tacos</div>
                                   <div className="px-5 py-2 rounded-xl bg-white text-gray-600 text-[11px] font-black border border-gray-200 shadow-sm">Boissons</div>
                               </div>
                               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                   <div className="bg-white p-3 rounded-2xl shadow-sm border-2 border-gray-100 flex flex-col items-center justify-center h-28 hover:border-blue-400 transition-colors"><span className="text-4xl mb-1">🍔</span><span className="text-[10px] font-bold text-gray-700 text-center">Cheese Burger</span><span className="font-black text-sm mt-1" style={{color: brand.posColor || brand.color || '#4f46e5'}}>35 DH</span></div>
                                   <div className="bg-white p-3 rounded-2xl shadow-sm border-2 border-gray-100 flex flex-col items-center justify-center h-28 hover:border-blue-400 transition-colors"><span className="text-4xl mb-1">🍟</span><span className="text-[10px] font-bold text-gray-700 text-center">Frites</span><span className="font-black text-sm mt-1" style={{color: brand.posColor || brand.color || '#4f46e5'}}>15 DH</span></div>
                               </div>
                           </div>
                           <div className="w-[200px] bg-white border-l-2 border-gray-100 shadow-2xl flex flex-col z-20">
                               <div className="p-4 border-b-2 border-gray-50 text-sm font-black flex justify-between items-center" style={{color: brand.posColor || brand.color || '#4f46e5'}}><span className="flex items-center gap-2 hover:ring-2 hover:ring-blue-500 p-1 rounded cursor-pointer transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'posTabOrder')}><ShoppingBag size={16}/> {brand.texts?.posTabOrder || 'Commande'}</span></div>
                               <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-gray-50/50">
                                   <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                                       <div className="flex justify-between text-[11px] font-bold text-gray-800"><span>Cheese Burger</span><span style={{color: brand.posColor || brand.color || '#4f46e5'}}>35 DH</span></div>
                                       <div className="flex justify-between items-center mt-1"><div className="flex gap-3 bg-gray-100 rounded-md p-1"><span className="px-1 text-[10px]">-</span><span className="text-[10px] font-black">1</span><span className="px-1 text-[10px]">+</span></div></div>
                                   </div>
                               </div>
                               <div className="p-4 border-t-2 border-gray-50 bg-white">
                                   <div className="flex justify-between text-xs font-black mb-3 text-gray-900"><span className="hover:ring-2 hover:ring-blue-500 p-0.5 rounded cursor-pointer transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'posTotal')}>{brand.texts?.posTotal || 'Total à payer'}</span><span className="text-base" style={{color: brand.posColor || brand.color || '#4f46e5'}}>35 DH</span></div>
                                   <div className="flex gap-2 mb-3"><button className="flex-1 py-1.5 bg-gray-100 text-[9px] font-bold rounded-md hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'posCash')}>{brand.texts?.posCash || 'Espèce'}</button><button className="flex-1 py-1.5 bg-gray-100 text-[9px] font-bold rounded-md hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'posCard')}>{brand.texts?.posCard || 'Carte'}</button></div>
                                   <button className={`w-full py-4 rounded-xl text-white font-black text-sm uppercase shadow-lg cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all ${activeEditZone === 'posColor' || activeEditZone === 'posBtnPay' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.posColor || brand.color || '#4f46e5'}} onClick={(e) => handlePreviewClick(e, 'textes', 'posBtnPay')}>{brand.texts?.posBtnPay || 'Encaissement'}</button>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {/* SIMULATOR: ADMIN IDARA */}
               {previewApp === 'admin' && (
                   <div className="flex-1 flex flex-col w-full h-full relative" style={{color: brand.adminTextColor || brand.textColor || '#000'}}>
                       <div className={`h-20 pt-8 flex items-center justify-between px-5 shrink-0 shadow-sm border-b cursor-pointer hover:opacity-90 ${activeEditZone === 'adminHeaderColor' ? 'ring-2 ring-blue-500 inset-0' : ''}`} style={{backgroundColor: brand.adminHeaderColor || brand.headerColor || '#ffffff', color: brand.adminColor || brand.color || '#000'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'adminHeaderColor')}>
                           <div className="font-black italic text-xl flex items-center gap-2 hover:ring-2 hover:ring-blue-500 p-1 rounded cursor-pointer transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'adminAppTitle');}}><LayoutDashboard size={20}/> {brand.texts?.adminAppTitle || 'IDARA'}</div>
                           <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'adminStatusOpen');}}><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> {brand.texts?.adminStatusOpen || 'Ouvert'}</div>
                       </div>
                       <div className="flex-1 p-5 overflow-y-auto space-y-6 bg-gray-50">
                           <div className="grid grid-cols-2 gap-4">
                               <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminBoxPending')}>
                                   <span className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1">{brand.texts?.adminBoxPending || 'En Attente'}</span>
                                   <span className="text-3xl font-black text-red-600">4</span>
                               </div>
                               <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100 flex flex-col items-center justify-center shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminBoxEnRoute')}>
                                   <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">{brand.texts?.adminBoxEnRoute || 'En Route'}</span>
                                   <span className="text-3xl font-black text-blue-600">7</span>
                               </div>
                           </div>
                           
                           <div>
                               <h4 className="text-[10px] font-black uppercase text-gray-500 mb-3 flex items-center gap-2 cursor-pointer hover:ring-2 hover:ring-blue-500 p-1 rounded w-fit transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminBoxNewCmd')}><ShoppingBag size={14}/> {brand.texts?.adminBoxNewCmd || 'Nouvelles Commandes'}</h4>
                               <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-gray-100 relative overflow-hidden">
                                   <div className="absolute top-0 left-0 w-full h-1.5" style={{backgroundColor: brand.adminColor || brand.color || '#000'}}></div>
                                   <div className="flex justify-between items-start mb-4 mt-1">
                                       <div className="flex flex-col">
                                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CMD #9X8V</span>
                                           <span className="text-lg font-black text-gray-900 uppercase italic">Client Admin</span>
                                       </div>
                                       <span className="text-2xl font-black" style={{color: brand.adminColor || brand.color || '#000'}}>145 DH</span>
                                   </div>
                                   <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-[10px] font-bold text-gray-700 mb-4 space-y-1">
                                       <div className="flex items-center gap-2"><MapPin size={12} className="text-gray-400"/> Hay Riad, Rue 4</div>
                                   </div>
                                   <div className="flex gap-2">
                                       <button className={`flex-[2] py-3.5 rounded-xl text-white font-black text-[10px] uppercase shadow-md cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all ${activeEditZone === 'adminColor' || activeEditZone === 'btnAdminOfficial' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.adminColor || brand.color || '#000'}} onClick={(e) => handlePreviewClick(e, 'textes', 'btnAdminOfficial')}>{brand.texts?.btnAdminOfficial || '1. Officiel'}</button>
                                       <button className="flex-[2] py-3.5 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase shadow-md flex items-center justify-center gap-1 cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'btnAdminFreelance')}><Truck size={14}/> {brand.texts?.btnAdminFreelance || 'Livreur'}</button>
                                   </div>
                               </div>
                           </div>
                       </div>
                       <div className="h-16 shrink-0 bg-neutral-900 text-white border-t flex justify-around items-center px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] rounded-t-3xl relative z-50">
                           <div className="flex flex-col items-center text-white cursor-pointer hover:text-blue-400 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminTabCmds')}><Home size={18}/><span className="text-[8px] font-bold mt-1">{brand.texts?.adminTabCmds || 'Cmds'}</span></div>
                           <div className="flex flex-col items-center text-gray-500 cursor-pointer hover:text-blue-400 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminTabHistory')}><History size={18}/><span className="text-[8px] font-bold mt-1">{brand.texts?.adminTabHistory || 'Histo'}</span></div>
                           <div className="flex flex-col items-center text-gray-500 cursor-pointer hover:text-blue-400 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminTabDrivers')}><Truck size={18}/><span className="text-[8px] font-bold mt-1">{brand.texts?.adminTabDrivers || 'Livreurs'}</span></div>
                           <div className="flex flex-col items-center text-gray-500 cursor-pointer hover:text-blue-400 transition-all" onClick={(e) => handlePreviewClick(e, 'textes', 'adminTabMenu')}><Menu size={18}/><span className="text-[8px] font-bold mt-1">{brand.texts?.adminTabMenu || 'Menu'}</span></div>
                       </div>
                   </div>
               )}

               {/* SIMULATOR: CUISINE KDS (Landscape style) */}
               {previewApp === 'kds' && (
                   <div className={`flex-1 flex flex-col w-full h-full relative cursor-pointer ${activeEditZone === 'kdsBgColor' ? 'ring-inset ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.kdsBgColor || '#f1f5f9', color: '#000'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'kdsBgColor')}>
                       <div className="h-16 flex justify-between items-center px-6 shrink-0 shadow-sm border-b bg-white">
                           <div className="font-black italic text-xl flex items-center gap-3 hover:ring-2 hover:ring-blue-500 p-1 rounded cursor-pointer transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'kdsTitle');}}><Monitor size={24}/> {brand.texts?.kdsTitle || 'Cuisine (KDS)'}</div>
                           <div className="text-2xl font-black tabular-nums">14:30:00</div>
                       </div>
                       <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                               <div className="bg-blue-600 text-white p-3 flex justify-between items-center font-black">
                                   <span>#2415 - Sur Place</span>
                                   <span>12 min</span>
                               </div>
                               <div className="p-4 space-y-3 font-bold text-sm">
                                   <div className="flex justify-between border-b pb-2"><span>2x Tacos Mixte</span></div>
                                   <div className="flex justify-between border-b pb-2 text-red-500"><span>1x Sans Oignon</span></div>
                               </div>
                               <div className="p-4 bg-gray-50 flex gap-2">
                                   <button className="flex-1 py-3 bg-gray-200 text-gray-700 font-black text-xs uppercase rounded-xl hover:ring-2 hover:ring-blue-500 transition-all" onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'btnKdsStart');}}>{brand.texts?.btnKdsStart || 'En préparation'}</button>
                                   <button className={`flex-1 py-3 text-white font-black text-xs uppercase rounded-xl shadow-md hover:ring-2 hover:ring-blue-500 transition-all ${activeEditZone === 'kdsBtnReadyColor' || activeEditZone === 'btnKdsReady' ? 'ring-4 ring-blue-500' : ''}`} style={{backgroundColor: brand.kdsBtnReadyColor || '#22c55e'}} onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'textes', 'btnKdsReady');}}>{brand.texts?.btnKdsReady || 'Commande Wajda'}</button>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>
        </div>
        )}
      </div>
    );
}