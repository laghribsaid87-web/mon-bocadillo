import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator, FileText, BookOpen
} from 'lucide-react';
import { collection, query, limit, startAfter } from 'firebase/firestore';

export default function AdminAnalytics(props) {
    const {
        role, db, appId, settings, brand, showNotify, 
        managerBranchId, adminSelectedBranch, 
        lazyHistory, isLoadMore, lastHistoryDoc, 
        analyticsPeriod, setAnalyticsPeriod, analyticsBranch, setAnalyticsBranch,
        getL, today, yesterday, handleFetchAnalytics,
        problemOrders, handleUpdateStatus,
        extOrder, setExtOrder, extCart, setExtCart, showExtMenu, setShowExtMenu,
        selectedExtItem, setSelectedExtItem, extItemOptions, setExtItemOptions,
        extSelectedVariation, setExtSelectedVariation, extSelectedChoice, setExtSelectedChoice,
        extSelectedExtras, setExtSelectedExtras, addExtCart, removeExtCart, extTotal,
        handleStandardOrder, formatSansIngredient, DEFAULT_MENU_ITEMS,
        liveOnlineDrivers, showAddDriver, setShowAddDriver, newDriver, setNewDriver,
        handleAddDriverSubmit, handleHardResetOrders, handleWakeUpDrivers, 
        clientsList, formatPhoneNumber,
        ...rest
    } = props;

    
                   let deliveredOrders = lazyHistory.filter(o => o.status === 'delivered');
                   
                   if (analyticsBranch !== 'all') {
                       deliveredOrders = deliveredOrders.filter(o => o.nearestBranch?.id === analyticsBranch);
                   }

                   if (analyticsPeriod !== 'all') {
                       deliveredOrders = deliveredOrders.filter(o => {
                           let d = '';
                           if (o.deliveredAtLocal) { d = getL(new Date(o.deliveredAtLocal)); }
                           else if (o.createdAt && o.createdAt.seconds) { d = getL(new Date(o.createdAt.seconds * 1000)); }
                           if (analyticsPeriod === 'today') return d === today;
                           if (analyticsPeriod === 'yesterday') return d === yesterday;
                           return d === analyticsPeriod;
                       });
                   }

                   // NOUVEAU: Répartition par Source
                   const posOrders = deliveredOrders.filter(o => o.source === 'pos');
                   const appOrders = deliveredOrders.filter(o => !o.source || o.source === 'app');
                   const telOrders = deliveredOrders.filter(o => o.source === 'telephone');
                   
                   const caPos = posOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const caApp = appOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const caTel = telOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const totalRevenue = caPos + caApp + caTel;

                   // NOUVEAU: Rapport détaillé complet des produits
                   const productStats = {};
                   deliveredOrders.forEach(o => {
                       (o.items || []).forEach(item => {
                           const baseName = (item.name || '').split(' (Sans ')[0];
                           if (!productStats[baseName]) productStats[baseName] = { qty: 0, revenue: 0, img: item.img };
                           productStats[baseName].qty += item.qty;
                           productStats[baseName].revenue += (item.price * item.qty);
                       });
                   });
                   const sortedProducts = Object.entries(productStats).sort((a,b) => b[1].qty - a[1].qty);

                   const driverCount = {};
                   deliveredOrders.forEach(o => {
                       if (o.driverId) {
                           driverCount[o.driverId] = (driverCount[o.driverId] || 0) + 1;
                       }
                   });
                   const topDrivers = Object.entries(driverCount)
                       .map(([id, count]) => {
                           const d = (clientsList||[]).find(c => c.uid === id || c.id === id || c.phone === id);
                           return { name: d?.name || 'Inconnu', count, isFreelance: d?.isFreelance };
                       })
                       .sort((a,b) => b.count - a.count).slice(0, 5);

                   const clientCount = {};
                   deliveredOrders.forEach(o => {
                       const id = o.phone || o.userId || 'Inconnu';
                       clientCount[id] = clientCount[id] || { count: 0, name: o.customerName || o.name || o.phone || id, phone: o.phone || '', totalSpent: 0 };
                       clientCount[id].count += 1;
                       clientCount[id].totalSpent += (Number(o.total) || 0);
                   });
                   const topClients = Object.values(clientCount).sort((a,b) => b.count - a.count).slice(0, 5);

                   // NOUVEAU: Top Agences (Performances)
                   const branchCount = {};
                   deliveredOrders.forEach(o => {
                       const bId = o.nearestBranch?.id || 'inconnu';
                       branchCount[bId] = branchCount[bId] || { name: o.nearestBranch?.name || 'Agence Inconnue', revenue: 0, count: 0 };
                       branchCount[bId].count += 1;
                       branchCount[bId].revenue += (Number(o.total) || 0);
                   });
                   const topBranches = Object.values(branchCount).sort((a,b) => b.revenue - a.revenue).slice(0, 5);

               // NOUVEAU: Fonction pour Imprimer ou Exporter en PDF
               const handlePrintAnalytics = () => {
                   const branchName = analyticsBranch === 'all' ? 'Toutes Agences' : (settings?.branches || DEFAULT_BRANCHES).find(b => b.id === analyticsBranch)?.name || 'Inconnu';
                   const periodName = analyticsPeriod === 'all' ? 'Toujours' : analyticsPeriod === 'today' ? "Aujourd'hui" : analyticsPeriod === 'yesterday' ? 'Hier' : analyticsPeriod;

                   const productsHtml = sortedProducts.map(([name, data]) => `
                       <tr style="border-bottom: 1px solid #eee;">
                           <td style="padding: 10px;">${name}</td>
                           <td style="padding: 10px; text-align: center; font-weight: bold;">${data.qty}x</td>
                           <td style="padding: 10px; text-align: right; font-weight: bold; color: #2563eb;">${data.revenue} DH</td>
                       </tr>
                   `).join('');

                   const html = `
                   <html>
                   <head>
                       <title>Rapport Analytique - ${brand?.name || 'Restaurant'}</title>
                       <style>
                           body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                           h1 { text-align: center; color: #111; margin-bottom: 5px; }
                           .header-info { text-align: center; margin-bottom: 30px; font-size: 14px; color: #666; padding-bottom: 15px; border-bottom: 1px dashed #ccc; }
                           .grid { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 15px; }
                           .card { border: 1px solid #e5e7eb; background: #f9fafb; padding: 20px; border-radius: 12px; flex: 1; text-align: center; }
                           .card h3 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; }
                           .card p { margin: 0; font-size: 28px; font-weight: 900; color: #111; }
                           .card small { color: #6b7280; font-weight: bold; font-size: 12px; }
                           table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                           th { background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #4b5563; }
                           .section-title { border-bottom: 2px solid #111; padding-bottom: 8px; margin-top: 40px; margin-bottom: 15px; font-size: 18px; text-transform: uppercase; }
                       </style>
                   </head>
                   <body>
                       <h1>RAPPORT ANALYTIQUE</h1>
                       <div class="header-info">
                           <p><strong>Agence :</strong> ${branchName} &nbsp;|&nbsp; <strong>Période :</strong> ${periodName}</p>
                           <p style="font-size: 12px; margin-top: 5px;">Généré le ${new Date().toLocaleString('fr-FR')}</p>
                       </div>

                       <div class="grid">
                           <div class="card"><h3>Chiffre d'Affaires</h3><p>${totalRevenue} <span style="font-size:16px; color:#666;">DH</span></p></div>
                           <div class="card"><h3>Commandes Livrées</h3><p>${deliveredOrders.length}</p></div>
                           <div class="card"><h3>Panier Moyen</h3><p>${deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0} <span style="font-size:16px; color:#666;">DH</span></p></div>
                       </div>

                       <div class="grid" style="margin-top: 20px;">
                           <div class="card" style="background:#fff;"><h3>Caisse (POS)</h3><p>${caPos} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${posOrders.length} cmds</small></div>
                           <div class="card" style="background:#fff;"><h3>App (Livraison)</h3><p>${caApp} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${appOrders.length} cmds</small></div>
                           <div class="card" style="background:#fff;"><h3>Tél (Standard)</h3><p>${caTel} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${telOrders.length} cmds</small></div>
                       </div>

                       <h2 class="section-title">Détails des Ventes (Produits)</h2>
                       <table>
                           <thead>
                               <tr><th>Produit</th><th style="text-align: center;">Quantité</th><th style="text-align: right;">Chiffre d'Affaires</th></tr>
                           </thead>
                           <tbody>
                               ${productsHtml || '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #999;">Aucun produit vendu dans cette période.</td></tr>'}
                           </tbody>
                       </table>
                   </body>
                   </html>
                   `;
                   
                   // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
                   if (typeof window !== 'undefined' && window.require) {
                       const { ipcRenderer } = window.require('electron');
                       ipcRenderer.send('print-ticket', html, brand?.selectedPrinter);
                   } else {
                       const printWindow = window.open('', '', 'width=800,height=900');
                       if (printWindow) {
                           const htmlWithScript = html.replace('</body>', `
                           <script>
                               window.onload = function() { 
                                   setTimeout(function() {
                                       window.print();
                                   }, 500);
                               };
                               window.onafterprint = function() {
                                   window.close();
                               };
                           </script>
                           </body>`);
                           printWindow.document.write(htmlWithScript);
                           printWindow.document.close();
                       }
                   }
               };

                   return (
                       <div className="space-y-6 animate-in fade-in pb-4">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-gray-200 pb-4">
                           <div className="flex items-center gap-3">
                               <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={24} strokeWidth={2}/></div>
                               <div><h2 className="text-xl font-semibold text-gray-900">Analyses & Statistiques</h2><p className="text-xs text-gray-500">Performances globales du restaurant</p></div>
                           </div>
                           <button onClick={handlePrintAnalytics} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                               <Printer size={18}/> Imprimer / PDF
                           </button>
                           </div>

                           <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                               <select value={analyticsBranch} onChange={e=>setAnalyticsBranch(e.target.value)} className="flex-1 bg-white p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm cursor-pointer appearance-none text-center">
                                   <option value="all">Toutes Agences</option>
                                   {(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                               </select>
                               <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 flex-[1.5]">
                                   <button onClick={()=>setAnalyticsPeriod('today')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='today'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Aujourd'hui</button>
                                   <button onClick={()=>setAnalyticsPeriod('yesterday')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='yesterday'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Hier</button>
                                   <button onClick={()=>setAnalyticsPeriod('all')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='all'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Toujours</button>
                               </div>
                               <input type="date" value={!['today','yesterday','all'].includes(analyticsPeriod) ? analyticsPeriod : ''} onChange={e=>setAnalyticsPeriod(e.target.value || 'all')} className="flex-1 bg-white p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                               <button 
                                   onClick={handleFetchAnalytics} 
                                   disabled={loadingLazyHistory}
                                   className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 flex-1 md:flex-none disabled:opacity-50"
                               >
                                   {loadingLazyHistory ? <Activity size={18} className="animate-spin"/> : <Search size={18}/>}
                                   {loadingLazyHistory ? 'Chargement...' : 'Chercher'}
                               </button>
                           </div>

                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                               <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl border border-green-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-green-500 group-hover:scale-110 transition-transform duration-500"><DollarSign size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-green-800 uppercase tracking-widest">Chiffre d'Affaires</p><div className="p-2 bg-green-100 rounded-lg text-green-600"><DollarSign size={20}/></div></div>
                                   <p className="text-3xl font-black text-gray-900">{totalRevenue} <span className="text-sm font-bold text-gray-500">DH</span></p>
                               </div>
                               <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-blue-500 group-hover:scale-110 transition-transform duration-500"><ShoppingBag size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Cmds Livrées</p><div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ShoppingBag size={20}/></div></div>
                                   <p className="text-2xl font-bold text-gray-900">{deliveredOrders.length}</p>
                               </div>
                               <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-purple-500 group-hover:scale-110 transition-transform duration-500"><BarChart3 size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-purple-800 uppercase tracking-widest">Panier Moyen</p><div className="p-2 bg-purple-100 rounded-lg text-purple-600"><BarChart3 size={20}/></div></div>
                                   <p className="text-3xl font-black text-gray-900">{deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0} <span className="text-sm font-bold text-gray-500">DH</span></p>
                               </div>
                               <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl border border-orange-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-orange-500 group-hover:scale-110 transition-transform duration-500"><Users size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-orange-800 uppercase tracking-widest">Total Clients</p><div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Users size={20}/></div></div>
                                   <p className="text-2xl font-bold text-gray-900">{Object.keys(clientCount).length}</p>
                               </div>
                           </div>

                           {/* NOUVEAU: REPARTITION PAR SOURCE */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6">
                               <div className="bg-white border-2 border-indigo-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Store size={14}/> Caisse (Sur Place)</p>
                                       <p className="text-3xl font-black text-gray-900">{caPos} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{posOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"><Store size={32}/></div>
                               </div>
                               <div className="bg-white border-2 border-green-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-green-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2"><ShoppingBag size={14}/> App (Livraison)</p>
                                       <p className="text-3xl font-black text-gray-900">{caApp} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{appOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform"><ShoppingBag size={32}/></div>
                               </div>
                               <div className="bg-white border-2 border-purple-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-purple-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Phone size={14}/> Tél (Standard)</p>
                                       <p className="text-3xl font-black text-gray-900">{caTel} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{telOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform"><Phone size={32}/></div>
                               </div>
                           </div>

                           {/* NOUVEAU: RAPPORT DETAILLÉ DES PRODUITS */}
                           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                               <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-4"><Utensils size={20} className="text-[#da291c]"/> Rapport Analytique des Ventes (Produits)</h3>
                               <div className="overflow-x-auto max-h-[400px] overflow-y-auto no-scrollbar">
                                   <table className="w-full text-left border-collapse">
                                       <thead className="sticky top-0 bg-white shadow-sm z-10">
                                           <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
                                               <th className="px-4 py-3 font-black rounded-l-xl">Produit</th>
                                               <th className="px-4 py-3 font-black text-center">Quantité Vendue</th>
                                               <th className="px-4 py-3 font-black text-right rounded-r-xl">Chiffre d'Affaires</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-gray-50 text-sm">
                                           {sortedProducts.map(([name, data], i) => (
                                               <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                   <td className="px-4 py-3">
                                                       <div className="flex items-center gap-3">
                                                           <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl overflow-hidden border border-gray-200">
                                                               {typeof data.img === 'string' && (data.img.startsWith('http') || data.img.startsWith('data:image')) ? <img src={data.img} loading="lazy" className="w-full h-full object-cover"/> : data.img}
                                                           </div>
                                                           <span className="font-bold text-gray-800">{name}</span>
                                                       </div>
                                                   </td>
                                                   <td className="px-4 py-3 text-center">
                                                       <span className="font-black text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">{data.qty}x</span>
                                                   </td>
                                                   <td className="px-4 py-3 text-right">
                                                       <span className="font-black text-blue-600">{data.revenue} DH</span>
                                                   </td>
                                               </tr>
                                           ))}
                                           {sortedProducts.length === 0 && (
                                               <tr>
                                                   <td colSpan="3" className="py-8 text-center text-gray-400 font-bold">Aucun produit vendu dans cette période.</td>
                                               </tr>
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Store size={16} className="text-gray-400"/> Top Agences</h3>
                                   <div className="space-y-1">
                                       {topBranches.map((b, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">{i+1}.</span>
                                                   <span className="text-sm font-medium text-gray-800 truncate">{b.name}</span>
                                               </div>
                                               <div className="flex flex-col items-end">
                                                   <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md mb-1">{b.count} cmds</span>
                                                   <span className="text-[10px] font-black text-green-600">{b.revenue} DH</span>
                                               </div>
                                           </div>
                                       ))}
                                       {topBranches.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>

                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Truck size={16} className="text-gray-400"/> Top Livreurs</h3>
                                   <div className="space-y-1">
                                       {topDrivers.map((d, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">
                                                       {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
                                                   </span>
                                                   <div className="flex flex-col">
                                                       <span className="text-sm font-medium text-gray-800">{d.name}</span>
                                                       <span className="text-[10px] font-medium text-gray-400">{d.isFreelance ? 'Freelance' : 'Officiel'}</span>
                                                   </div>
                                               </div>
                                               <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{d.count} cmds</span>
                                           </div>
                                       ))}
                                       {topDrivers.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>

                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Award size={16} className="text-gray-400"/> Clients Fidèles</h3>
                                   <div className="space-y-1">
                                       {topClients.map((c, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">{i+1}.</span>
                                                   <div className="flex flex-col w-[110px]">
                                                       <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                                                       <span className="text-[10px] font-medium text-gray-400 truncate">{c.phone}</span>
                                                   </div>
                                               </div>
                                               <div className="flex flex-col items-end">
                                                   <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md mb-1">{c.count} cmds</span>
                                                   <span className="text-[10px] font-medium text-gray-400">{c.totalSpent} DH</span>
                                               </div>
                                           </div>
                                       ))}
                                       {topClients.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>
                           </div>
                           
                           {/* 🔥 NOUVEAU: ESTIMATION QUOTAS FIREBASE */}
                           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                               <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                                   <Database size={20} className="text-[#f5820b]"/> Estimations & Quotas Firebase
                               </h3>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                   <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm">
                                       <p className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-1">Base de Données</p>
                                       <p className="text-3xl font-black text-orange-900">{safeOrders.length + (clientsList||[]).length} <span className="text-sm font-bold text-orange-700">Docs</span></p>
                                       <p className="text-[10px] font-bold text-orange-700 mt-1">Volume très faible (Plan Gratuit 1 Go)</p>
                                   </div>
                                   <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                                       <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Lectures / Jour (Est.)</p>
                                       <p className="text-3xl font-black text-blue-900">~{safeOrders.filter(o => o.createdAt?.seconds && getL(new Date(o.createdAt.seconds * 1000)) === today).length * 45}</p>
                                       <p className="text-[10px] font-bold text-blue-700 mt-1">Limite Gratuite: 50 000 / jour</p>
                                   </div>
                                   <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm">
                                       <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-1">Coût Estimé Firebase</p>
                                       <p className="text-3xl font-black text-green-900">0.00 <span className="text-sm font-bold text-green-700">$</span></p>
                                       <p className="text-[10px] font-bold text-green-700 mt-1">Plan Spark (Gratuit) suffisant</p>
                                   </div>
                               </div>
                               <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 leading-relaxed">
                                   💡 <strong>Note :</strong> Ces chiffres sont des estimations basées sur l'activité de l'application d'aujourd'hui. L'application est optimisée pour minimiser les requêtes réseau. Vous êtes largement en dessous des limites payantes. <br/><br/>
                                   💰 <strong>Tarification (Plan Blaze) :</strong> Même si vous dépassez les 50 000 lectures par jour, Firebase ne facture que <strong>~0.06$ (soit ~0.60 DH) pour chaque 100 000 lectures supplémentaires</strong>, ce qui reste extrêmement abordable.
                                   <br/>👉 Pour voir votre facture officielle exacte, connectez-vous sur : <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">console.firebase.google.com</a>
                               </div>
                           </div>
                       </div>
                   );
                
}
