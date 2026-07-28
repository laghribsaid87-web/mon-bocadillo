import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { RefreshCw, Bike, AlertTriangle, ArrowLeft, Calendar, UploadCloud } from 'lucide-react';
import { db, appId } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function GlovoReports({ brand }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    useEffect(() => {
        setLoading(true);
        let q;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'glovo_cancellations'),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end)
                // orderBy removed to prevent composite index issues, will sort in JS
            );
        } else {
            q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'glovo_cancellations'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
        }

        const unsub = onSnapshot(q, (snap) => {
            let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort manually in JS
            data.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
                return timeB - timeA;
            });
            setReports(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching reports:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [startDate, endDate]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => window.close()} 
                        className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black flex items-center gap-3">
                            <Bike className="text-[#FFC244]" size={32} />
                            Rapports d'Annulations Glovo
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Historique des vérifications de commandes annulées (GoDroid Automator)</p>
                    </div>
                    
                    <button 
                        onClick={async () => {
                            if (!window.confirm("Voulez-vous vraiment envoyer le menu actuel vers la boutique de test Glovo ?")) return;
                            try {
                                const functions = getFunctions();
                                const pushMenu = httpsCallable(functions, 'pushMenuToGlovo');
                                alert("Synchronisation en cours...");
                                const res = await pushMenu({ appId, storeId: "962002" });
                                alert("Succès: " + res.data.message);
                            } catch (e) {
                                console.error(e);
                                alert("Erreur lors de la synchronisation: " + e.message);
                            }
                        }}
                        className="ml-auto flex items-center gap-2 bg-[#FFC244] text-gray-900 font-bold px-4 py-3 rounded-2xl shadow-sm hover:bg-[#ffb01f] transition-all"
                    >
                        <UploadCloud size={20} />
                        <span className="hidden sm:inline">Sync Menu Glovo</span>
                    </button>
                </div>

                {/* FILTRES DE DATES */}
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Calendar size={20} className="text-gray-400" />
                            </div>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="pl-12 w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-700 font-bold outline-none focus:ring-2 focus:ring-[#FFC244]/50 focus:border-[#FFC244] transition-all"
                            />
                        </div>
                        <span className="text-gray-400 font-black uppercase text-xs">À</span>
                        <div className="w-full relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Calendar size={20} className="text-gray-400" />
                            </div>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="pl-12 w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-700 font-bold outline-none focus:ring-2 focus:ring-[#FFC244]/50 focus:border-[#FFC244] transition-all"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <RefreshCw className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
                        <AlertTriangle className="mx-auto text-yellow-400 mb-4" size={48} />
                        <h2 className="text-xl font-bold text-gray-700">Aucune commande annulée trouvée</h2>
                        <p className="text-gray-500 mt-2">Les rapports apparaîtront ici lorsque la tablette détectera des annulations.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map(report => {
                            let text = report.reasonText || "Aucun texte extrait";
                            
                            // Extraire le motif précis si possible, sinon garder le texte
                            const match = text.match(/(?:⚠️|⚠)?\s*Commande annul(?:ée|ee)[\s\S]*?\./i);
                            const finalReason = match ? (match[0].startsWith('⚠️') || match[0].startsWith('⚠') ? match[0] : '⚠️ ' + match[0]) : text;
                            
                            return (
                            <div key={report.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="shrink-0 flex flex-col items-center justify-center bg-red-50 text-red-600 rounded-2xl p-3 min-w-[100px]">
                                            <span className="text-xs font-bold uppercase mb-1">Lot</span>
                                            <span className="text-xl font-black">#{report.orderNumber || "GLOVO"}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Détails de l'annulation</h3>
                                            <p className="text-sm text-gray-500 font-medium mt-1">Rapport de commande annulée</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                                        {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('fr-FR') : new Date(report.createdAt).toLocaleString('fr-FR')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl text-sm font-bold text-pink-800 whitespace-pre-wrap">
                                        {finalReason}
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>
        </div>
    );
}
