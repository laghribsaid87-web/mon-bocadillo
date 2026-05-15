import React, { useState, useEffect } from 'react';
import { MessageCircle, AlertTriangle, X, Share, PlusSquare, BellRing, Phone, User, Navigation } from 'lucide-react';
import { doc, getDoc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const btnRadius = brand.buttonStyle === 'square' ? 'rounded-xl' : (brand.buttonStyle === 'rounded' ? 'rounded-2xl' : 'rounded-full');
    
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

const proceedToGps = async (finalName, finalPhone) => {
       setLoading(true);
       try {
       // 🔥 Tsjal l-wa9t dyal l-Client mli kaytsjel awel merra
       const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', finalPhone);
       const snap = await getDoc(clientRef);
       if (!snap.exists()) {
           await setDoc(clientRef, { name: finalName, phone: finalPhone, isDriver: false, blocked: false, createdAt: serverTimestamp() });
       } else if (!snap.data().createdAt) {
           await updateDoc(clientRef, { createdAt: serverTimestamp() });
       }

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
      <div className="min-h-[100dvh] flex flex-col justify-center items-center p-4 md:p-6 w-full relative overflow-hidden" style={{backgroundColor: brand.bgColor || '#f8fafc', color: brand.textColor || '#0f172a'}}>
        {/* Effets de lumière en arrière-plan (Premium Look) */}
        <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-black/5 to-transparent z-0 pointer-events-none"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse z-0 pointer-events-none" style={{backgroundColor: brand.color}}></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-pulse z-0 pointer-events-none" style={{backgroundColor: brand.color, animationDelay: '2s'}}></div>

        {showInstallBtn && (
          <div className="absolute top-6 right-6 z-50">
             <button onClick={handleInstallApp} className="px-5 py-2.5 text-[11px] font-black uppercase shadow-[0_10px_20px_rgba(0,0,0,0.15)] active:scale-95 transition-all animate-bounce rounded-full border-2 border-white/50 backdrop-blur-md" style={{backgroundColor: brand.color, color: '#000'}}>
               📲 Installer l'App
             </button>
          </div>
        )}
        {showIosPrompt && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl p-6 pb-8 rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] animate-in slide-in-from-bottom-10 border-t border-white">
              <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg text-gray-900 tracking-tight">Installer l'App 🍎</h3>
                  <button onClick={dismissIosPrompt} className="p-2 bg-gray-100/80 rounded-full text-gray-500 hover:bg-gray-200 active:scale-95 transition-all"><X size={16}/></button>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-5 text-left">Ajoutez l'application à votre écran d'accueil pour un accès ultra-rapide :</p>
              <ol className="text-left text-sm font-bold text-gray-800 space-y-4">
                  <li className="flex items-center gap-4"><span className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100"><Share size={20} className="text-blue-500"/></span> 1. Touchez l'icône Partager en bas.</li>
                  <li className="flex items-center gap-4"><span className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100"><PlusSquare size={20} className="text-gray-500"/></span> 2. Choisissez "Sur l'écran d'accueil".</li>
              </ol>
          </div>
        )}
        {waSim && <div className="absolute top-4 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-top-10 flex items-center gap-3"><MessageCircle size={24} className="shrink-0" /><div className="text-left"><p className="font-bold text-[10px] opacity-80 uppercase">WhatsApp • À l'instant</p><p className="font-black text-xs mt-1 whitespace-pre-wrap leading-tight">{waSim}</p></div></div>}
        
        <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/60 p-8 md:p-10 relative z-10 flex flex-col items-center text-center">
            {brand.logoUrl ? (
                <div className="w-32 h-32 mb-8 relative">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{backgroundColor: brand.color}}></div>
                    <img src={brand.logoUrl} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-xl animate-in zoom-in duration-500" />
                </div>
            ) : (
                <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-white text-5xl mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.2)] animate-in zoom-in duration-500 relative" style={{backgroundColor: brand.color}}>
                    {(brand.name || 'M')[0]}
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{backgroundColor: brand.color}}></div>
                </div>
            )}
            
            {!brand.logoUrl && <h1 className="text-3xl font-black italic uppercase mb-2 leading-none tracking-tight" style={{color: brand.color}} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>}
            
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-8 text-gray-400">Bienvenue</p>
            
            <div className="w-full space-y-6 text-gray-800">
              {step === 1 && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                      <div className="text-left mb-6">
                          <h2 className="text-2xl font-black tracking-tight mb-2">Votre numéro ?</h2>
                          <p className="text-sm font-medium text-gray-500">Pour vous identifier et suivre votre commande.</p>
                      </div>
                      <div className={`relative flex items-center w-full bg-gray-50/80 hover:bg-gray-50 border-2 border-gray-100 ${btnRadius} overflow-hidden focus-within:bg-white focus-within:border-black focus-within:ring-4 focus-within:ring-black/5 transition-all shadow-inner group`}>
                          <div className="pl-4 pr-3 py-4 flex items-center gap-2 border-r-2 border-gray-200/80 bg-gray-100/30">
                              <span className="text-2xl leading-none drop-shadow-sm">🇲🇦</span>
                              <span className="text-gray-500 font-black text-lg tracking-wider group-focus-within:text-black transition-colors">+212</span>
                          </div>
                          <input 
                              className="flex-1 bg-transparent pl-4 pr-4 py-4 font-black outline-none text-xl tracking-widest text-gray-900 placeholder:text-gray-300 placeholder:font-medium w-full" 
                              placeholder="06XXXXXXXX" 
                              type="tel" 
                              value={phone} 
                              onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} 
                              autoFocus
                          />
                      </div>
                      <button 
                          onClick={handleSendCode} 
                          disabled={loading || phone.length < 10} 
                          className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.15)] active:scale-95 transition-all mt-6 flex items-center justify-center gap-2 overflow-hidden relative group disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none`} 
                          style={{backgroundColor: brand.color}}
                      >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                          <span className="relative z-10 flex items-center gap-2">
                              {loading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : "Continuer"}
                          </span>
                      </button>
                  </div>
              )}

              {step === 3 && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                      <div className="text-left mb-6">
                          <h2 className="text-2xl font-black tracking-tight mb-2">Votre prénom ?</h2>
                          <p className="text-sm font-medium text-gray-500">Pour personnaliser votre expérience.</p>
                      </div>
                      <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                              <User size={22} className="text-gray-400 group-focus-within:text-black transition-colors" />
                          </div>
                          <input 
                              className={`w-full bg-gray-50/80 hover:bg-gray-50 border-2 border-gray-100 pl-14 pr-4 py-4 ${btnRadius} font-black outline-none focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-lg shadow-inner text-gray-900 placeholder:text-gray-300 placeholder:font-medium`} 
                              placeholder="Ex: Yassine" 
                              type="text" 
                              value={name} 
                              onChange={e => setName(e.target.value)} 
                              autoFocus
                          />
                      </div>
                      <button 
                          onClick={() => proceedToGps(name, formatPhoneNumber(phone))} 
                          disabled={loading || !name.trim()} 
                          className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.15)] active:scale-95 transition-all mt-6 flex items-center justify-center gap-2 overflow-hidden relative group disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none`} 
                          style={{backgroundColor: brand.color}}
                      >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                          <span className="relative z-10 flex items-center gap-2">
                              {loading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : "C'est parti !"}
                          </span>
                      </button>
                  </div>
              )}

              {step === 4 && showManual && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in text-left">
                      <div className="mb-6">
                          <h2 className="text-2xl font-black tracking-tight mb-2">Où êtes-vous ?</h2>
                          <p className="text-sm font-medium text-gray-500">Le GPS est bloqué, veuillez choisir votre agence la plus proche manuellement.</p>
                      </div>
                      <div className="relative group mb-6">
                          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                              <Navigation size={20} className="text-gray-400 group-focus-within:text-black transition-colors" />
                          </div>
                          <select 
                              className={`w-full bg-gray-50/80 border-2 border-gray-100 pl-14 pr-4 py-4 ${btnRadius} font-bold outline-none focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-sm text-gray-900 appearance-none cursor-pointer shadow-sm`} 
                              value={manualBranch} 
                              onChange={e => setManualBranch(e.target.value)}
                          >
                              <option value="" disabled>Sélectionner une agence...</option>
                              {activeBranches.map(b => <option key={b.id} value={b.id} disabled={b.isOpen===false}>{b.name} {b.isOpen===false?'(Fermé)':''}</option>)}
                          </select>
                      </div>
                      <button 
                          onClick={handleManualSubmit} 
                          disabled={!manualBranch}
                          className={`w-full bg-black text-white py-4 ${btnRadius} font-black text-sm uppercase shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.15)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100`}
                      >
                          Confirmer l'agence
                      </button>
                  </div>
              )}

              {step === 5 && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-3xl mb-6 border border-blue-100/50 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                          <BellRing size={48} className="text-blue-500 mx-auto mb-4 animate-bounce relative z-10 drop-shadow-sm" />
                          <h3 className="font-black text-gray-900 text-xl mb-2 relative z-10 tracking-tight">Ne ratez rien ! 🔔</h3>
                          <p className="text-sm font-medium text-gray-600 relative z-10">Activez les notifications pour être alerté dès que votre commande est prête ou en route.</p>
                      </div>
                      <div className="flex flex-col gap-3">
                          <button 
                              onClick={async () => { try { await Notification.requestPermission(); } catch(e){} onComplete(completionData); }} 
                              className={`w-full text-white py-4 ${btnRadius} font-black text-sm uppercase shadow-[0_10px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_10px_25px_rgba(59,130,246,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700`}
                          >
                              Activer les alertes
                          </button>
                          <button 
                              onClick={() => onComplete(completionData)} 
                              className={`w-full text-gray-500 hover:text-gray-900 py-3 font-bold text-xs uppercase hover:bg-gray-100 ${btnRadius} transition-all`}
                          >
                              Peut-être plus tard
                          </button>
                      </div>
                  </div>
              )}
            </div>
        </div>
      </div>
    );
}