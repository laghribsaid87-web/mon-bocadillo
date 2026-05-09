import React, { useState, useEffect } from 'react';
import { MessageCircle, AlertTriangle, X, Share, PlusSquare, BellRing } from 'lucide-react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { formatPhoneNumber, getWhatsAppFormat, getClosestBranch, buildMessage } from '../utils/helpers';
import { DEFAULT_BRANCHES, DEFAULT_BRAND } from '../config/constants';
import { appId } from '../config/firebase';

export default function AuthView({ onComplete, brand, settings, showNotify, db }) {
    const [step, setStep] = useState(1); 
    const [phone, setPhone] = useState(''); 
    const [name, setName] = useState(''); 
    const [code, setCode] = useState(''); 
    const [generatedCode, setGeneratedCode] = useState(''); 
    const [loading, setLoading] = useState(false); 
    const [waSim, setWaSim] = useState(null); 
    const [showManual, setShowManual] = useState(false); 
    const [manualBranch, setManualBranch] = useState('');
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [showIosPrompt, setShowIosPrompt] = useState(false);
    const [completionData, setCompletionData] = useState(null);
    
    const activeBranches = settings.branches || DEFAULT_BRANCHES; 
    const btnRadius = brand.buttonStyle === 'square' ? 'rounded-md' : (brand.buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');
    
    useEffect(() => {
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);

    useEffect(() => {
        const isIos = () => {
          const userAgent = window.navigator.userAgent.toLowerCase();
          return /iphone|ipad|ipod/.test(userAgent);
        };
        const isStandalone = () => ('standalone' in window.navigator) && window.navigator.standalone;
        const hasDismissed = localStorage.getItem('iosInstallDismissed');

        if (isIos() && !isStandalone() && !hasDismissed) {
            setShowIosPrompt(true);
        }
    }, []);

    useEffect(() => {
        if (window.deferredPWAInstall) {
            setDeferredPrompt(window.deferredPWAInstall);
            setShowInstallBtn(true);
        }
        
        const handler = (e) => {
            e.preventDefault();
            window.deferredPWAInstall = e;
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPWAInstall = null;
            setShowInstallBtn(false);
            try {
                // Increment a counter in Firestore when the PWA is installed
                const installStatsRef = doc(db, 'artifacts', appId, 'stats', 'pwa_installs');
                await updateDoc(installStatsRef, {
                    totalInstalls: increment(1),
                    lastInstallAt: new Date().toISOString()
                }, { merge: true }); // merge:true will create the document if it doesn't exist
            } catch (error) { console.error("Error incrementing PWA install counter:", error); }
        }
        setDeferredPrompt(null);
    };

    const dismissIosPrompt = () => {
        setShowIosPrompt(false);
        localStorage.setItem('iosInstallDismissed', 'true');
    };

    const handleSendCode = async () => {
       const cleanPh = formatPhoneNumber(phone); 
       if(!/^(06|07)\d{8}$/.test(cleanPh)) return showNotify("N-nmra khassha tbda b 06 wla 07 w fiha 10 d'ar9am!", "error");
       
       setLoading(true); 
       try {
           const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPh); 
           const snap = await getDoc(clientRef);
           if(snap.exists() && snap.data().name) {
               proceedToGps(snap.data().name, cleanPh);
           } else {
               setLoading(false);
               setStep(3);
           }
       } catch (error) {
           console.error("Firestore Error:", error);
           setLoading(false);
           showNotify("Mochkil f'connexion m3a serveur (réseau wla permissions).", "error");
       }
    };

    const proceedToGps = (finalName, finalPhone) => {
       setLoading(true);
       try {
           if(navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                 (pos) => { 
                     const closest = getClosestBranch(pos.coords.latitude, pos.coords.longitude, activeBranches); 
                     const data = { name: finalName, phone: finalPhone, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest };
                     if ('Notification' in window && Notification.permission === 'default') {
                         setCompletionData(data);
                         setStep(5);
                         setLoading(false);
                     } else { onComplete(data); }
                 },
                 () => { setLoading(false); setShowManual(true); setStep(4); showNotify("L'navigateur mabeghach ye3ti l'GPS!", "error"); }, { enableHighAccuracy: true, timeout: 10000 }
              );
           } else { setLoading(false); setShowManual(true); setStep(4); }
       } catch (error) {
           console.error("GPS/Completion Error:", error);
           setLoading(false);
           showNotify("W9e3 mochkil f'systeme", "error");
       }
    };

    const handleManualSubmit = () => { 
        if(!manualBranch) return showNotify("Khtar l'agence!", "error"); 
        const branch = activeBranches.find(b => b.id === manualBranch); 
        const data = { name: name, phone: formatPhoneNumber(phone), lat: null, lng: null, nearestBranch: branch, gpsFailed: true };
        if ('Notification' in window && Notification.permission === 'default') {
            setCompletionData(data);
            setStep(5);
        } else { onComplete(data); }
    };
    
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center items-center text-center p-6 bg-white rounded-3xl mt-4 md:mt-10 md:max-w-md md:mx-auto shadow-2xl border border-gray-100 relative overflow-hidden w-full overflow-x-hidden" style={{color: brand.textColor, backgroundColor: brand.bgColor}}>
        {showInstallBtn && (
          <div className="absolute top-4 right-4 z-50">
             <button onClick={handleInstallApp} className={`px-4 py-2.5 text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all animate-bounce ${btnRadius}`} style={{backgroundColor: brand.color, color: '#000'}}>
               📲 Installer
             </button>
          </div>
        )}
        {showIosPrompt && (
          <div className="absolute bottom-0 left-0 right-0 bg-white p-6 pb-8 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-[100] animate-in slide-in-from-bottom-10 border-t border-gray-100">
              <div className="flex justify-between items-start mb-3">
                  <h3 className="font-black text-lg text-gray-900">Installer sur iPhone 🍎</h3>
                  <button onClick={dismissIosPrompt} className="p-2 bg-gray-100 rounded-full text-gray-500 active:scale-95 transition-all"><X size={16}/></button>
              </div>
              <p className="text-sm font-bold text-gray-600 mb-4 text-left">Pour une meilleure expérience, ajoutez l'application à votre écran d'accueil :</p>
              <ol className="text-left text-sm font-medium text-gray-800 space-y-3">
                  <li className="flex items-center gap-3">1️⃣ Cliquez sur l'icône <span className="bg-gray-100 p-2 rounded-lg shadow-sm border border-gray-200"><Share size={18} className="text-blue-500"/></span> en bas.</li>
                  <li className="flex items-center gap-3">2️⃣ Choisissez <span className="bg-gray-100 p-2 rounded-lg font-black text-xs shadow-sm border border-gray-200">Sur l'écran d'accueil</span> <PlusSquare size={18} className="text-gray-500"/></li>
              </ol>
          </div>
        )}
        {waSim && <div className="absolute top-4 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-top-10 flex items-center gap-3"><MessageCircle size={24} className="shrink-0" /><div className="text-left"><p className="font-bold text-[10px] opacity-80 uppercase">WhatsApp • À l'instant</p><p className="font-black text-xs mt-1 whitespace-pre-wrap leading-tight">{waSim}</p></div></div>}
        {brand.logoUrl ? <img src={brand.logoUrl} alt="Logo" className="w-32 h-32 object-contain mb-6 drop-shadow-xl animate-in zoom-in" /> : <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-white text-5xl mb-6 shadow-xl animate-in zoom-in" style={{backgroundColor: brand.color}}>{(brand.name || 'M')[0]}</div>}
        {brand.logoUrl ? null : <h1 className="text-4xl font-black italic uppercase mb-2 leading-none" style={{color: brand.color}} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>}
        <p className="text-xs font-bold uppercase tracking-widest mb-8 opacity-70">Bienvenue !</p>
        <div className="w-full space-y-4 max-w-sm text-black">
          {step === 1 && <div className="animate-in slide-in-from-right"><input className={`w-full bg-white border-2 border-gray-200 p-4 ${btnRadius} font-bold outline-none focus:border-black text-lg tracking-widest text-center shadow-inner`} placeholder="06XXXXXXXX ou 07XXXXXXXX" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} /><button onClick={handleSendCode} disabled={loading} className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-lg active:scale-95 transition-all mt-4 flex items-center justify-center gap-2`} style={{backgroundColor: brand.color}}>{loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "Continuer"}</button></div>}
          {step === 3 && <div className="animate-in slide-in-from-right"><p className="text-xs font-bold text-gray-500 mb-4">Mre7ba bik! chnou smitk ?</p><input className={`w-full bg-white border-2 border-gray-200 p-4 ${btnRadius} font-bold outline-none focus:border-black text-lg text-center shadow-inner`} placeholder="Smitak Kamla" type="text" value={name} onChange={e => setName(e.target.value)} /><button onClick={() => proceedToGps(name, formatPhoneNumber(phone))} disabled={loading} className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-lg active:scale-95 transition-all mt-4 flex items-center justify-center gap-2`} style={{backgroundColor: brand.color}}>{loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "Continuer"}</button></div>}
          {step === 4 && showManual && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl animate-in slide-in-from-bottom-5"><p className="text-[10px] font-bold text-red-600 uppercase mb-3 flex items-center gap-1 justify-center"><AlertTriangle size={14}/> GPS Bloqué - Choix Manuel</p><select className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none font-bold text-sm mb-3" value={manualBranch} onChange={e => setManualBranch(e.target.value)}><option value="">Khtar a9rab agence...</option>{activeBranches.map(b => <option key={b.id} value={b.id} disabled={b.isOpen===false}>{b.name} {b.isOpen===false?'(Masdoud)':''}</option>)}</select><button onClick={handleManualSubmit} className={`w-full bg-black text-white py-3 ${btnRadius} font-black text-xs uppercase shadow-md active:scale-95 transition-all`}>Entrer</button></div>}
          {step === 5 && <div className="animate-in slide-in-from-right"><div className="bg-blue-50 p-6 rounded-2xl mb-4 border border-blue-100"><BellRing size={40} className="text-blue-500 mx-auto mb-3 animate-bounce" /><h3 className="font-black text-gray-900 text-lg mb-2">Restez informé ! 🔔</h3><p className="text-xs font-bold text-gray-500">Activez les notifications pour savoir quand votre commande est prête ou en route.</p></div><button onClick={async () => { try { await Notification.requestPermission(); } catch(e){} onComplete(completionData); }} className={`w-full text-white py-4 ${btnRadius} font-black text-sm uppercase shadow-lg active:scale-95 transition-all mb-3 flex items-center justify-center gap-2 bg-blue-500`}>Activer les Notifications</button><button onClick={() => onComplete(completionData)} className="w-full text-gray-500 py-3 font-bold text-xs uppercase hover:bg-gray-50 rounded-xl transition-all">Plus tard</button></div>}
        </div>
      </div>
    );
}