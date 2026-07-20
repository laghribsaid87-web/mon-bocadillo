import { useMemo } from 'react';

export function usePosStats(orders, activeBranchId) {
// 🔥 Hssab dyal Z w Rapports
    const { completedOrdersToday, caPos, caApp, caTel, caGlovoEspece, caGlovoEnLigne, dailyCA, dailyItemsList } = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        const completed = (orders || []).filter(o => {
            if (activeBranchId !== 'ALL' && o.nearestBranch?.id !== activeBranchId) return false;
            
            if (o.source === 'pos') {
                if (o.status === 'rejected' || o.paymentStatus === 'en_attente') return false; 
            } else {
                if (o.status !== 'delivered') return false; 
            }
            
            try {
                let d = new Date();
                if (o.createdAt?.seconds) d = new Date(o.createdAt.seconds * 1000);
                else if (typeof o.createdAt === 'string' || typeof o.createdAt === 'number') d = new Date(o.createdAt);
                
                if (isNaN(d.getTime())) return false;
                return d.toISOString().split('T')[0] === todayStr;
            } catch (err) { return false; }
        });

        let cPos = 0, cApp = 0, cTel = 0, cGlovoEspece = 0, cGlovoEnLigne = 0;
        let itemsMap = {};

        completed.forEach(o => {
            const t = Number(o.total) || 0;
            if (o.source === 'pos') cPos += t;
            else if (o.source === 'telephone') cTel += t;
            else if (o.source === 'glovo') {
                if (o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') cGlovoEspece += t;
                else cGlovoEnLigne += t;
            }
            else cApp += t;

            (o.items || []).forEach(i => { 
                const baseName = (i.name || '').split(' (Sans ')[0]; 
                const sourcePrefix = o.source === 'glovo' ? 'Vente GLOVO : ' : 'Vente CAISSE : ';
                const finalName = sourcePrefix + baseName;
                itemsMap[finalName] = (itemsMap[finalName] || 0) + i.qty; 
            });
        });

        return {
            completedOrdersToday: completed, caPos: cPos, caApp: cApp, caTel: cTel, caGlovoEspece: cGlovoEspece, caGlovoEnLigne: cGlovoEnLigne,
            dailyCA: cPos + cApp + cTel + cGlovoEspece + cGlovoEnLigne,
            dailyItemsList: Object.entries(itemsMap).sort((a, b) => b[1] - a[1])
        };
    }, [orders, activeBranchId]);

    
    return {
        completedOrdersToday,
        caPos,
        caApp,
        caTel,
        caGlovoEspece,
        caGlovoEnLigne,
        dailyCA,
        dailyItemsList
    };
}
