import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Lock, X, Download, Package } from 'lucide-react';
import { onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, onSnapshot } from 'firebase/firestore';

import { auth, db, appId } from './config/firebase';
import { DEFAULT_BRAND } from './config/constants';
import ErrorBoundary from './components/ErrorBoundary';

const Auth = lazy(() => import('./views/Auth'));
const AchatInventaire = lazy(() => import('./views/AchatInventaire'));

function ManagerAchatsAppInner() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [brand, setBrand] = useState(DEFAULT_BRAND);
    const [notify, setNotify] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            localStorage.setItem('pwa_mode', 'achats');
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                setDeferredPrompt(null);
            });
        }
    };

    const showNotify = (msg, type = 'info') => {
        setNotify({ msg, type });
        setTimeout(() => setNotify(null), 3000);
    };

    useEffect(() => {
        const unsubBrand = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand'), (s) => { 
            if(s.exists()) setBrand(s.data()); 
        });
        return () => unsubBrand();
    }, []);

    useEffect(() => {
        let unsubAuth = null;
        let unsubProfile = null;

        setPersistence(auth, browserLocalPersistence).then(() => {
            unsubAuth = onAuthStateChanged(auth, async (u) => {
                if (u) {
                    setUser(u);
                    const savedPhone = localStorage.getItem('manager_phone');

                    if (unsubProfile) unsubProfile();
                    unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), async (docSnap) => {
                        if (docSnap.exists()) {
                            const pData = docSnap.data();
                            setProfile(pData);
                            setLoading(false);
                        } else {
                            if (savedPhone) {
                                try {
                                    const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', savedPhone);
                                    const clientSnap = await getDoc(clientRef);
                                    if (clientSnap.exists() && (clientSnap.data().isManager || clientSnap.data().isAdmin)) {
                                        const data = clientSnap.data();
                                        localStorage.setItem('pwa_mode', 'achats');
                                        await updateDoc(clientRef, { uid: u.uid });
                                        await setDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), { ...data, isRegistered: true, updatedAt: serverTimestamp() }, { merge: true });
                                        return;
                                    } else {
                                        localStorage.removeItem('manager_phone');
                                        setProfile({});
                                    }
                                } catch(e) {
                                    setProfile({});
                                }
                            } else {
                                setProfile({});
                            }
                            setLoading(false);
                        }
                    });
                } else {
                    signInAnonymously(auth).catch(() => setLoading(false));
                }
            });
        }).catch(err => console.error("Erreur Auth Persistence:", err));

        return () => {
            if (unsubAuth) unsubAuth();
            if (unsubProfile) unsubProfile();
        };
    }, []);

    if (loading) return <div className="h-screen flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}><div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand?.color || '#ffbc0d'}}></div></div>;

    if (!profile?.isRegistered) {
        return (
            <>
                {notify && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white shadow-lg font-bold text-xs uppercase tracking-widest ${notify.type === 'error' ? 'bg-red-500' : 'bg-black'}`}>{notify.msg}</div>}
                <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div></div>}>
                    <Auth 
                        type="manager"
                        brand={brand}
                        loading={loading}
                        onLogin={async (phone, pin) => {
                            setLoading(true);
                            let cleanPhone = phone.replace(/\D/g, '');
                            if (cleanPhone.length === 9 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('7'))) cleanPhone = '0' + cleanPhone;
                            try {
                                const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPhone);
                                const snap = await getDoc(clientRef);
                                if (snap.exists()) {
                                    const data = snap.data();
                                    if (data.blocked) { showNotify("Compte bloqué 🚫", "error"); setLoading(false); return; }
                                    if ((data.isAdmin || data.isManager) && data.otp === pin) {
                                        localStorage.setItem('manager_phone', cleanPhone);
                                        localStorage.setItem('pwa_mode', 'achats');
                                        await updateDoc(clientRef, { otpVerified: true, uid: user.uid });
                                        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { ...data, isRegistered: true, updatedAt: serverTimestamp() }, { merge: true });
                                        showNotify("Bienvenue sur l'App Achats ! 📦", "success");
                                    } else {
                                        showNotify("Code OTP incorrect ou accès refusé.", "error");
                                    }
                                } else {
                                    showNotify("Numéro introuvable.", "error");
                                }
                            } catch (error) {
                                console.error(error);
                                showNotify("Erreur de connexion.", "error");
                            }
                            setLoading(false);
                        }} 
                    />
                </Suspense>
            </>
        );
    }

    if (!profile?.isAdmin && !profile?.isManager) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
                <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-black shadow-2xl relative text-center">
                    <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/' : '/'} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-2"><X size={20}/></button>
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100"><Lock size={28} className="text-red-500" /></div>
                    <h2 className="font-black uppercase mb-2 text-xl tracking-widest text-gray-800">Accès Refusé</h2>
                    <p className="text-sm text-gray-500 mb-6 font-bold">Vous n'avez pas l'accès Manager.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {deferredPrompt && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 p-3 rounded-3xl shadow-2xl border border-slate-700 flex items-center gap-3 w-[95%] max-w-md animate-in slide-in-from-top-5">
                    <div className="bg-slate-800 p-2.5 rounded-2xl shrink-0"><Download size={22} className="text-blue-400"/></div>
                    <div className="flex-1 text-left">
                        <p className="text-xs font-black uppercase tracking-widest leading-tight text-white mb-0.5">App Gestion</p>
                        <p className="text-[10px] font-bold text-slate-400 leading-tight">Installez l'app Achats</p>
                    </div>
                    <button onClick={handleInstallClick} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl text-white bg-blue-600 hover:bg-blue-500 shadow-lg shrink-0 transition-colors">Installer</button>
                    <button onClick={() => setDeferredPrompt(null)} className="p-2 text-slate-500 hover:text-white bg-slate-800 rounded-xl shrink-0 transition-colors"><X size={16}/></button>
                </div>
            )}
            
            {notify && <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white shadow-lg font-bold text-xs uppercase tracking-widest ${notify.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>{notify.msg}</div>}
            
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div></div>}>
                {/* On passe branch='laymoune' par défaut si le manager n'a pas de branche précise, ou on utilise la sienne */}
                <AchatInventaire db={db} appId={appId} profile={profile} brand={brand} showNotify={showNotify} />
            </Suspense>
        </>
    );
}

export default function ManagerAchatsApp(props) {
    return (
        <ErrorBoundary>
            <ManagerAchatsAppInner {...props} />
        </ErrorBoundary>
    );
}
