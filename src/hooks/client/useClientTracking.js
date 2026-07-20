import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getDatabase, ref as rtdbRef, onValue } from 'firebase/database';

export function useClientTracking({ db, appId, user, info, orders, setInfo, showNotify, setEditPhoneMode, newPhone }) {
    const [trackDrivers, setTrackDrivers] = useState([]);

    // 🔥 NOUVEAU : Fonction bach nbedlou n-nmra f profil w f les commandes li mazal en cours
    const handleUpdatePhoneTracking = async () => {
        const cleanPh = newPhone.replace(/[^\d]/g, '');
        if (!/^(06|07)\d{8}$/.test(cleanPh)) {
            showNotify("N-nmra khassha tbda b 06 wla 07 w fiha 10 d'ar9am!", "error");
            return;
        }
        
        try {
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { phone: cleanPh }, { merge: true });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPh), { name: info.name, phone: cleanPh, uid: user.uid }, { merge: true });
            
            const activeOrds = clientOrders.filter(o => !['delivered', 'rejected'].includes(o.status));
            for (const o of activeOrds) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { phone: cleanPh });
            }
            
            setInfo(prev => ({ ...prev, phone: cleanPh }));
            setEditPhoneMode(false);
            showNotify("Numéro mis à jour avec succès! ✅", "success");
        } catch (e) {
            showNotify("Erreur lors de la mise à jour.", "error");
        }
    };

    // 🔥 OPTIMISATION (Performance Fix): Cacher les calculs des commandes pour éviter le lag (T9ol)
    const { clientOrders, pastOrders, pointsEarned, pointsUsedTotal, availablePoints } = useMemo(() => {
        const cOrders = (orders || []).filter(o => (info.phone && o.phone === info.phone) || (user?.uid && o.userId === user.uid));
        const pOrders = cOrders.filter(o => o.status === 'delivered');
        const pEarned = pOrders.reduce((s, o) => s + Math.floor((o.subtotal || 0) / 10), 0) + (info.manualPoints || 0); 
        const pUsed = pOrders.reduce((s, o) => s + (o.pointsUsed || 0), 0);
        return {
            clientOrders: cOrders,
            pastOrders: pOrders,
            pointsEarned: pEarned,
            pointsUsedTotal: pUsed,
            availablePoints: Math.max(0, pEarned - pUsed)
        };
    }, [orders, info.phone, user, info.manualPoints]);
    
    // 🔥 NOUVEAU (FIX): N-trackiw l'GPS dyal l-livreur f l-app Client (Ghir mli katkon "out_for_delivery")
    useEffect(() => {
        const activeDriverIds = [...new Set(clientOrders.filter(o => o.status === 'out_for_delivery' && o.driverId).map(o => o.driverId))];
        
        if (activeDriverIds.length === 0) {
            setTrackDrivers([]);
            return;
        }
        
        const rtdb = getDatabase();

        const unsubsFirestore = activeDriverIds.map(dId => {
            return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', dId), (docSnap) => {
                if (docSnap.exists()) {
                    setTrackDrivers(prev => {
                        const newDrivers = prev.filter(d => d.uid !== dId);
                        const existing = prev.find(d => d.uid === dId);
                        const lat = existing?.lat || docSnap.data().lat;
                        const lng = existing?.lng || docSnap.data().lng;
                        newDrivers.push({ uid: docSnap.id, ...docSnap.data(), lat, lng });
                        return newDrivers;
                    });
                }
            });
        });

        const unsubsRTDB = activeDriverIds.map(dId => {
            return onValue(rtdbRef(rtdb, `tracking/${appId}/drivers/${dId}`), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setTrackDrivers(prev => {
                        const newDrivers = prev.filter(d => d.uid !== dId);
                        const existing = prev.find(d => d.uid === dId) || { uid: dId };
                        newDrivers.push({ ...existing, lat: data.lat, lng: data.lng });
                        return newDrivers;
                    });
                }
            });
        });

        return () => {
            unsubsFirestore.forEach(unsub => unsub());
            unsubsRTDB.forEach(unsub => unsub());
        };
    }, [clientOrders, db, appId]);


    return {
        clientOrders,
        pastOrders,
        pointsEarned,
        pointsUsedTotal,
        availablePoints,
        trackDrivers,
        handleUpdatePhoneTracking
    };
}
