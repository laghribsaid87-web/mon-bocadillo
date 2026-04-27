import React, { useState } from 'react';
import { MessageCircle, AlertTriangle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
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
    
    const activeBranches = settings.branches || DEFAULT_BRANCHES; 
    const btnRadius = brand.buttonStyle === 'square' ? 'rounded-md' : (brand.buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');
    
    const handleSendCode = async () => {
       const cleanPh = formatPhoneNumber(phone); 
       if(cleanPh.length < 9) return showNotify("N-nmra d-tél makhdamach!", "error");
       
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
                 (pos) => { const closest = getClosestBranch(pos.coords.latitude, pos.coords.longitude, activeBranches); onComplete({ name: finalName, phone: finalPhone, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest }); },
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
        onComplete({ name: name, phone: formatPhoneNumber(phone), lat: null, lng: null, nearestBranch: branch, gpsFailed: true }); 
    };
    
    return (
      <div className="min-h-screen flex flex-col justify-center items-center text-center p-6 bg-white rounded-3xl mt-4 md:mt-10 md:max-w-md md:mx-auto shadow-2xl border border-gray-100 relative overflow-hidden" style={{color: brand.textColor, backgroundColor: brand.bgColor}}>
        {waSim && <div className="absolute top-4 left-4 right-4 bg-green-500 text-white p-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-top-10 flex items-center gap-3"><MessageCircle size={24} className="shrink-0" /><div className="text-left"><p className="font-bold text-[10px] opacity-80 uppercase">WhatsApp • À l'instant</p><p className="font-black text-xs mt-1 whitespace-pre-wrap leading-tight">{waSim}</p></div></div>}
        {brand.logoUrl ? <img src={brand.logoUrl} alt="Logo" className="w-32 h-32 object-contain mb-6 drop-shadow-xl animate-in zoom-in" /> : <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-white text-5xl mb-6 shadow-xl animate-in zoom-in" style={{backgroundColor: brand.color}}>{(brand.name || 'M')[0]}</div>}
        {brand.logoUrl ? null : <h1 className="text-4xl font-black italic uppercase mb-2 leading-none" style={{color: brand.color}} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>}
        <p className="text-xs font-bold uppercase tracking-widest mb-8 opacity-70">Bienvenue !</p>
        <div className="w-full space-y-4 max-w-sm text-black">
          {step === 1 && <div className="animate-in slide-in-from-right"><input className={`w-full bg-white border-2 border-gray-200 p-4 ${btnRadius} font-bold outline-none focus:border-black text-lg tracking-widest text-center shadow-inner`} placeholder="06XXXXXXXX" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d\s\+\-]/g, ''))} /><button onClick={handleSendCode} disabled={loading} className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-lg active:scale-95 transition-all mt-4 flex items-center justify-center gap-2`} style={{backgroundColor: brand.color}}>{loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "Continuer"}</button></div>}
          {step === 3 && <div className="animate-in slide-in-from-right"><p className="text-xs font-bold text-gray-500 mb-4">Mre7ba bik! chnou smitk ?</p><input className={`w-full bg-white border-2 border-gray-200 p-4 ${btnRadius} font-bold outline-none focus:border-black text-lg text-center shadow-inner`} placeholder="Smitak Kamla" type="text" value={name} onChange={e => setName(e.target.value)} /><button onClick={() => proceedToGps(name, formatPhoneNumber(phone))} disabled={loading} className={`w-full text-black py-4 ${btnRadius} font-black text-sm uppercase shadow-lg active:scale-95 transition-all mt-4 flex items-center justify-center gap-2`} style={{backgroundColor: brand.color}}>{loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : "Continuer"}</button></div>}
          {step === 4 && showManual && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl animate-in slide-in-from-bottom-5"><p className="text-[10px] font-bold text-red-600 uppercase mb-3 flex items-center gap-1 justify-center"><AlertTriangle size={14}/> GPS Bloqué - Choix Manuel</p><select className="w-full bg-white border border-gray-200 p-3 rounded-xl outline-none font-bold text-sm mb-3" value={manualBranch} onChange={e => setManualBranch(e.target.value)}><option value="">Khtar a9rab agence...</option>{activeBranches.map(b => <option key={b.id} value={b.id} disabled={b.isOpen===false}>{b.name} {b.isOpen===false?'(Masdoud)':''}</option>)}</select><button onClick={handleManualSubmit} className={`w-full bg-black text-white py-3 ${btnRadius} font-black text-xs uppercase shadow-md active:scale-95 transition-all`}>Entrer</button></div>}
        </div>
      </div>
    );
}