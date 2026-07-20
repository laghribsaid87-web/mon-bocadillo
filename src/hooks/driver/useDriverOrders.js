import { useMemo } from 'react';
import { updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDistance, getWhatsAppFormat, formatSansIngredient, openWhatsAppDirect } from '../../utils/helpers';

export function useDriverOrders({ orders, location, user, profile, brand, activeBranches, showNotify, db, appId, gpsActive }) {
    // Les commandes dyal had l-livreur (DEFINI AVANT useEffect)
    const { myOrders, activeOrders, newMissions, toPickupMissions, deliveryMissions } = useMemo(() => {
        const myOrds = orders?.filter(o => {
            if (o.source === 'pos') return false;
            if (user?.uid && o.driverId === user.uid) return true;
            // 🔥 FIX: Ghir L-Freelance hwa li kaychouf les commandes mnin L-Robot kay-decider ysifethom lih (Ila kano l-officiels 3amrin w l-Bouton activé f Idara)
            if (profile?.isFreelance && o.isFreelanceDriver && !o.driverAccepted && o.status !== 'delivered' && o.status !== 'rejected') return true;
            return false;
        }) || [];
        const actives = myOrds.filter(o => !['delivered', 'rejected'].includes(o.status));
        return {
            myOrders: myOrds,
            activeOrders: actives,
            newMissions: actives.filter(o => !o.driverAccepted),
            toPickupMissions: actives.filter(o => o.driverAccepted && ['pending', 'preparing', 'ready'].includes(o.status)),
            deliveryMissions: actives.filter(o => o.driverAccepted && o.status === 'out_for_delivery')
        };
    }, [orders, user?.uid, profile?.isFreelance]);

    // 🔥 Robot Sorting (Tartib b l-wa9t, w nchoufo chkon li f tri9)
    let sortedDeliveryMissions = [...deliveryMissions].sort((a, b) => {
        const timeA = a.acceptedAtLocal || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.acceptedAtLocal || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeA - timeB;
    });

    if (location && sortedDeliveryMissions.length > 1) {
        const primary = sortedDeliveryMissions[0];
        const distDriverToPrimary = getDistance(location.lat, location.lng, primary.lat, primary.lng);
        
        let bestEnRouteIndex = -1;
        let minEnRouteDist = Infinity;

        for (let i = 1; i < sortedDeliveryMissions.length; i++) {
            const other = sortedDeliveryMissions[i];
            if (!other.lat || !other.lng) continue;
            
            const distDriverToOther = getDistance(location.lat, location.lng, other.lat, other.lng);
            const distOtherToPrimary = getDistance(other.lat, other.lng, primary.lat, primary.lng);

            // Ila kant commande akhra a9rab l-livreur mn l-commande l-wla, w majayach b3ida 3la tri9 (+ 1.5x aw 2km max)
            if (distDriverToOther < distDriverToPrimary && (distDriverToOther + distOtherToPrimary <= distDriverToPrimary * 1.5 || distDriverToOther + distOtherToPrimary <= distDriverToPrimary + 2)) {
                if (distDriverToOther < minEnRouteDist) {
                    minEnRouteDist = distDriverToOther;
                    bestEnRouteIndex = i;
                }
            }
        }

        if (bestEnRouteIndex !== -1) {
            const recommended = sortedDeliveryMissions.splice(bestEnRouteIndex, 1)[0];
            recommended.isRobotRecommended = true;
            sortedDeliveryMissions.unshift(recommended);
        }
    }


    const handleAccept = async (order) => {
        const updates = { driverAccepted: true, acceptedAtLocal: Date.now() };
        
        // Ila kan officiel w khdaha mn 3nd freelance, n-modifiw driverId
        if (order.driverId !== user?.uid) {
            updates.driverId = user?.uid;
            updates.driverName = profile?.name;
            updates.isFreelanceDriver = false;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), updates);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user?.uid), { isAvailable: (activeOrders.length + 1 < 3), updatedAt: serverTimestamp() });
        showNotify("Commande acceptée ! ✅", "success");
    };

    const handleReject = async (order) => {
        setConfirmDialog({
            type: 'reject',
            message: '3afak khtar 3lach bghiti trewez had l-commande:',
            order: order
        });
    };

    const dismissReturnAlert = async (orderId) => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { driverAcknowledgedReturn: true });
    };

    const sendImNearMessage = (phone) => {
        const waPhone = getWhatsAppFormat(phone);
        const appUrl = window.location.origin + window.location.pathname;
        const msg = encodeURIComponent(`Salam, m3ak l-livreur dyal ${brand.name || 'Restaurant'}. Rah 9erebt nwssel 3ndk 🛵, 3afak wjed rassek bach tstalm l-commande.\n\nT9der t-suivi l-commande dyalk en temps réel mn hna: ${appUrl}\n\nChokran!`);
        
        // Envoie direct sans fenetre de confirmation (sur mobile)
        openWhatsAppDirect(waPhone, decodeURIComponent(msg));
        
        showNotify("Message siftnah l-client! 📱", "success");
    };


    return {
        myOrders, activeOrders, newMissions, toPickupMissions, deliveryMissions, sortedDeliveryMissions,
        handleAccept, handleReject, handleArrived, handleDeliver, dismissReturnAlert, sendImNearMessage
    };
}
