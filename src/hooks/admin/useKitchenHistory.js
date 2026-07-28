import { useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';

export function useKitchenHistory(db, appId, selectedBranchId) {
    const [historyOrders, setHistoryOrders] = useState([]);
    const [lastHistoryDoc, setLastHistoryDoc] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchHistoryOrders = async (isLoadMore = false) => {
        setLoadingHistory(true);
        try {
            let q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                where('status', 'in', ['ready', 'delivered']),
                orderBy('updatedAt', 'desc')
            );
            
            if (selectedBranchId && selectedBranchId !== 'ALL') {
                q = query(q, where('branchId', '==', selectedBranchId));
            }
            
            if (isLoadMore && lastHistoryDoc) {
                q = query(q, startAfter(lastHistoryDoc), limit(10));
            } else {
                q = query(q, limit(10));
            }
            
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (!isLoadMore) {
                setHistoryOrders(data);
            } else {
                setHistoryOrders(prev => [...prev, ...data]);
            }
            setLastHistoryDoc(snap.docs[snap.docs.length - 1]);
        } catch (error) {
            console.error("Erreur historique:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    return { historyOrders, setHistoryOrders, lastHistoryDoc, setLastHistoryDoc, loadingHistory, fetchHistoryOrders };
}
