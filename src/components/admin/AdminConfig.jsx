import React from 'react';
import { 
    Edit3, Palette, Settings, Zap, ImageIcon, Type, AlignLeft, Save,
    MessageCircle, MapIcon, MousePointer2, Home, ShoppingBag, User, Trash2,
    Plus, Eye
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { FONTS_OPTIONS, DEFAULT_BRAND } from '../../config/constants';
import AdminMenuEditor from './AdminMenuEditor';

export default function AdminConfig({
    brand, setBrand,
    settings, saveSettings,
    editableMenu, setEditableMenu,
    editableBranches, setEditableBranches,
    configTab, setConfigTab,
    activeEditZone, setActiveEditZone,
    db, appId, showNotify
}) {
    const handlePreviewClick = (e, tab, zone) => {
        e.stopPropagation();
        setConfigTab(tab);
        setActiveEditZone(zone);
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

    return (
      <div className="flex flex-col xl:flex-row gap-8 animate-in slide-in-from-bottom-5">
        <div className="flex-1 max-w-3xl">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl flex flex-col h-full min-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center border-b-2 border-gray-50 px-8 py-8 bg-white shrink-0">
                  <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-800 flex items-center gap-3"><Settings size={24} className="text-[#da291c]"/> Configurer le Design</h2>
                      <p className="text-xs font-bold text-gray-500 mt-1">Personnalisez l'apparence et les paramètres de l'application.</p>
                  </div>
                  <button onClick={async()=> { await saveSettings({...settings, menuItems: editableMenu, branches: editableBranches}); await setDoc(doc(db,'artifacts',appId,'public','data','settings','brand'), brand); showNotify("Modifications enregistrées ✅", "success"); }} className="bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2"><Save size={18}/> Enregistrer</button>
              </div>
              
              <div className="px-8 pt-4 pb-6 border-b-2 border-gray-50 shrink-0 bg-white">
                  <div className="flex gap-3 overflow-x-auto no-scrollbar">
                      {[
                          {id: 'apparence', label: '🎨 Apparence'},
                          {id: 'textes', label: '📝 Textes & Messages'},
                          {id: 'menu', label: '🍔 Menu'},
                          {id: 'agences', label: '🏢 Agences'}
                      ].map(t => (
                          <button key={t.id} onClick={() => setConfigTab(t.id)} className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all shadow-sm border ${configTab === t.id ? 'bg-black text-white border-black scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                              {t.label}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">
                 {configTab === 'apparence' && (
                 <div className="space-y-8 animate-in fade-in">
                     <div id="section-colors" className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><Palette size={16} className="text-gray-500"/> 1. Les Couleurs</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {[
                                 { key: 'color', label: 'Couleur Principale (Boutons)', val: brand.color || '#ffbc0d' },
                                 { key: 'textColor', label: 'Couleur des Textes Principaux', val: brand.textColor || '#000000' },
                                 { key: 'bgColor', label: "Khalfia dyal l'App (Background)", val: brand.bgColor || '#f8f9fa' },
                                 { key: 'headerColor', label: "L-Fou9 dyal l'App (Header)", val: brand.headerColor || '#ffffff' },
                             ].map(c => (
                                 <label key={c.key} className="block">
                                     <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">{c.label}</span>
                                     <div className={`flex items-center gap-2 p-2 rounded-2xl border transition-all shadow-sm ${activeEditZone === c.key ? 'ring-4 ring-blue-500/20 bg-blue-50 border-blue-300' : 'border-gray-200 bg-white focus-within:bg-gray-50 focus-within:border-gray-300'}`}>
                                     <input type="color" id={`edit-color-${c.key}`} className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent" value={c.val} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                     <input id={`edit-${c.key}`} className="bg-transparent text-sm text-gray-800 font-mono outline-none flex-1 uppercase font-bold" value={c.val} onChange={e=>setBrand({...brand, [c.key]: e.target.value})} onFocus={()=>setActiveEditZone(c.key)} />
                                     </div>
                                 </label>
                             ))}
                         </div>
                     </div>

                     <div id="section-style" className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><Settings size={16} className="text-gray-500"/> 2. Thème & Style</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Thème de la liste du Menu</span>
                                 <div className={`flex gap-2 p-2 rounded-2xl transition-all ${activeEditZone === 'theme' ? 'ring-4 ring-blue-500/20 bg-blue-50 border border-blue-200' : ''}`}>
                                     {['grid', 'list', 'premium', 'dynamic_anim'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, theme: t})} onFocus={()=>setActiveEditZone('theme')} className={`flex-1 py-3 border-2 text-[10px] font-black uppercase transition-all rounded-xl ${brand.theme===t ? 'border-[#ffbc0d] bg-[#ffbc0d]/10 text-black shadow-sm' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}>{t.replace('_anim', '')}</button>
                                     ))}
                                 </div>
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Style des Cartes</span>
                                 <div className={`flex gap-2 p-2 rounded-2xl transition-all ${activeEditZone === 'cardStyle' ? 'ring-4 ring-blue-500/20 bg-blue-50 border border-blue-200' : ''}`}>
                                     {['shadow', 'border', 'flat'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, cardStyle: t})} onFocus={()=>setActiveEditZone('cardStyle')} className={`flex-1 py-3 border-2 text-[10px] font-black uppercase transition-all rounded-xl ${brand.cardStyle===t ? 'border-[#ffbc0d] bg-[#ffbc0d]/10 text-black shadow-sm' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}>{t}</button>
                                     ))}
                                 </div>
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Style de l'Interface</span>
                                 <div className={`flex gap-2 p-2 rounded-2xl transition-all ${activeEditZone === 'layoutStyle' ? 'ring-4 ring-blue-500/20 bg-blue-50 border border-blue-200' : ''}`}>
                                     {['modern', 'classic', 'compact'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, layoutStyle: t})} onFocus={()=>setActiveEditZone('layoutStyle')} className={`flex-1 py-3 border-2 text-[10px] font-black uppercase transition-all rounded-xl ${brand.layoutStyle===t ? 'border-[#ffbc0d] bg-[#ffbc0d]/10 text-black shadow-sm' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}>{t}</button>
                                     ))}
                                 </div>
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Forme des Boutons</span>
                                 <div className={`flex gap-2 p-2 rounded-2xl transition-all ${activeEditZone === 'buttonStyle' ? 'ring-4 ring-blue-500/20 bg-blue-50 border border-blue-200' : ''}`}>
                                     {['pill', 'rounded', 'square'].map(t => (
                                         <button key={t} onClick={()=>setBrand({...brand, buttonStyle: t})} onFocus={()=>setActiveEditZone('buttonStyle')} className={`flex-1 py-3 border-2 text-[10px] font-black uppercase transition-all ${brand.buttonStyle===t ? 'border-black bg-black text-white shadow-sm' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'} ${t==='pill'?'rounded-full':t==='rounded'?'rounded-xl':'rounded-md'}`}>{t}</button>
                                     ))}
                                 </div>
                             </label>
                             <label className="block md:col-span-2">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Police d'écriture (Khtot)</span>
                             <select id="edit-fontFamily" className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-black text-gray-800 outline-none transition-all shadow-sm ${activeEditZone === 'fontFamily' ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.fontFamily} onChange={e=>setBrand({...brand, fontFamily: e.target.value})} onFocus={()=>setActiveEditZone('fontFamily')} style={{ fontFamily: brand.fontFamily }}>
                                     {FONTS_OPTIONS.map(font => <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.name}</option>)}
                                 </select>
                             </label>
                         </div>
                     </div>

                     <div id="section-animations" className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <div className="flex justify-between items-center mb-6">
                             <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><Zap size={16} className="text-yellow-500"/> 3. Animations & Mouvements</h3>
                             <button onClick={() => setBrand({...brand, isAnimated: !brand.isAnimated})} className={`w-14 h-8 rounded-full relative transition-all shadow-inner border-2 ${brand.isAnimated ? 'bg-blue-600 border-blue-500' : 'bg-gray-300 border-gray-400'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${brand.isAnimated ? 'left-7' : 'left-1'}`}></div></button>
                         </div>
                         {brand.isAnimated && (
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-50">
                                 {Object.entries({ photoZoom: "Zoom Photos", priceBounce: "Prix Animés", titleFloat: "Titres", categoryFloat: "Catégories", boutiqueFloat: "Logo & Header", plusPulse: "Bouton (+)", promoMarquee: "Promo" }).map(([key, label]) => {
                                     const currentAnims = brand.animations || { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false };
                                     return (
                                         <label key={key} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${activeEditZone === 'anim_'+key ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}>
                                             <input type="checkbox" checked={currentAnims[key]} onChange={(e) => setBrand({...brand, animations: {...currentAnims, [key]: e.target.checked}})} onFocus={()=>setActiveEditZone('anim_'+key)} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer" />
                                             <span className="text-[11px] font-bold text-gray-700 uppercase">{label}</span>
                                         </label>
                                     )
                                 })}
                             </div>
                         )}
                     </div>
                     
                     <div id="section-brand" className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><ImageIcon size={16} className="text-gray-500"/> 4. Images & Marque</h3>
                         <div className="space-y-5">
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Lien du Logo (Remplace le texte)</span>
                             <input id="edit-logoUrl" className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold font-mono outline-none transition-all shadow-sm ${activeEditZone === 'logoUrl' ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.logoUrl || ''} onChange={e=>setBrand({...brand, logoUrl: e.target.value.trim()})} onFocus={()=>setActiveEditZone('logoUrl')} placeholder="https://..." />
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Nom du Restaurant</span>
                             <input id="edit-brandName" className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold outline-none transition-all shadow-sm ${activeEditZone === 'brandName' ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.name || ''} onChange={e=>setBrand({...brand, name: e.target.value})} onFocus={()=>setActiveEditZone('brandName')} />
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Annonce Promo (Bandeau en haut)</span>
                             <input id="edit-promoMsg" className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold outline-none transition-all shadow-sm ${activeEditZone === 'promoMsg' ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.promoMsg || ''} onChange={e=>setBrand({...brand, promoMsg: e.target.value})} onFocus={()=>setActiveEditZone('promoMsg')} />
                             </label>
                             <label className="block">
                                 <span className="text-[10px] font-black text-gray-400 uppercase ml-2 block mb-2">Image de Couverture (URL)</span>
                             <input id="edit-coverUrl" className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold font-mono outline-none transition-all shadow-sm ${activeEditZone === 'coverUrl' ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.coverUrl || ''} onChange={e=>setBrand({...brand, coverUrl: e.target.value.trim()})} onFocus={()=>setActiveEditZone('coverUrl')} />
                             </label>
                         </div>
                     </div>
                 </div>
                 )}

                 {configTab === 'textes' && (
                 <div className="space-y-8 animate-in fade-in">
                     <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><Type size={16} className="text-gray-500"/> 1. Textes des Boutons (Client)</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                             {[
                                 { key: 'navMenu', label: 'Menu l-Ta7t', def: 'VOIR MENU' },
                                 { key: 'navTrack', label: 'Suivi l-Ta7t', def: 'SUIVI' },
                                 { key: 'navProfile', label: 'Profil l-Ta7t', def: 'PROFIL' },
                                 { key: 'btnAdd', label: 'Ajouter (+)', def: 'Ajouter' },
                                 { key: 'btnCart', label: 'Panier Kbir', def: 'Panier' },
                                 { key: 'btnOrder', label: 'Confirmer', def: 'Commander' },
                                 { key: 'cartEmptyTitle', label: 'Titre Panier Vide', def: 'Panier vide' },
                                 { key: 'cartEmptyDesc', label: 'Message Panier Vide', def: 'Ajoutez des plats !' },
                                 { key: 'checkoutTitle', label: 'Titre Paiement', def: 'Confirmation' }
                             ].map(t => (
                                 <label key={t.key} className="block">
                                     <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">{t.label}</span>
                                 <input id={`edit-${t.key}`} className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none transition-all shadow-inner ${activeEditZone === t.key ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.texts?.[t.key] || t.def} onChange={e=>setBrand({...brand, texts: {...brand.texts, [t.key]: e.target.value}})} onFocus={()=>setActiveEditZone(t.key)} />
                                 </label>
                             ))}
                         </div>
                     </div>

                     <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><AlignLeft size={16} className="text-gray-500"/> 2. Textes Idara & Livreur</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                             {[
                                 { key: 'adminTitle', label: 'Titre Admin', def: 'Idara' },
                                 { key: 'btnAdminOfficial', label: 'Bouton Officiel', def: '1. Officiel' },
                                 { key: 'btnReady', label: 'Bouton Prêt', def: 'Prêt (Wajad)' },
                                 { key: 'btnAdminAskDriver', label: 'Demander Livreur', def: 'Demander Livreur' },
                                 { key: 'btnOutDelivery', label: 'En route', def: 'En route 🛵' },
                                 { key: 'btnAcceptDriver', label: 'Livreur: Accepter', def: 'Accepter' },
                                 { key: 'btnRejectDriver', label: 'Livreur: Rejeter', def: 'Rejeter' },
                                 { key: 'btnPickedUp', label: 'Livreur: Récupéré', def: "J'ai récupéré" },
                                 { key: 'btnDelivered', label: 'Livreur: Livré', def: 'Livrée' }
                             ].map(t => (
                                 <label key={t.key} className="block">
                                     <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">{t.label}</span>
                                 <input id={`edit-${t.key}`} className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none transition-all shadow-inner ${activeEditZone === t.key ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'}`} value={brand.texts?.[t.key] || t.def} onChange={e=>setBrand({...brand, texts: {...brand.texts, [t.key]: e.target.value}})} onFocus={()=>setActiveEditZone(t.key)} />
                                 </label>
                             ))}
                         </div>
                     </div>

                     <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><MessageCircle size={16} className="text-gray-500"/> 3. Messages (Automation)</h3>
                         <div className="space-y-5">
                             {[
                                 { id: 'msgOtp', key: 'otp', label: 'Message Inscription (Code OTP)', def: DEFAULT_BRAND.messages.otp, h: 'h-16' },
                                 { id: 'msgNewOrder', key: 'newOrder', label: 'Nouvelle Commande (App)', def: DEFAULT_BRAND.messages.newOrder, h: 'h-24' },
                                 { id: 'msgStandard', key: 'standardOrder', label: 'Commande Standard (Tél)', def: DEFAULT_BRAND.messages.standardOrder, h: 'h-20' },
                                 { id: 'msgPreparing', key: 'orderPreparing', label: 'Commande en Préparation', def: DEFAULT_BRAND.messages.orderPreparing, h: 'h-16' },
                                 { id: 'msgOutForDelivery', key: 'orderOutForDelivery', label: 'Commande en Route', def: DEFAULT_BRAND.messages.orderOutForDelivery, h: 'h-16' },
                                 { id: 'msgDelivered', key: 'orderDelivered', label: 'Commande Livrée', def: DEFAULT_BRAND.messages.orderDelivered, h: 'h-16' },
                                 { id: 'msgRejected', key: 'orderRejected', label: 'Commande Annulée', def: DEFAULT_BRAND.messages.orderRejected, h: 'h-16' }
                             ].map(t => (
                                 <label key={t.key} className="block">
                                     <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">{t.label}</span>
                                 <textarea id={`edit-${t.key}`} className={`w-full bg-gray-50 border-2 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none transition-all shadow-inner resize-none ${activeEditZone === t.id ? 'border-blue-500 ring-4 ring-blue-500/20 bg-white' : 'border-gray-200'} ${t.h}`} value={brand.messages?.[t.key] || t.def} onChange={e=>setBrand({...brand, messages: {...brand.messages, [t.key]: e.target.value}})} onFocus={()=>setActiveEditZone(t.id)} />
                                 </label>
                             ))}
                         </div>
                     </div>

                     <div id="section-features" className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl mt-8">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-6"><Zap size={16} className="text-gray-500"/> 5. Fonctionnalités</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                             <label className="flex items-center gap-3 p-4 rounded-2xl border bg-gray-50 hover:bg-white transition-all cursor-pointer shadow-sm border-gray-200">
                                 <input type="checkbox" checked={settings?.promoEnabled !== false} onChange={(e) => { saveSettings({...settings, promoEnabled: e.target.checked}); showNotify(e.target.checked ? "Promos activées ✅" : "Promos désactivées ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-xs font-black text-gray-700 uppercase">Activer les Codes Promo</span>
                             </label>
                             <label className="flex items-center gap-3 p-4 rounded-2xl border bg-gray-50 hover:bg-white transition-all cursor-pointer shadow-sm border-gray-200">
                                 <input type="checkbox" checked={settings?.loyaltyEnabled !== false} onChange={(e) => { saveSettings({...settings, loyaltyEnabled: e.target.checked}); showNotify(e.target.checked ? "Fidélité activée ✅" : "Fidélité désactivée ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-xs font-black text-gray-700 uppercase">Activer les Points de Fidélité</span>
                             </label>
                             <label className="flex items-center gap-3 p-4 rounded-2xl border bg-gray-50 hover:bg-white transition-all cursor-pointer shadow-sm border-gray-200">
                                 <input type="checkbox" checked={settings?.kitchenNoteEnabled !== false} onChange={(e) => { saveSettings({...settings, kitchenNoteEnabled: e.target.checked}); showNotify(e.target.checked ? "Notes cuisine activées ✅" : "Notes cuisine désactivées ❌", "success"); }} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600" />
                                 <span className="text-xs font-black text-gray-700 uppercase">Activer les Notes de Cuisine</span>
                             </label>
                         </div>
                     </div>
                 </div>
                 )}

                 {configTab === 'menu' && (
                    <AdminMenuEditor editableMenu={editableMenu} setEditableMenu={setEditableMenu} activeEditZone={activeEditZone} />
                 )}

                 {configTab === 'agences' && (
                 <div className="animate-in fade-in space-y-8">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><MapIcon size={18} className="text-[#da291c]"/> Points de Vente</h3>
                         <button onClick={() => setEditableBranches([{ id: 'branch_'+Date.now(), name: '', lat: 33.55, lng: -7.67, radius: 5, phone: '', isOpen: true, managerPin: '0000' }, ...editableBranches])} className="bg-black text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-gray-800 transition-all flex items-center gap-2"><Plus size={16}/> Ajouter Agence</button>
                     </div>
                     
                     <div className="space-y-6">
                         {editableBranches.map((branch, idx) => (
                             <div key={branch.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative">
                                 <button onClick={()=> { if(window.confirm('Wach met2ked bghiti tsprimi had l-agence ?')) setEditableBranches(editableBranches.filter((_, i) => i !== idx)) }} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 hover:bg-red-50 p-3 rounded-full transition-all"><Trash2 size={20}/></button>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pr-14 mb-8">
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Nom de l'Agence</span>
                                         <input className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner" value={branch.name} onChange={e=>{const b=[...editableBranches]; b[idx].name=e.target.value; setEditableBranches(b);}} placeholder="Ex: Agence Centre" />
                                     </label>
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Téléphone</span>
                                         <input className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold font-mono text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner" value={branch.phone || ''} onChange={e=>{const b=[...editableBranches]; b[idx].phone=e.target.value; setEditableBranches(b);}} placeholder="06..." />
                                     </label>
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Latitude (GPS)</span>
                                         <input type="number" step="any" className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold font-mono text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner" value={branch.lat || ''} onChange={e=>{const b=[...editableBranches]; b[idx].lat=parseFloat(e.target.value); setEditableBranches(b);}} placeholder="33.xxxx" />
                                     </label>
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Longitude (GPS)</span>
                                         <input type="number" step="any" className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold font-mono text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner" value={branch.lng || ''} onChange={e=>{const b=[...editableBranches]; b[idx].lng=parseFloat(e.target.value); setEditableBranches(b);}} placeholder="-7.xxxx" />
                                     </label>
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Zone Couverture (Km)</span>
                                         <input type="number" className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner" value={branch.radius || ''} onChange={e=>{const b=[...editableBranches]; b[idx].radius=Number(e.target.value); setEditableBranches(b);}} placeholder="Ex: 5" />
                                     </label>
                                     <label className="block">
                                         <span className="text-[10px] font-black text-gray-500 uppercase ml-2 block mb-2">Statut</span>
                                         <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl flex items-center h-[54px] shadow-inner">
                                             <label className="flex items-center gap-4 w-full cursor-pointer">
                                                 <input type="checkbox" checked={branch.isOpen !== false} onChange={e=>{const b=[...editableBranches]; b[idx].isOpen=e.target.checked; setEditableBranches(b);}} className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 accent-green-600 cursor-pointer" />
                                                 <span className={`text-sm font-black uppercase tracking-wider ${branch.isOpen !== false ? 'text-green-700' : 'text-red-500'}`}>{branch.isOpen !== false ? 'Ouvert' : 'Fermé'}</span>
                                             </label>
                                         </div>
                                     </label>
                                 </div>

                                 <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 shadow-inner">
                                     <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={18}/> Compte Manager</h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                         <label className="block">
                                             <span className="text-[10px] font-black uppercase text-blue-700/60 ml-2 block mb-2">Email</span>
                                             <input type="email" className="w-full bg-white border-2 border-blue-200 p-4 rounded-2xl text-sm font-bold text-blue-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm" value={branch.managerEmail || ''} onChange={e=>{const b=[...editableBranches]; b[idx].managerEmail=e.target.value; setEditableBranches(b);}} placeholder="manager@..." />
                                         </label>
                                         <label className="block">
                                             <span className="text-[10px] font-black uppercase text-blue-700/60 ml-2 block mb-2">Mot de passe</span>
                                             <div className="flex gap-2">
                                                 <input id={`pwd-${idx}`} type="password" className="w-full bg-white border-2 border-blue-200 p-4 rounded-2xl text-sm font-bold text-blue-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm" value={branch.managerPassword || ''} onChange={e=>{const b=[...editableBranches]; b[idx].managerPassword=e.target.value; setEditableBranches(b);}} />
                                                 <button type="button" onClick={(e) => { e.preventDefault(); const el = document.getElementById(`pwd-${idx}`); if (el) el.type = el.type === 'password' ? 'text' : 'password'; }} className="px-4 bg-white border-2 border-blue-200 rounded-2xl text-gray-500 hover:text-gray-900 shadow-sm active:scale-95 transition-all"><Eye size={20}/></button>
                                             </div>
                                         </label>
                                     </div>
                                     <button onClick={async () => {
                                         try {
                                             if (!branch.managerEmail || !branch.managerPassword) return showNotify("Dkhel Email w Mot de passe!", "error");
                                             showNotify("Jari l'modification...", "info");
                                             const { getFunctions, httpsCallable } = await import('firebase/functions');
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
                                     }} className="mt-6 bg-blue-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md active:scale-95 w-full flex items-center justify-center gap-2"><Save size={18}/> Sauvegarder Compte</button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
                 )}
              </div>
           </div>
        </div>

        <div className="hidden xl:flex w-[380px] shrink-0 justify-center sticky top-8 h-fit animate-in slide-in-from-right-10">
           <div className="absolute -top-12 bg-blue-600 text-white px-4 py-2 rounded-full font-black text-xs uppercase flex items-center gap-2 shadow-lg animate-bounce z-50"><MousePointer2 size={16}/> Kliki 3la l-app bach tbeddel</div>
           
           <div className={`border-[12px] border-neutral-800 rounded-[3.5rem] h-[750px] w-full overflow-hidden relative shadow-2xl flex flex-col edit-highlight ${activeEditZone === 'bgColor' ? 'edit-active' : ''}`} style={{backgroundColor: brand.bgColor, fontFamily: brand.fontFamily}} onClick={(e) => { setConfigTab('apparence'); setActiveEditZone('bgColor'); }}>
               <div className="absolute top-0 inset-x-0 h-7 bg-neutral-800 rounded-b-3xl w-[40%] mx-auto z-[5000]"></div>
               
               {(()=>{
                  const isAnim = brand.isAnimated === true;
                  const anims = brand.animations || { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false };
                  const imgAnimClass = isAnim && anims.photoZoom ? 'animate-zoom-slow' : ''; const priceAnimClass = isAnim && anims.priceBounce ? 'animate-bounce-price' : ''; const titleAnimClass = isAnim && anims.titleFloat ? 'animate-float-text inline-block' : ''; const catAnimClass = isAnim && anims.categoryFloat ? 'animate-float-text' : ''; const boutiqueAnimClass = isAnim && anims.boutiqueFloat ? 'animate-float-text inline-block' : ''; const plusAnimClass = isAnim && anims.plusPulse ? 'animate-pulse text-red-500' : ''; const promoMarqueeClass = isAnim && anims.promoMarquee ? 'animate-marquee' : '';
                  return (
                    <>
                  {brand.promoMsg && <div className={`text-[10px] font-black uppercase tracking-widest py-2 px-4 text-center cursor-pointer hover:opacity-80 transition-opacity z-50 relative ${activeEditZone === 'promoMsg' ? 'ring-2 ring-blue-500' : ''}`} style={{backgroundColor: brand.color, color: '#000'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'promoMsg')}>{brand.promoMsg}</div>}
                  <div className={`h-20 shrink-0 border-b relative z-40 bg-white shadow-sm flex flex-col justify-end pb-3 px-4 cursor-pointer hover:opacity-90 ${activeEditZone === 'headerColor' ? 'ring-2 ring-blue-500 inset-0' : ''}`} style={{backgroundColor: brand.headerColor}} onClick={(e) => handlePreviewClick(e, 'apparence', 'headerColor')}>
                      {brand.logoUrl ? <img src={brand.logoUrl} className={`h-8 object-contain mb-1 cursor-pointer hover:opacity-80 ${boutiqueAnimClass}`} onClick={(e)=>{e.stopPropagation(); handlePreviewClick(e, 'apparence', 'logoUrl');}} /> : <div className={`font-black uppercase italic cursor-pointer hover:underline ${boutiqueAnimClass}`} style={{color: brand.color}} onClick={(e) => {e.stopPropagation(); handlePreviewClick(e, 'apparence', 'brandName');}}>{brand.name || 'Mon Bocadillo'}</div>}
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar bg-gray-50 pb-20 relative">
                      <div className={`h-40 bg-gray-200 relative mb-4 cursor-pointer hover:opacity-90 ${activeEditZone === 'coverUrl' ? 'ring-2 ring-blue-500' : ''}`} style={{backgroundImage: `url(${brand.coverUrl})`, backgroundSize: 'cover'}} onClick={(e) => handlePreviewClick(e, 'apparence', 'coverUrl')}>
                          <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
                          </div>
                          <div className="px-4 grid grid-cols-2 gap-3 pb-8">
                              {(editableMenu || []).slice(0,4).map(item => (
                              <div key={item.id} className={`bg-white p-3 rounded-2xl shadow-sm flex flex-col items-center text-center edit-highlight cursor-pointer hover:ring-2 ring-blue-500 transition-all ${activeEditZone === 'menuItem_' + item.id ? 'ring-2 ring-blue-500' : ''}`} onClick={(e) => handlePreviewClick(e, 'menu', 'menuItem_' + item.id)}>
                                  <div className="w-16 h-16 bg-gray-100 rounded-full mb-2 flex items-center justify-center text-2xl overflow-hidden pointer-events-none">{item.img?.startsWith('http') ? <img src={item.img} className="w-full h-full object-cover" alt="" /> : item.img}</div>
                                  <div className={`font-black text-[10px] uppercase line-clamp-1 pointer-events-none ${titleAnimClass}`} style={{color: brand.textColor}}>{item.name}</div>
                                  <div className={`font-black text-sm italic mt-1 pointer-events-none ${priceAnimClass}`} style={{color: brand.color}}>{item.price} DH</div>
                                  {item.outOfStock && <div className="mt-1 text-[8px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200 pointer-events-none">Rupture</div>}
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="h-16 shrink-0 bg-white border-t rounded-t-3xl shadow-[0_-5px_15px_rgba(0,0,0,0.05)] flex justify-around items-center px-4 relative z-50">
                      <div className={`flex flex-col items-center gap-1 text-gray-400 cursor-pointer hover:text-blue-500 p-2 rounded-lg ${activeEditZone === 'navMenu' ? 'bg-blue-50 text-blue-600' : ''}`} onClick={(e) => handlePreviewClick(e, 'textes', 'navMenu')}><Home size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navMenu || 'Menu'}</span></div>
                      <div className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 p-2 rounded-lg ${activeEditZone === 'navTrack' ? 'bg-blue-50' : ''}`} style={{color: brand.color}} onClick={(e) => handlePreviewClick(e, 'textes', 'navTrack')}><ShoppingBag size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navTrack || 'Suivi'}</span></div>
                      <div className={`flex flex-col items-center gap-1 text-gray-400 cursor-pointer hover:text-blue-500 p-2 rounded-lg ${activeEditZone === 'navProfile' ? 'bg-blue-50 text-blue-600' : ''}`} onClick={(e) => handlePreviewClick(e, 'textes', 'navProfile')}><User size={20}/><span className="text-[8px] font-black uppercase pointer-events-none">{brand.texts?.navProfile || 'Profil'}</span></div>
                      </div>
                    </>
                  );
               })()}
           </div>
        </div>
      </div>
    );
}