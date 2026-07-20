import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

export const useAchats = (db, appId, activeBranchId) => {
    const [achatsToday, setAchatsToday] = useState([]);
    const [glovoCancellationsToday, setGlovoCancellationsToday] = useState(0);
    const [glovoGroupedOrders, setGlovoGroupedOrders] = useState({});

    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL') return;
        const todayStr = new Date().toISOString().split('T')[0];
        const qAchats = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'achats'),
            where('branchId', '==', activeBranchId)
        );
        const unsub = onSnapshot(qAchats, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const todayList = list.filter(a => {
                const dateStr = a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split('T')[0] : null);
                return dateStr === todayStr;
            });
            setAchatsToday(todayList);
        });
        return () => unsub();
    }, [activeBranchId, db, appId]);

    useEffect(() => {
        if (!db || !appId) return;
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'glovo_cancellations_count');
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const timeToUse = data.updatedAt || docSnap.updateTime; 
                
                let isToday = false;
                if (timeToUse) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const d = timeToUse.toDate ? timeToUse.toDate() : new Date(timeToUse);
                    if (d.toISOString().split('T')[0] === todayStr) {
                        isToday = true;
                    }
                }
                
                if (isToday) setGlovoCancellationsToday(Number(data.count) || 0);
                else setGlovoCancellationsToday(0);
            } else {
                setGlovoCancellationsToday(0);
            }
        });
        return () => unsub();
    }, [db, appId]);

    useEffect(() => {
        if (!db || !appId) return;
        let suffix = "";
        if (activeBranchId !== 'ALL' && activeBranchId === 'oum_rabii') {
            suffix = "_OumRabii";
        }
        
        const rawGlovoCollection = collection(db, 'artifacts', appId, 'public', 'data', `Commandes_Brutes_Glovo${suffix}`);
        const qGroups = query(rawGlovoCollection, where('type', '==', 'GROUP_ORDERS'));
        
        const unsubscribe = onSnapshot(qGroups, (snapshot) => {
            const groups = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.orders && Array.isArray(data.orders)) {
                    data.orders.forEach(orderId => {
                        groups[orderId] = data.orders.filter(id => id !== orderId);
                    });
                }
            });
            setGlovoGroupedOrders(groups);
        });
        return () => unsubscribe();
    }, [db, appId, activeBranchId]);

    return { achatsToday, glovoCancellationsToday, glovoGroupedOrders };
};
