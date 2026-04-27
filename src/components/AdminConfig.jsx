import React, { useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase'; // L'instance principale de ton application

// Configuration Firebase identique à celle de ton fichier principal
const firebaseConfig = {
  apiKey: "AIzaSyAE5KH9KkeN22zCvv6Jx_BBBg3JJv-eaZA",
  authDomain: "mon-bocadillo-menu.firebaseapp.com",
  projectId: "mon-bocadillo-menu",
  storageBucket: "mon-bocadillo-menu.firebasestorage.app",
  messagingSenderId: "555581310485",
  appId: "1:555581310485:web:a754eb9fcfb9a02c45b01c"
};

const getPasswordStrength = (pass) => {
  if (!pass) return { width: '0%', color: '#ef4444', text: '' };
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  switch (score) {
    case 0:
    case 1:
    case 2: return { width: '20%', color: '#ef4444', text: 'Très faible' };
    case 3: return { width: '40%', color: '#f97316', text: 'Faible' };
    case 4: return { width: '60%', color: '#facc15', text: 'Moyen' };
    case 5: return { width: '80%', color: '#84cc16', text: 'Fort' };
    case 6: return { width: '100%', color: '#22c55e', text: 'Très fort' };
    default: return { width: '0%', color: '#ef4444', text: '' };
  }
};

export default function AdminConfig() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchId, setBranchId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateManager = async (email, password, branchId) => {
    setLoading(true);
    try {
      // 1. Initialiser la Secondary App (ou la récupérer si elle existe déjà)
      const apps = getApps();
      const secondaryApp = apps.find(app => app.name === "SecondaryApp") 
        ? getApp("SecondaryApp") 
        : initializeApp(firebaseConfig, "SecondaryApp");
        
      // Récupérer l'Auth rattachée UNIQUEMENT à cette Secondary App
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Créer le compte utilisateur (Ceci ne déconnectera pas l'Admin principal)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = userCredential.user.uid;

      // 3. Déconnecter IMMÉDIATEMENT la session de la Secondary App
      await signOut(secondaryAuth);

      // 4. Enregistrer les rôles dans Firestore en utilisant l'instance PRINCIPALE (db)
      // IMPORTANT : On ne stocke AUCUN mot de passe ici !
      const profileRef = doc(db, 'artifacts', appId, 'users', newUid, 'profile', 'data');
      await setDoc(profileRef, {
        isManager: true,
        managerBranchId: branchId,
        isRegistered: true,
        email: email // Facultatif, mais pratique pour l'admin
      }, { merge: true });

      alert('Compte Manager créé et sécurisé avec succès !');
    } catch (error) {
      console.error("Erreur lors de la création du compte :", error);
      alert("Erreur: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleCreateManager(email, password, branchId);
  };

  const strength = getPasswordStrength(password);

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h2>Créer un compte Manager</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '5px', fontWeight: '500' }}>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '5px', fontWeight: '500' }}>ID Succursale (Branch ID)</label>
          <input 
            type="text" 
            value={branchId} 
            onChange={(e) => setBranchId(e.target.value)} 
            required
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '5px', fontWeight: '500' }}>Mot de passe</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
              title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              )}
            </button>
          </div>
          {password && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flexGrow: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: strength.width, height: '100%', backgroundColor: strength.color, transition: 'all 0.3s' }}></div>
              </div>
              <span style={{ fontSize: '0.8rem', color: strength.color }}>{strength.text}</span>
            </div>
          )}
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}
        >
          {loading ? 'Création en cours...' : 'Créer le Manager'}
        </button>
      </form>
    </div>
  );
}