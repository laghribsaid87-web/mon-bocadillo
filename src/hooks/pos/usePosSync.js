import { useState, useRef, useEffect } from 'react';
import { createPosOrder } from '../../services/orderService';

export function usePosSync(db, appId, showNotify) {
// 🔥 Offline Mode States (Mode Hors Ligne)
    const [isNetOnline, setIsNetOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState([]);
    const syncOfflineOrdersRef = useRef(null);

    useEffect(() => {
        syncOfflineOrdersRef.current = async () => {
            const stored = localStorage.getItem('posOfflineQueue');
            if (!stored) return;
            let queue = [];
            try { queue = JSON.parse(stored); } catch(e){ return; }
            if (queue.length === 0) return;

            showNotify(`Connexion rj3at! Kansifto ${queue.length} commandes... 🚀`, 'info');
            
            const remainingQueue = [];
            for (const order of queue) {
                try {
                    await createPosOrder(db, appId, {
                        ...order,
                        createdAt: order.offlineCreatedAt ? new Date(order.offlineCreatedAt) : undefined
                    });
                } catch (e) {
                    console.error("Échec de synchronisation:", e);
                    remainingQueue.push(order);
                }
            }
            
            setOfflineQueue(remainingQueue);
            localStorage.setItem('posOfflineQueue', JSON.stringify(remainingQueue));
            
            if (remainingQueue.length === 0) {
                showNotify("Ga3 l-commandes offline tsifto b-naja7! ✅", "success");
            }
        };
    }, [db, appId, showNotify]);

    useEffect(() => {
        const stored = localStorage.getItem('posOfflineQueue');
        if (stored) { try { setOfflineQueue(JSON.parse(stored)); } catch(e){} }
        
        const handleOnline = () => { setIsNetOnline(true); if (syncOfflineOrdersRef.current) syncOfflineOrdersRef.current(); };
        const handleOffline = () => setIsNetOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    
    const saveOfflineOrder = (order) => {
        setOfflineQueue(prev => {
            const current = [...prev, order];
            localStorage.setItem('posOfflineQueue', JSON.stringify(current));
            return current;
        });
        showNotify("Hors ligne : Commande mkhabya (Ghatssifet mli trje3 connexion) 💾", "info");
    };

    return {
        isNetOnline,
        offlineQueue,
        setOfflineQueue,
        saveOfflineOrder
    };
}
