import React, { useState } from 'react';
import { Lock, Phone, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Auth({ onLogin, loading }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Remarque: L'appel réel kaykhdem b function onLogin li mssayfbta mn App.jsx
    if(onLogin) onLogin(phone, pin);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans">
      {/* Card SaaS Principale */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-10 animate-in fade-in zoom-in-95">
        
        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white mb-6 shadow-sm">
            <ShieldCheck size={24} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bienvenue</h1>
        <p className="text-sm text-gray-500 mb-8">Connectez-vous à votre espace pour continuer.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 block">Numéro de téléphone</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Phone size={18} />
              </div>
              <input 
                type="tel" 
                required
                placeholder="06XXXXXXXX"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\+\-]/g, ''))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 block">Mot de passe / Code PIN</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                required
                placeholder="••••"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
          </div>

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