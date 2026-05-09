import React, { useState, useEffect } from 'react';
import { Lock, Phone, Mail, ArrowRight, Truck, Store } from 'lucide-react';

export default function Auth({ onLogin, onResetPassword, loading, type = 'admin' }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
      // Zoom global de l'interface (Ajusté pour être un peu plus grand)
      document.documentElement.style.fontSize = '13px';
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if(onLogin) {
      if (type === 'admin') {
        onLogin(email, password);
      } else {
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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-10 animate-in fade-in zoom-in-95">
        
        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white mb-6 shadow-sm">
            {type === 'livreur' ? <Truck size={24} /> : <Store size={24} />}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {type === 'livreur' ? 'Espace Livreur' : 'Espace Administration'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">Connectez-vous à votre espace pour continuer.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {type === 'livreur' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 block">Numéro de téléphone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone size={18} />
                  </div>
                  <input 
                    type="tel" 
                    required
                    placeholder="06XXXXXXXX ou 07XXXXXXXX"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
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
        </form>
      </div>

      {/* Footer Text */}
      <div className="mt-8 text-center text-xs text-gray-400 font-medium">
         Système de Gestion © {new Date().getFullYear()}
      </div>
    </div>
  );
}