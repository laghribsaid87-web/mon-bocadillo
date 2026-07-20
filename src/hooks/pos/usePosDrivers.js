import { useMemo, useEffect } from 'react';
import { updateDriverAvailability } from '../../services/driverService';

export function usePosDrivers({ onlineDrivers, clientsList, orders, defaultPosDriver, activeBranchId, db, appId, showNotify }) {
    // Filtrer uniquement les livreurs qui existent vraiment dans la liste des comptes
    const validOnlineDrivers = useMemo(() => {
        return (onlineDrivers || []).filter(d => {
            return (clientsList || []).some(c => c.isDriver === true && ((c.uid && c.uid === d.uid) || (d.phone && c.id === d.phone) || (c.id === d.id) || (c.id === d.uid)));
        });
    }, [onlineDrivers, clientsList]);

    // Calculer les commandes actives du livreur local
    const defaultDriverActiveOrders = useMemo(() => {
        if (!defaultPosDriver) return 0;
        return (orders || []).filter(o => o.driverId === defaultPosDriver && !['delivered', 'rejected'].includes(o.status)).length;
    }, [orders, defaultPosDriver]);

    // Trouver les livreurs libres d'autres agences si notre livreur est surchargé
    const idleOtherDrivers = useMemo(() => {
        const hasPendingOrReady = (orders || []).some(o => 
            (o.status === 'pending' || o.status === 'ready') && 
            o.source !== 'pos' && 
            (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId)
        );

        if (defaultPosDriver && defaultDriverActiveOrders >= 2 && hasPendingOrReady) {
            return validOnlineDrivers.filter(d => {
                if (d.uid === defaultPosDriver) return false;
                if (!d.isOnline) return false;
                const dOrders = (orders || []).filter(o => o.driverId === d.uid && !['delivered', 'rejected'].includes(o.status)).length;
                return dOrders === 0;
            });
        }
        return [];
    }, [defaultPosDriver, defaultDriverActiveOrders, orders, validOnlineDrivers, activeBranchId]);

    // Auto-release des livreurs en aide quand il n'y a plus de commandes
    const activeHelpers = useMemo(() => validOnlineDrivers.filter(d => d.isHelping === activeBranchId), [validOnlineDrivers, activeBranchId]);

    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL' || activeHelpers.length === 0) return;

        const branchNeedsHelp = (orders || []).some(o => 
            ['pending', 'preparing', 'ready'].includes(o.status) && 
            o.source !== 'pos' &&
            o.nearestBranch?.id === activeBranchId
        );

        activeHelpers.forEach(h => {
            const helperOrders = (orders || []).filter(o => o.driverId === h.uid && !['delivered', 'rejected'].includes(o.status));
            
            if (!branchNeedsHelp && helperOrders.length === 0) {
                updateDriverAvailability(db, appId, h.uid, true, null);
                if (showNotify) showNotify(`Livreur dyal aide (${h.name}) rah ghadi yrja3 poste dyalo`, "info");
            }
        });
    }, [orders, activeHelpers, activeBranchId, db, appId, showNotify]);

    return {
        validOnlineDrivers,
        defaultDriverActiveOrders,
        idleOtherDrivers,
        activeHelpers
    };
}
