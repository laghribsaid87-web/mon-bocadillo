import React, { useState, useMemo } from 'react';
import { Search, Truck, Download, Ban, User, Trash2, X, CheckSquare, MessageCircle, Star, BellRing, Store } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AdminClients({
    f, setF,
    role,
    clientSubTab, setClientSubTab,
    clientsList,
    safeOrders,
    showAddDriver, setShowAddDriver,
    newDriver, setNewDriver,
    handleAddDriverSubmit,
    handleExportCSV,
    db, appId,
    showNotify
}) {
    const [selectedClients, setSelectedClients] = useState([]);
    const [activityFilter, setActivityFilter] = useState('ALL');
    const [driverFilter, setDriverFilter] = useState('ALL');
    const [pointsModal, setPointsModal] = useState({ show: false, client: null, adjust: 0 });

    const displayedClients = useMemo(() => {
        // Indexation des commandes par client et par livreur (Optimisation de O(N*M) à O(N+M))
        const ordersByClient = {};
        const deliveriesByDriver = {};
        
        (safeOrders || []).forEach(o => {
            if (o.userId) { ordersByClient[o.userId] = ordersByClient[o.userId] || []; ordersByClient[o.userId].push(o); }
            if (o.phone) { ordersByClient[o.phone] = ordersByClient[o.phone] || []; ordersByClient[o.phone].push(o); }
            
            if (o.status === 'delivered' && o.driverId) {
                deliveriesByDriver[o.driverId] = deliveriesByDriver[o.driverId] || []; deliveriesByDriver[o.driverId].push(o);
            }
        });

        // Extraire les clients Glovo depuis les commandes s'ils ne sont pas dans clientsList
        const glovoClientsMap = new Map();
        (safeOrders || []).forEach(o => {
            if (o.source === 'glovo' && o.phone && o.phone !== 'Inconnu' && o.phone !== 'GLOVO') {
                if (!glovoClientsMap.has(o.phone)) {
                    glovoClientsMap.set(o.phone, {
                        id: 'glovo-' + o.phone,
                        uid: 'glovo-' + o.phone,
                        name: o.customerName || o.name || 'Client Glovo',
                        phone: o.phone,
                        source: 'glovo',
                        isDriver: false,
                        isFreelance: false,
                        createdAt: o.createdAt || new Date()
                    });
                }
            }
        });

        const allClients = [...(clientsList||[])];
        glovoClientsMap.forEach((gc, phone) => {
            if (!allClients.find(c => c.phone === phone)) {
                allClients.push(gc);
            }
        });

        return allClients
        .map(c => {
            // Utiliser les données indexées au lieu de refiltrer tout le tableau safeOrders
            const clientOrdersMap = new Map();
            [...(ordersByClient[c.uid] || []), ...(ordersByClient[c.phone] || [])].forEach(o => clientOrdersMap.set(o.id, o));
            const clientOrders = Array.from(clientOrdersMap.values());
            
            const driverOrdersMap = new Map();
            [...(deliveriesByDriver[c.uid] || []), ...(deliveriesByDriver[c.id] || [])].forEach(o => driverOrdersMap.set(o.id, o));
            const driverOrders = Array.from(driverOrdersMap.values());
            
            const sortedClientOrders = [...clientOrders].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
            const sortedDriverOrders = [...driverOrders].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
            
            const totalOrders = sortedClientOrders.length; 
            const totalLivraisons = sortedDriverOrders.length; 
            const lastAddress = sortedClientOrders[0]?.address || "---";
            
            const createdDate = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '---');
            const driverDate = c.driverSince?.seconds ? new Date(c.driverSince.seconds * 1000).toLocaleDateString('fr-FR') : (c.driverSince ? new Date(c.driverSince).toLocaleDateString('fr-FR') : createdDate);
            const lastOrderDate = sortedClientOrders[0]?.createdAt?.seconds ? new Date(sortedClientOrders[0].createdAt.seconds * 1000).toLocaleDateString('fr-FR') : (sortedClientOrders[0]?.createdAt ? new Date(sortedClientOrders[0].createdAt).toLocaleDateString('fr-FR') : '---');
            const lastDeliveryDate = sortedDriverOrders[0]?.createdAt?.seconds ? new Date(sortedDriverOrders[0].createdAt.seconds * 1000).toLocaleDateString('fr-FR') : '---';
            
            const lastOrderMs = sortedClientOrders[0]?.createdAt?.seconds ? sortedClientOrders[0].createdAt.seconds * 1000 : (sortedClientOrders[0]?.createdAt ? new Date(sortedClientOrders[0].createdAt).getTime() : null);
            const createdMs = c.createdAt?.seconds ? c.createdAt.seconds * 1000 : (c.createdAt ? new Date(c.createdAt).getTime() : null);
            const isInactive = (lastOrderMs || createdMs) ? (Date.now() - (lastOrderMs || createdMs) > 30 * 24 * 60 * 60 * 1000) : false;
            
            const pEarned = sortedClientOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + Math.floor((o.subtotal || 0) / 10), 0) + (c.manualPoints || 0);
            const pUsed = sortedClientOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.pointsUsed || 0), 0);
            const availablePoints = Math.max(0, pEarned - pUsed);

            return { ...c, totalOrders, totalLivraisons, lastAddress, createdDate, driverDate, lastOrderDate, lastDeliveryDate, isInactive, availablePoints };
        })
        .filter(c => {
            let isRoleMatch = false;
            if (role === 'manager') {
                isRoleMatch = c.isDriver;
            } else {
                if (clientSubTab === 'livreurs') {
                    isRoleMatch = c.isDriver === true;
                } else if (clientSubTab === 'glovo') {
                    isRoleMatch = !c.isDriver && (c.source === 'glovo' || (c.name || '').toLowerCase().includes('glovo'));
                } else {
                    isRoleMatch = !c.isDriver && c.source !== 'glovo' && !(c.name || '').toLowerCase().includes('glovo');
                }
            }
            
            const isSearchMatch = ((c.name || '').toLowerCase().includes((f.search || '').toLowerCase()) || (c.phone || '').includes(f.search || ''));
            if (!isRoleMatch || !isSearchMatch) return false;
            
            if (!c.isDriver && activityFilter !== 'ALL') {
                if (activityFilter === 'LOYAL') return c.totalOrders >= 5 && !c.isInactive;
                if (activityFilter === 'OCCASIONAL') return c.totalOrders > 0 && c.totalOrders < 5 && !c.isInactive;
                if (activityFilter === 'INACTIVE') return c.isInactive;
                if (activityFilter === 'GLOVO') return c.source === 'glovo' || (c.name || '').toLowerCase().includes('glovo');
            }
            
            if (c.isDriver && driverFilter !== 'ALL') {
                if (driverFilter === 'OFFICIAL') return !c.isFreelance;
                if (driverFilter === 'FREELANCE') return c.isFreelance;
            }
            return true;
        });
    }, [clientsList, safeOrders, role, clientSubTab, f.search, activityFilter, driverFilter]);

    const handleBulkDelete = async () => {
        if(window.confirm(`Wach met2ked bghiti tsprimi ${selectedClients.length} comptes f de99a?`)) {
            showNotify("Jari l'msi7...", "info");
            try {
                await Promise.all(selectedClients.map(id => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', id))));
                showNotify(`${selectedClients.length} comptes tms7o ✅`, "success");
                setSelectedClients([]);
            } catch (e) {
                showNotify("Erreur f l'msi7", "error");
            }
        }
    };

    const handleBulkBlock = async (blockStatus) => {
        if(window.confirm(`Wach met2ked bghiti ${blockStatus ? 'tbloqui' : 't-débloqui'} ${selectedClients.length} comptes f de99a?`)) {
            showNotify("Jari l'modification...", "info");
            try {
                await Promise.all(selectedClients.map(async (id) => {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', id), {blocked: blockStatus}, {merge: true});
                    const c = (clientsList||[]).find(client => client.id === id);
                    if (c && c.uid) {
                        await setDoc(doc(db, 'artifacts', appId, 'users', c.uid, 'profile', 'data'), {blocked: blockStatus}, {merge: true});
                    }
                }));
                showNotify(`${selectedClients.length} comptes tmodifiyaow ✅`, "success");
                setSelectedClients([]);
            } catch (e) {
                showNotify("Erreur f l'modification", "error");
            }
        }
    };

    const handleBulkMakeDriver = async () => {
        if(window.confirm(`Wach met2ked bghiti treje3 ${selectedClients.length} comptes livreurs f de99a?`)) {
            showNotify("Jari l'modification...", "info");
            try {
                await Promise.all(selectedClients.map(async (id) => {
                    const c = (clientsList||[]).find(client => client.id === id);
                    if (c) {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', id), {isDriver: true, isFreelance: false, driverSince: Date.now()}, {merge: true});
                        if (c.uid) {
                            await setDoc(doc(db, 'artifacts', appId, 'users', c.uid, 'profile', 'data'), {isDriver: true, isFreelance: false, driverSince: Date.now()}, {merge: true});
                        }
                    }
                }));
                showNotify(`${selectedClients.length} comptes wellaw livreurs ✅`, "success");
                setSelectedClients([]);
            } catch (e) {
                showNotify("Erreur f l'modification", "error");
            }
        }
    };

    const handleBulkWhatsApp = () => {
        const promoMsg = window.prompt("Ktb l-message dyal Promo (ex: Salam, 3ndna lik takhfid -20%...) :");
        if (!promoMsg) return;

        const selectedUsers = (clientsList||[]).filter(c => selectedClients.includes(c.id) && c.phone);
        if (selectedUsers.length === 0) return showNotify("Ta client ma3ndo numéro s7i7", "error");

        if (window.confirm(`Ghatsifet l ${selectedUsers.length} clients. (Mola7ada: L-navigateur y9der y-bloqui les fenêtres 'Pop-ups', khassk t-autoriserhom).`)) {
            selectedUsers.forEach((c, index) => {
                setTimeout(() => {
                    let p = c.phone.replace(/\D/g, ''); 
                    if (p.startsWith('0')) p = '212' + p.substring(1); 
                    window.open(`https://wa.me/${p}?text=${encodeURIComponent(promoMsg)}`, '_blank');
                }, index * 800);
            });
            showNotify(`Jari l-envoi dyal ${selectedUsers.length} messages...`, "success");
            setSelectedClients([]);
        }
    };

    const handleBulkPushNotification = async () => {
        const title = window.prompt("Titre de la notification (ex: 🎉 Promo Spéciale) :");
        if (!title) return;
        
        const body = window.prompt("Message de la notification (ex: -20% sur tous les burgers aujourd'hui!) :");
        if (!body) return;

        const selectedUsers = (clientsList||[]).filter(c => selectedClients.includes(c.id) && c.fcmToken);
        if (selectedUsers.length === 0) return showNotify("Ta client mn hado ma-m2activi les notifications Push f tilifon dyalo ❌", "error");

        if (window.confirm(`Ghatsifet notification Push l ${selectedUsers.length} clients. Wakha?`)) {
            showNotify(`Jari l-envoi l ${selectedUsers.length} clients...`, "info");
            try {
                const functions = getFunctions();
                const sendPushFn = httpsCallable(functions, 'sendMarketingPush');
                await sendPushFn({ appId, tokens: selectedUsers.map(c => c.fcmToken), title: title, body: body });
                showNotify(`Notifications t-siftat b naja7 ! 🚀`, "success");
                setSelectedClients([]);
            } catch (e) {
                console.error(e);
                showNotify("Erreur f l-envoi dyal notifications. T2ked mn Firebase Functions", "error");
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in pb-10">
           
           <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-8 items-center">
              <div className="relative flex-1 md:max-w-md"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input className="w-full bg-white p-5 pl-14 rounded-[2rem] text-sm font-bold text-gray-900 border-2 border-gray-100 shadow-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all" placeholder="Rechercher un compte..." onChange={e=>setF({...f,search:e.target.value})}/></div>
              
              {(!role || role === 'admin') && clientSubTab === 'nouveaux' && (
                  <select 
                      className="bg-white p-5 rounded-[2rem] text-sm font-bold text-gray-900 border-2 border-gray-100 shadow-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none pr-10"
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                  >
                      <option value="ALL">Tous les clients</option>
                      <option value="GLOVO">🍔 Clients Glovo</option>
                      <option value="LOYAL">🌟 Kaycomandi Mzyan</option>
                      <option value="OCCASIONAL">🚶‍♂️ Mara Mara</option>
                      <option value="INACTIVE">💤 Mab9ach Kaycomandi</option>
                  </select>
              )}

              {(!role || role === 'admin') && clientSubTab === 'livreurs' && (
                  <select 
                      className="bg-white p-5 rounded-[2rem] text-sm font-bold text-gray-900 border-2 border-gray-100 shadow-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none pr-10"
                      value={driverFilter}
                      onChange={(e) => setDriverFilter(e.target.value)}
                  >
                      <option value="ALL">Tous les livreurs</option>
                      <option value="OFFICIAL">👔 Livreurs Officiels</option>
                      <option value="FREELANCE">🛵 Livreurs Freelance</option>
                  </select>
              )}

              {(!role || role === 'admin') && <button onClick={() => setShowAddDriver(true)} className="bg-black hover:bg-gray-800 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 md:w-auto"><Truck size={18}/> Ajouter Livreur</button>}
              
              {role === 'admin' && <button onClick={handleExportCSV} className="bg-green-500 hover:bg-green-600 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 md:w-auto"><Download size={18}/> Exporter CSV</button>}
              
              {selectedClients.length > 0 && role === 'admin' && (
                  <div className="flex flex-wrap gap-2 p-2 bg-blue-50 border-2 border-blue-100 rounded-[2rem] animate-in zoom-in items-center w-full md:w-auto">
                      <span className="text-xs font-black text-blue-800 px-4 uppercase whitespace-nowrap">{selectedClients.length} Sélectionnés:</span>
                      {clientSubTab === 'nouveaux' && <button onClick={handleBulkPushNotification} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><BellRing size={16}/> Push Notif</button>}
                      {clientSubTab === 'nouveaux' && <button onClick={handleBulkWhatsApp} className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><MessageCircle size={16}/> Promo WA</button>}
                      <button onClick={() => handleBulkBlock(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><Ban size={16}/> Bloquer</button>
                      <button onClick={() => handleBulkBlock(false)} className="bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><CheckSquare size={16}/> Débloquer</button>
                      {clientSubTab === 'nouveaux' && <button onClick={handleBulkMakeDriver} className="bg-gray-800 hover:bg-black text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><Truck size={16}/> Rendre Livreur</button>}
                      <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"><Trash2 size={16}/> Supprimer</button>
                  </div>
              )}
           </div>
           
           {role === 'admin' && (
               <div className="flex gap-4 bg-gray-100 p-2 rounded-[2rem] mb-8 w-fit overflow-x-auto max-w-full">
                   <button onClick={()=>{setClientSubTab('nouveaux'); setSelectedClients([]);}} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${clientSubTab==='nouveaux' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}>Utilisateurs</button>
                   <button onClick={()=>{setClientSubTab('livreurs'); setSelectedClients([]);}} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${clientSubTab==='livreurs' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}>Livreurs</button>
                   <button onClick={()=>{setClientSubTab('glovo'); setSelectedClients([]);}} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap ${clientSubTab==='glovo' ? 'bg-[#FFC244] text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'}`}>🍔 Glovo</button>
               </div>
           )}

           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
               <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead>
                           <tr className="bg-gray-50 border-b-2 border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                               {role === 'admin' && (
                                   <th className="px-6 py-6 w-16">
                                       <input type="checkbox" 
                                           className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                           checked={displayedClients.length > 0 && selectedClients.length === displayedClients.length}
                                           onChange={e => setSelectedClients(e.target.checked ? displayedClients.map(c => c.id) : [])}
                                       />
                                   </th>
                               )}
                               <th className="px-8 py-6">Utilisateur</th>
                               <th className="px-8 py-6">Contact</th>
                               <th className="px-8 py-6">Rôle / Statut</th>
                               <th className="px-8 py-6">Statistiques</th>
                               <th className="px-8 py-6 text-right">Actions</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 text-sm">
                           {displayedClients.map(c=>{
                               return (
                                   <tr key={c.id} className={`hover:bg-gray-50/80 transition-colors ${c.blocked ? 'bg-red-50/30' : ''} ${selectedClients.includes(c.id) ? 'bg-blue-50/40' : ''}`}>
                                       {role === 'admin' && (
                                           <td className="px-6 py-5">
                                               <input type="checkbox" 
                                                   className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                   checked={selectedClients.includes(c.id)}
                                                   onChange={() => setSelectedClients(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                               />
                                           </td>
                                       )}
                                       <td className="px-8 py-5">
                                           <div className="flex items-center gap-3">
                                               <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-white shrink-0 shadow-md ${c.blocked ? 'bg-red-400' : c.isDriver ? (c.isFreelance ? 'bg-blue-500' : 'bg-green-500') : 'bg-gray-800'}`}>
                                                   {c.name ? c.name[0].toUpperCase() : <User size={16}/>}
                                               </div>
                                               <div>
                                                   <p className="font-black text-gray-900 text-base uppercase">{c.name || 'Inconnu'}</p>
                                                   {c.blocked && <span className="inline-flex mt-1 items-center gap-1 text-[9px] font-black uppercase text-red-600 bg-red-100 px-2 py-0.5 rounded-lg border border-red-200"><Ban size={10}/> Bloqué</span>}
                                               </div>
                                           </div>
                                       </td>
                                       <td className="px-8 py-5">
                                           <span className="font-bold text-gray-600 font-mono">{c.phone || '---'}</span>
                                       </td>
                                       <td className="px-8 py-5">
                                           {!c.isDriver ? (
                                               <div className="flex flex-col items-start gap-1">
                                                   <div className="flex items-center gap-2">
                                                       <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${c.isManager ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{c.isManager ? 'Gérant Achats' : 'Client'}</span>
                                                       {c.isInactive && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-orange-50 text-orange-600 border border-orange-200" title="Aucune activité depuis plus de 30 jours">Inactif</span>}
                                                       {!c.isInactive && c.totalOrders >= 5 && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-green-50 text-green-600 border border-green-200" title="Client Fidèle">Fidèle</span>}
                                                       {!c.isInactive && c.totalOrders > 0 && c.totalOrders < 5 && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-200" title="Occasionnel">Occasionnel</span>}
                                                   </div>
                                                   {c.isManager && (
                                                       <div className="flex flex-col mt-2 gap-1 w-full border-t border-gray-50 pt-2">
                                                           <div className="flex items-center gap-2">
                                                               <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-black bg-yellow-50 text-yellow-800 border border-yellow-200 shadow-sm">
                                                                   🔑 Code : {c.otp || 'N/A'}
                                                               </span>
                                                               <button onClick={async() => { const newOtp = Math.floor(1000 + Math.random() * 9000).toString(); await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {otp: newOtp, otpVerified: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {otp: newOtp, otpVerified: false}, {merge:true}); showNotify("Code jdid t-généra! 🔄", "success"); }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-[10px] font-bold transition-all shadow-sm" title="Générer un nouveau code">
                                                                   🔄 Bdel
                                                               </button>
                                                           </div>
                                                           {c.otp && (
                                                               <button 
                                                                   onClick={() => {
                                                                       const msg = `Salam ${c.name}, mar7ba bik m3ana! L-code de confirmation dyalek bach tdkhol l'application dyal L'Achats howa: *${c.otp}* . Dkhol l had lien: https://www.monbocadillo.ma/#/achats`;
                                                                       const waLink = `https://wa.me/${c.phone?.replace(/^0/, '212')}?text=${encodeURIComponent(msg)}`;
                                                                       window.open(waLink, '_blank');
                                                                   }}
                                                                   className="mt-1 bg-green-500 hover:bg-green-600 text-white w-max px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm flex items-center gap-1"
                                                               >
                                                                   📱 Envoyer WhatsApp
                                                               </button>
                                                           )}
                                                       </div>
                                                   )}
                                                   <span className="text-[9px] font-bold text-gray-400 mt-1">Créé le: {c.createdDate}</span>
                                               </div>
                                           ) : (
                                               <div className="flex flex-col items-start gap-1">
                                                   <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${c.isFreelance ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                       {c.isFreelance ? 'Livreur Freelance' : 'Livreur Officiel'}
                                                   </span>
                                                   <div className="flex items-center gap-2 mt-1">
                                                       <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-black bg-yellow-50 text-yellow-800 border border-yellow-200 shadow-sm">
                                                           🔑 Code : {c.otp || 'N/A'}
                                                       </span>
                                                       <button onClick={async() => { const newOtp = Math.floor(1000 + Math.random() * 9000).toString(); await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {otp: newOtp, otpVerified: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {otp: newOtp, otpVerified: false}, {merge:true}); showNotify("Code jdid t-généra! 🔄", "success"); }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-[10px] font-bold transition-all shadow-sm" title="Générer un nouveau code">
                                                           🔄 Bdel
                                                       </button>
                                                   </div>
                                                   <span className="text-[9px] font-bold text-gray-400 mt-1">Créé le: {c.createdDate}</span>
                                                   <span className="text-[9px] font-bold text-blue-500">Livreur depuis: {c.driverDate}</span>
                                                   
                                                   {c.isAppInstalled ? (
                                                       <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-green-50 text-green-700 border border-green-200 mt-1">📱 App Installée</span>
                                                   ) : (
                                                       <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-200 mt-1" title="Khdam ghir mn Navigateur">🌐 Non Installée</span>
                                                   )}

                                                   {c.otp && !c.otpVerified && (
                                                       <button 
                                                           onClick={() => {
                                                               const msg = `Salam ${c.name}, mar7ba bik m3ana! L-code de confirmation dyalek bach tdkhol l'application howa: *${c.otp}*`;
                                                               const waLink = `https://wa.me/${c.phone?.replace(/^0/, '212')}?text=${encodeURIComponent(msg)}`;
                                                               window.open(waLink, '_blank');
                                                           }}
                                                           className="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm flex items-center gap-1"
                                                       >
                                                           📱 Envoyer Code : {c.otp}
                                                       </button>
                                                   )}
                                               </div>
                                           )}
                                       </td>
                                       <td className="px-8 py-5">
                                           {!c.isDriver ? (
                                               <div className="flex flex-col">
                                                   <span className="text-base font-black text-gray-900">{c.totalOrders} <span className="text-[10px] uppercase text-gray-400">Cmds</span></span>
                                                   <span className="text-[10px] font-bold text-gray-500 truncate max-w-[180px]" title={c.lastAddress}>{c.lastAddress}</span>
                                                   {c.totalOrders > 0 && <span className="text-[9px] font-bold text-blue-500 mt-0.5">Dernière: {c.lastOrderDate}</span>}
                                                   <span className="text-[10px] font-black text-yellow-600 mt-0.5 flex items-center gap-1"><Star size={10}/> {c.availablePoints} pts</span>
                                               </div>
                                           ) : (
                                               <div className="flex flex-col items-start">
                                                   <span className="text-base font-black text-green-600">{c.totalLivraisons} <span className="text-[10px] uppercase text-green-700/60">Livraisons</span></span>
                                                   {c.totalLivraisons > 0 && <span className="text-[9px] font-bold text-blue-500 mt-0.5">Dernière: {c.lastDeliveryDate}</span>}
                                               </div>
                                           )}
                                       </td>
                                       <td className="px-8 py-5">
                                           <div className="flex items-center justify-end gap-2">
                                               {!c.isDriver ? (
                                                   <>
                                                       {role === 'admin' && <button onClick={async()=>{await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {blocked: !c.blocked}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {blocked: !c.blocked}, {merge:true}); showNotify(c.blocked ? "Débloqué ✅" : "Bloqué 🚫", "success");}} className={`p-3 rounded-xl transition-all shadow-sm ${c.blocked ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200' : 'bg-gray-50 text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-200'}`} title={c.blocked ? 'Débloquer' : 'Bloquer'}><Ban size={18}/></button>}
                                                       <button onClick={async()=>{ const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString(); await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isManager: true, otp: generatedOtp, otpVerified: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isManager: true, otp: generatedOtp, otpVerified: false}, {merge:true}); showNotify("Wella Gérant! 👨‍💼", "success");}} className="p-3 bg-gray-50 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Rendre Gérant Achats"><Store size={18}/></button>
                                                       <button onClick={async()=>{ const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString(); await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isDriver: true, isFreelance: false, driverSince: Date.now(), otp: generatedOtp, otpVerified: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isDriver: true, isFreelance: false, driverSince: Date.now(), otp: generatedOtp, otpVerified: false}, {merge:true}); showNotify("Wella Livreur! 🛵", "success");}} className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Rendre Livreur"><Truck size={18}/></button>
                                                   {role === 'admin' && <button onClick={() => setPointsModal({ show: true, client: c, adjust: 0 })} className="p-3 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-xl transition-all shadow-sm border border-yellow-200" title="Gérer les points"><Star size={18}/></button>}
                                                       {role === 'admin' && <button onClick={async()=>{if(window.confirm('Msa7 Client?')){await deleteDoc(doc(db,'artifacts',appId,'public','data','clients',c.id)); showNotify("Tmsa7 ✅", "success");}}} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Supprimer"><Trash2 size={18}/></button>}
                                                   </>
                                               ) : (
                                                   <>
                                                       <button onClick={async()=>{ await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isFreelance: !c.isFreelance}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isFreelance: !c.isFreelance}, {merge:true}); showNotify(c.isFreelance ? "Rje3 Livreur Officiel ✅" : "Wella Freelance ✅", "success"); }} className="px-4 py-3 text-[10px] font-black uppercase rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95 shadow-sm">Rendre {c.isFreelance ? 'Officiel' : 'Freelance'}</button>
                                                       {role === 'admin' && <button onClick={async()=>{ await setDoc(doc(db,'artifacts',appId,'public','data','clients',c.id), {isDriver: false}, {merge:true}); if(c.uid) await setDoc(doc(db,'artifacts',appId,'users',c.uid,'profile','data'), {isDriver: false}, {merge:true}); showNotify("Rje3 Kliyan! 👤", "success"); }} className="p-3 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-gray-200" title="Rétrograder en Client"><User size={18}/></button>}
                                                   </>
                                               )}
                                           </div>
                                       </td>
                                   </tr>
                               )
                           })}
                       </tbody>
                   </table>
                   {displayedClients.length === 0 && (
                       <div className="py-16 text-center text-gray-400 flex flex-col items-center">
                           <User size={40} className="mb-3 opacity-20"/>
                           <p className="font-semibold text-sm">Aucun compte trouvé</p>
                       </div>
                   )}
               </div>
           </div>
           
           {showAddDriver && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white p-8 md:p-10 rounded-[3rem] w-full max-w-md text-gray-900 shadow-2xl relative animate-in zoom-in-95 text-left">
                        <button onClick={() => setShowAddDriver(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full p-2 transition-colors"><X size={24}/></button>
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 border-4 border-blue-100"><Truck size={32} className="text-blue-600" /></div>
                        <h2 className="font-black text-2xl mb-8 uppercase tracking-tight text-gray-900">Nouveau Livreur</h2>
                        
                        <div className="space-y-5 mb-8">
                            <label className="block">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-2">Nom Complet</span>
                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Smit l-livreur" />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-2">Numéro de Téléphone</span>
                            <input type="tel" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold font-mono text-gray-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner" value={newDriver.phone} onChange={e => setNewDriver({...newDriver, phone: e.target.value.replace(/[^\d\s+-]/g, '')})} placeholder="06..." />
                            </label>
                            <label className="block mt-4">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block ml-2">Type de Livreur</span>
                                <select 
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner appearance-none cursor-pointer"
                                    value={newDriver.isFreelance ? 'freelance' : 'officiel'}
                                    onChange={e => setNewDriver({...newDriver, isFreelance: e.target.value === 'freelance'})}
                                >
                                    <option value="officiel">Officiel (Salarié)</option>
                                    <option value="freelance">Freelance (Indépendant)</option>
                                </select>
                            </label>
                        </div>

                        <button onClick={handleAddDriverSubmit} className="w-full bg-black hover:bg-gray-800 text-white font-black uppercase tracking-wider py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-sm">Ajouter Livreur</button>
                    </div>
                </div>
            )}

        {pointsModal.show && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-gray-100 flex flex-col gap-6 relative text-left">
                    <button onClick={() => setPointsModal({ show: false, client: null, adjust: 0 })} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full p-2 transition-all"><X size={20}/></button>
                    <div className="flex flex-col items-center text-center mt-2">
                        <div className="w-16 h-16 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mb-4 shadow-inner"><Star size={32} /></div>
                        <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Points Fidélité</h3>
                        <p className="text-sm font-bold text-gray-500 mt-1">{pointsModal.client?.name || pointsModal.client?.phone}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Solde Actuel</p>
                        <p className="text-4xl font-black text-yellow-500">{pointsModal.client?.availablePoints || 0} <span className="text-lg">pts</span></p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Ajustement (+ / -)</label>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setPointsModal(p => ({...p, adjust: p.adjust - 10}))} className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl font-black text-2xl hover:bg-red-100 transition-colors shadow-sm border border-red-200 flex items-center justify-center">-</button>
                            <input type="number" value={pointsModal.adjust} onChange={e => setPointsModal(p => ({...p, adjust: parseInt(e.target.value) || 0}))} className="flex-1 w-full bg-white border-2 border-gray-200 p-4 rounded-2xl text-center font-black text-xl outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all shadow-inner" />
                            <button onClick={() => setPointsModal(p => ({...p, adjust: p.adjust + 10}))} className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl font-black text-2xl hover:bg-green-100 transition-colors shadow-sm border border-green-200 flex items-center justify-center">+</button>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center font-bold mt-1">Le nouveau solde sera de <span className="text-gray-700">{(pointsModal.client?.availablePoints || 0) + pointsModal.adjust} pts</span></p>
                    </div>

                    <button onClick={async () => {
                        const c = pointsModal.client;
                        const newManual = (c.manualPoints || 0) + pointsModal.adjust;
                        try {
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', c.id), { manualPoints: newManual }, { merge: true });
                            if (c.uid) await setDoc(doc(db, 'artifacts', appId, 'users', c.uid, 'profile', 'data'), { manualPoints: newManual }, { merge: true });
                            showNotify("Points mis à jour ! 🌟", "success");
                            setPointsModal({ show: false, client: null, adjust: 0 });
                        } catch (e) {
                            showNotify("Erreur lors de la mise à jour", "error");
                        }
                    }} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-2xl font-black uppercase text-sm shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2">
                        Enregistrer
                    </button>
                </div>
            </div>
        )}
        </div>
    );
}