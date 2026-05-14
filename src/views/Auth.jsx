import React, { useState, useEffect, useRef } from 'react';
import { Lock, Phone, Mail, ArrowRight, Truck, Store } from 'lucide-react';

export default function Auth({ onLogin, onResetPassword, loading, type = 'admin', brand }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
      // Zoom global de l'interface (Ajusté pour être un peu plus grand)
      document.documentElement.style.fontSize = '13px';
      
      // Auto-remplissage du numéro si redirigé depuis la page client
      const params = new URLSearchParams(window.location.search);
      const urlPhone = params.get('phone');
      if (urlPhone) {
          setPhone(urlPhone);
      } else if (window.location.hash.includes('phone=')) {
          const match = window.location.hash.match(/phone=([^&]+)/);
          if (match && match[1]) setPhone(match[1]);
      }

      // 🔥 Auto-Login Livreur (Sauvegardé sur l'appareil)
      if (type === 'livreur' && !autoLoginAttempted.current) {
          autoLoginAttempted.current = true;
          const savedPhone = localStorage.getItem('driver_auto_phone');
          const savedPin = localStorage.getItem('driver_auto_pin');
          
          if (savedPhone && savedPin && onLogin) {
              setPhone(savedPhone);
              setPin(savedPin);
              // Petit délai pour s'assurer que l'état de l'application est prêt
              setTimeout(() => {
                  onLogin(savedPhone, savedPin);
              }, 150);
          }
      }
  }, [type, onLogin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if(onLogin) {
      if (type === 'admin') {
        onLogin(email, password);
      } else {
        localStorage.setItem('driver_auto_phone', phone);
        localStorage.setItem('driver_auto_pin', pin);
        onLogin(phone, pin);
      }
    }
  };

  const handleResetPassword = () => {
    if (!email) {
      alert("Veuillez d'abord saisir votre adresse email en haut pour réinitialiser le mot de passe.");
      return;
    }
    if (onResetPassword) onResetPassword(email);
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-center items-center p-4 font-sans w-full overflow-x-hidden">
      {/* Card SaaS Principale */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-10 animate-in fade-in zoom-in-95 flex flex-col items-center text-center">
        
        {brand && (
            <div className="mb-6 animate-in zoom-in duration-500 flex flex-col items-center">
                {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt="Logo" className="w-20 h-20 object-contain drop-shadow-md mb-2" />
                ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-3xl shadow-md mb-2" style={{backgroundColor: brand.color}}>
                        {(brand.name || 'M')[0]}
                    </div>
                )}
                <h1 className="text-xl font-black italic uppercase tracking-tight" style={{color: brand.color}} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>
            </div>
        )}

        <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-800 mb-4 shadow-inner">
            {type === 'livreur' ? <Truck size={24} /> : <Store size={24} />}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
            {type === 'livreur' ? 'Espace Livreur' : 'Espace Administration'}
        </h2>
        <p className="text-sm text-gray-500 mb-8 w-full">Connectez-vous à votre espace pour continuer.</p>

        <form onSubmit={handleSubmit} className="space-y-5 w-full text-left">
          {type === 'livreur' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 block">Numéro de téléphone</label>
                <div className="relative flex items-center w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-sm group">
                  <div className="pl-3.5 pr-2.5 py-2.5 flex items-center gap-1.5 border-r border-gray-200 bg-gray-100/50">
                      <span className="text-xl leading-none drop-shadow-sm">🇲🇦</span>
                      <span className="text-gray-500 font-bold text-sm tracking-wider group-focus-within:text-gray-900 transition-colors">+212</span>
                  </div>
                  <input 
                    type="tel" 
                    required
                    placeholder="06XXXXXXXX"
                    className="flex-1 bg-transparent pl-3 pr-4 py-2.5 text-gray-900 outline-none w-full font-medium placeholder:text-gray-400"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 block">Code de confirmation</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: 1234"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm tracking-widest font-mono"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 block">Adresse Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    required
                    placeholder="admin@exemple.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 block">Mot de passe</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm tracking-widest"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
            </div>
            <div className="flex justify-end mt-2">
              <button type="button" onClick={handleResetPassword} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                Mot de passe oublié ?
              </button>
                </div>
              </div>
            </>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'} <ArrowRight size={16} />
          </button>

          {type === 'livreur' && localStorage.getItem('driver_auto_phone') && (
              <button 
                  type="button" 
                  onClick={() => {
                      localStorage.removeItem('driver_auto_phone');
                      localStorage.removeItem('driver_auto_pin');
                      setPhone('');
                      setPin('');
                  }} 
                  className="w-full mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors text-center"
              >
                  Changer de compte livreur
              </button>
          )}
        </form>
      </div>

      {/* Footer Text */}
      <div className="mt-8 text-center text-xs text-gray-400 font-medium">
         Système de Gestion © {new Date().getFullYear()}
      </div>
    </div>
  );
}