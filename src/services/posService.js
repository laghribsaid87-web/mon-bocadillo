import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export const addAchat = async (db, appId, achatData) => {
    const achatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'achats');
    await addDoc(achatsRef, {
        ...achatData,
        createdAt: serverTimestamp()
    });
};

export const updatePosStatus = async (db, appId, branchId, statusData) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'pos_status', branchId);
    await setDoc(docRef, {
        ...statusData,
        lastUpdated: serverTimestamp()
    });
};

export const triggerGlovoVerification = async (db, appId, activeBranchId) => {
    const triggerId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const suffix = activeBranchId === 'oum_rabii' ? '_OumRabii' : activeBranchId === 'zoubire' ? '_Zoubire' : '';
    await setDoc(doc(db, "artifacts", appId, "public", "data", "settings", "glovo_trigger" + suffix), {
        action: "VERIFY_CANCELLATIONS",
        isHandled: false,
        triggerId: triggerId,
        timestamp: Date.now()
    });
};
