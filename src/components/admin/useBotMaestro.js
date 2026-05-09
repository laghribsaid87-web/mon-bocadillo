import { useEffect, useRef } from 'react';
import { doc, writeBatch } from 'firebase/firestore';

// Helper: Formule de Haversine pour calculer la distance (km) pour le KDS
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export default function useBotMaestro(db, appId, isBotMaestroEnabled, activeOrders, drivers, branches) {
    const lastRunTime = useRef(0);

    useEffect(() => {
        if (!isBotMaestroEnabled || !activeOrders || !branches) return;

        // Exécution bloquée à 1 fois toutes les 30 secondes pour éviter les boucles infinies
        const now = Date.now();
        if (now - lastRunTime.current < 30000) return;
        lastRunTime.current = now;

        const batch = writeBatch(db);
        let hasChanges = false;

        const laymoun = branches.find(b => b.name.toLowerCase().includes('laymoun'));
        const zoubire = branches.find(b => b.name.toLowerCase().includes('zoubire'));
        const oumRabii = branches.find(b => b.name.toLowerCase().includes('oum rabii'));

        // -----------------------------------------------------------------
        // STEP 2: Cloud Kitchen Routing (Laymoun Overload -> Zoubire)
        // -----------------------------------------------------------------
        let isLaymounOverloaded = false;
        if (laymoun && zoubire) {
            const laymounPending = activeOrders.filter(o => 
                o.branchId === laymoun.id && 
                (o.status === 'pending' || o.status === 'preparing')
            );
            
            const hasDelayedOrder = laymounPending.some(o => {
                const createdMs = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : now;
                return ((now - createdMs) / 60000) > 10; // + de 10 min de retard
            });

            isLaymounOverloaded = laymounPending.length >= 15 || hasDelayedOrder;

            if (isLaymounOverloaded) {
                const newLivraisonOrders = activeOrders.filter(o => 
                    o.branchId === laymoun.id && 
                    o.status === 'pending' && 
                    o.orderType === 'livraison' &&
                    !o.isBotRouted // Flag de sécurité
                );

                newLivraisonOrders.forEach(order => {
                    const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id);
                    batch.update(orderRef, {
                        branchId: zoubire.id,
                        nearestBranch: zoubire, 
                        isBotRouted: true,
                        botRoutingReason: 'LAYMOUN_RUSH_OVERLOAD'
                        // Règle analytique : L'Analytics pointera vers Zoubire car 'branchId' est modifié
                    });
                    hasChanges = true;
                });
            }
        }

        // -----------------------------------------------------------------
        // STEP 3: Smart Dispatching & The "Mounqid" Driver
        // -----------------------------------------------------------------
        const highValueOrders = activeOrders.filter(o => 
            (o.branchId === laymoun?.id || o.branchId === zoubire?.id) &&
            o.status === 'ready' && !o.driverId && o.total > 70
        );

        if (highValueOrders.length > 0 && oumRabii && drivers) {
            // IGNORER LES FREELANCERS : Règle critique
            const officialRescueDrivers = drivers.filter(d => !d.isFreelance && d.currentBranchId === oumRabii.id);

            for (const driver of officialRescueDrivers) {
                const assignedOrders = activeOrders.filter(o => o.driverId === driver.id && o.status === 'out_for_delivery');
                
                // Condition de "HOLD"
                const isAlmostFinished = driver.status === 'returning' || assignedOrders.every(o => o.distanceToClient < 0.5);
                if (assignedOrders.length >= 2 && isAlmostFinished) continue;

                if (assignedOrders.length <= 1) {
                    const currentOrder = assignedOrders[0];
                    // Priorité Valeur : Dispatcher si la commande en cours est petite (<= 20 DH)
                    if (!currentOrder || currentOrder.total <= 20) {
                        const targetOrder = highValueOrders[0];
                        const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', targetOrder.id);
                        
                        batch.update(orderRef, {
                            driverId: driver.id,
                            driverName: driver.name,
                            botDispatched: true,
                            botDispatchReason: 'MOUNQID_RESCUE_OPERATION'
                        });
                        hasChanges = true;
                        break; // Une seule mission de rescousse par cycle
                    }
                }
            }
        }

        // -----------------------------------------------------------------
        // STEP 4: Smart KDS ETA Calculation (Sans bloquer la cuisine)
        // -----------------------------------------------------------------
        if (drivers) {
            activeOrders.forEach(order => {
                if (order.driverId && (order.status === 'preparing' || order.status === 'ready')) {
                    const driver = drivers.find(d => d.id === order.driverId);
                    if (driver && driver.lat && driver.lng && order.lat && order.lng) {
                        const distKm = calculateDistance(driver.lat, driver.lng, order.lat, order.lng);
                        const etaMin = Math.ceil(distKm * 2); // 30 km/h = 2 min/km en ville
                        
                        if (order.driverETA !== etaMin) {
                            const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id);
                            batch.update(orderRef, { driverETA: etaMin });
                            hasChanges = true;
                        }
                    }
                }
            });
        }

        if (hasChanges) {
            batch.commit().catch(err => console.error("Bot Maestro Error:", err));
        }

    }, [isBotMaestroEnabled, activeOrders, drivers, branches, db, appId]);
}