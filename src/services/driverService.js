import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export const updateDriverAvailability = async (db, appId, driverId, isAvailable, activeOrderId = null) => {
    const driverRef = doc(db, 'artifacts', appId, 'public', 'data', 'drivers', driverId);
    await updateDoc(driverRef, {
        isAvailable,
        activeOrderId,
        lastActive: serverTimestamp()
    });
};
