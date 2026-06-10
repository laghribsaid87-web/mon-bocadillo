import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { RefreshCw, Bike, AlertTriangle, ArrowLeft } from 'lucide-react';
import { db, appId } from '../config/firebase';

export default function GlovoReports({ brand }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'glovo_cancellations'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(data);
            setLoading(false);
        });

        return () => unsub();
    }, []);

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
                        {reports.map(report => (
                            <div key={report.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                                <div className="shrink-0 flex flex-col items-center justify-center bg-red-50 text-red-600 rounded-2xl p-4 min-w-[120px]">
                                    <span className="text-sm font-bold uppercase mb-1">Commande</span>
                                    <span className="text-2xl font-black">#{report.orderNumber}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg">Détails de l'annulation</h3>
                                        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                            {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('fr-FR') : new Date(report.createdAt).toLocaleString('fr-FR')}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl text-sm font-mono text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {report.reasonText || "Aucun texte extrait"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
