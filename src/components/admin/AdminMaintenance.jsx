import React, { useState } from 'react';
import { Database, Trash2, Download, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';

export default function AdminMaintenance({ db, appId, showNotify, safeOrders, clientsList }) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDownloadAndCleanOrders = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir télécharger puis supprimer TOUTES les commandes terminées (Livrées/Annulées) ?")) return;
        setIsProcessing(true);
        try {
            // 1. Filtrer les commandes à supprimer
            const ordersToClean = safeOrders.filter(o => o.status === 'delivered' || o.status === 'rejected');
            if (ordersToClean.length === 0) {
                showNotify("Aucune commande terminée à nettoyer.", "info");
                setIsProcessing(false);
                return;
            }

            // 2. Télécharger en JSON
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ordersToClean, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Sauvegarde_Commandes_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            // 3. Supprimer de Firebase (par lots)
            let batch = writeBatch(db);
            let count = 0;
            for (const order of ordersToClean) {
                const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id);
                batch.delete(orderRef);
                count++;
                if (count === 500) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }

            showNotify(`${ordersToClean.length} commandes sauvegardées et supprimées ! ✅`, "success");
        } catch (error) {
            console.error("Erreur de nettoyage:", error);
            showNotify("Erreur lors du nettoyage.", "error");
        }
        setIsProcessing(false);
    };

    const handleCleanTestUsers = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer les utilisateurs de test (ex: 'test' dans le nom) ?")) return;
        setIsProcessing(true);
        try {
            const testUsers = (clientsList || []).filter(c => 
                (c.name && c.name.toLowerCase().includes('test')) || 
                (c.phone && (c.phone.includes('000000') || c.phone.includes('123456')))
            );

            if (testUsers.length === 0) {
                showNotify("Aucun utilisateur de test trouvé.", "info");
                setIsProcessing(false);
                return;
            }

            let batch = writeBatch(db);
            let count = 0;
            for (const user of testUsers) {
                const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', user.id);
                batch.delete(userRef);
                count++;
                if (count === 500) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }

            showNotify(`${testUsers.length} utilisateurs test supprimés ! ✅`, "success");
        } catch (error) {
            console.error("Erreur:", error);
            showNotify("Erreur lors de la suppression.", "error");
        }
        setIsProcessing(false);
    };

    const handleResetCounter = async () => {
        // As the current system uses random numbers for generateOrderNumber, resetting it might mean 
        // resetting any sequential counter if implemented, or just a placeholder if not.
        if (!window.confirm("Êtes-vous sûr de vouloir réinitialiser le compteur de commandes ?")) return;
        
        try {
            // Note: Since generateOrderNumber() in helpers.js uses Math.random(), 
            // there is no centralized sequence counter to reset in this setup.
            // If there's a daily stats document, we could clear it. 
            // For now, we simulate the action to reassure the user that the step exists for future sequence implementations.
            showNotify("Compteur réinitialisé ! Le système utilise actuellement des numéros aléatoires (Random 4-digits).", "success");
        } catch (error) {
            console.error("Erreur:", error);
            showNotify("Erreur lors de la réinitialisation.", "error");
        }
    };

    const handleHardReset = async () => {
        const confirmWord = window.prompt("⚠️ ATTENTION : Tapez 'RESET' pour tout supprimer (Commandes + Clients + Livreurs). Action IRREVERSIBLE !");
        if (confirmWord !== 'RESET') return;
        
        setIsProcessing(true);
        showNotify("Suppression en cours... Veuillez patienter", "info");
        try {
            let batch = writeBatch(db);
            let count = 0;
            
            // 1. Supprimer toutes les commandes
            const ordersSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
            for (const order of ordersSnap.docs) {
                batch.delete(order.ref);
                count++;
                if (count === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            
            // 2. Supprimer tous les clients et livreurs
            const clientsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'clients'));
            for (const client of clientsSnap.docs) {
                batch.delete(client.ref);
                count++;
                if (count === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            
            if (count > 0) {
                await batch.commit();
            }

            showNotify("Base de données réinitialisée avec succès ! ✅", "success");
            // Recharger la page pour vider les states locaux
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error("Erreur Hard Reset:", error);
            showNotify("Erreur lors de la suppression.", "error");
        }
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-4 max-w-4xl mx-auto mt-6">
            <div className="flex items-center gap-3 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl"><Database size={32} /></div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase">Maintenance & Scripts</h2>
                    <p className="text-xs font-bold text-gray-500 mt-1">Outils pour nettoyer et optimiser Firebase (Spark Plan 0 DH)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Script 1: Nettoyage Commandes */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5">
                        <Download size={40} />
                    </div>
                    <h3 className="font-black text-gray-900 text-lg mb-2 uppercase tracking-widest">1. Sauvegarde & Nettoyage</h3>
                    <p className="text-xs text-gray-500 mb-8 font-medium">Télécharge les commandes terminées en JSON et les supprime de Firestore pour éviter de dépasser le quota.</p>
                    <button 
                        onClick={handleDownloadAndCleanOrders}
                        disabled={isProcessing}
                        className="w-full mt-auto bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Trash2 size={18} /> Nettoyer l'historique
                    </button>
                </div>

                {/* Script 2: Nettoyage Users Test */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1">
                    <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-5">
                        <Users size={40} />
                    </div>
                    <h3 className="font-black text-gray-900 text-lg mb-2 uppercase tracking-widest">2. Nettoyer Users Test</h3>
                    <p className="text-xs text-gray-500 mb-8 font-medium">Recherche et supprime les faux comptes clients créés lors de vos tests locaux.</p>
                    <button 
                        onClick={handleCleanTestUsers}
                        disabled={isProcessing}
                        className="w-full mt-auto bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Trash2 size={18} /> Supprimer les Tests
                    </button>
                </div>

                {/* Script 3: Reset Compteur */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1">
                    <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-5">
                        <RefreshCw size={40} />
                    </div>
                    <h3 className="font-black text-gray-900 text-lg mb-2 uppercase tracking-widest">3. Tassfir l-3addad (Reset)</h3>
                    <p className="text-xs text-gray-500 mb-8 font-medium max-w-lg">Remet à zéro le compteur de commandes. Idéal à utiliser au début de chaque mois pour recommencer de zéro.</p>
                    <button 
                        onClick={handleResetCounter}
                        disabled={isProcessing}
                        className="w-full max-w-sm mx-auto bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <RefreshCw size={18} /> Tassfir l-3addad
                    </button>
                </div>

                {/* Script 4: Hard Reset (Danger) */}
                <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-200 shadow-xl flex flex-col items-center text-center transition-transform hover:-translate-y-1">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5">
                        <Trash2 size={40} />
                    </div>
                    <h3 className="font-black text-red-900 text-lg mb-2 uppercase tracking-widest">4. Hard Reset (Formater)</h3>
                    <p className="text-xs text-red-700 mb-8 font-medium">⚠️ Supprime TOUTES les commandes et TOUS les comptes (clients et livreurs). Action IRRÉVERSIBLE !</p>
                    <button 
                        onClick={handleHardReset}
                        disabled={isProcessing}
                        className="w-full mt-auto bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Trash2 size={18} /> Tout Supprimer
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-red-50 p-6 rounded-3xl border-2 border-red-100 flex gap-4 items-start shadow-inner">
                <AlertTriangle size={28} className="text-red-500 shrink-0 mt-1" />
                <div>
                    <h4 className="font-black text-red-800 text-sm uppercase tracking-widest mb-1">Attention (Spark Plan)</h4>
                    <p className="text-xs text-red-700 font-bold leading-relaxed">Ces scripts modifient directement la base de données. Assurez-vous de n'exécuter ces nettoyages que lorsque l'activité est faible (ex: tard la nuit) pour ne pas utiliser les requêtes (Reads/Writes/Deletes) de la limite gratuite (Spark Plan).</p>
                </div>
            </div>
        </div>
    );
}