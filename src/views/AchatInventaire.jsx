import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, Trash2, FileText, CheckCircle, X, Loader2, DollarSign, Calendar, RefreshCcw, LayoutDashboard, Search, Package } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const KNOWN_PRODUCTS = [
    "Tomate", "Oignon", "Carotte", "Laitue", "Pomme de terre", "Orange", "Viande Hachée", "Saucisse", "Poulet", "Bœuf", "Foie", "Nuggets", "Mayonnaise", "Frite", "Oeuf", "Ketchup 2kg", "Moutarde", "Thon", "Huile Friteuse", "Olive", "Harissa", "Lanchon", "Fromage Carré", "Epices", "Baguette", "Soda 25cl", "Soda 1 litre", "Eau 50cl", "Eau 1l",
    "Gant", "Sachet Frite", "Sachet Sandwiche Vergé", "Sachet Plastique", "Sachet Tissu", "Sac Kraft", "Paille", "Fourchette en plastique", "Papier Plateaux", "Papier Glacé", "Papier Thermique", "Papier Mouchoire", "Pots Sauce", "Papier Film", "Barquette Salade", "Gobelet",
    "Transport", "Gazole", "Électricité", "Bouteille de gaz", "Internet", "Réparation", "Petit matériel",
    "Javel", "Oni", "Torchon", "Sac Poubelle", "Sanicroi", "Ajax", "Allo", "Jixe", "Graffeuse",
    "Gardien", "Assurance Moto", "Traitementet Caffare", "Autre", "Offert",
    "Hafid Mb3", "Imade Mb3", "Noura Mb3", "Youssef Mb3", "Nouveau Employée",
    "Azizia Mb2", "Yassin Mb2", "Fatiha Mb2", "Zoubida Mb2", "Fatima Mb2", "Khadija Mb2", "Khaoula Mb2", "khadija lhouti Mb2", "Hassan Mb2",
    "Hicham Mb1", "Otmane Mb1", "Younesse Mb1", "Soad Matin Mb1", "Soad Soir Mb1", "Aymane Livreur MB1"
];

const PRODUCT_CATEGORIES = {
    "Tomate": "Fruit Et legume", "Oignon": "Fruit Et legume", "Carotte": "Fruit Et legume", "Laitue": "Fruit Et legume", "Pomme de terre": "Fruit Et legume", "Orange": "Fruit Et legume",
    "Viande Hachée": "Boucherie", "Saucisse": "Boucherie", "Poulet": "Boucherie", "Bœuf": "Boucherie", "Foie": "Boucherie", "Nuggets": "Boucherie",
    "Mayonnaise": "Sauce", "Frite": "frite",
    "Oeuf": "matiere premier", "Ketchup 2kg": "matiere premier", "Moutarde": "matiere premier", "Thon": "matiere premier", "Huile Friteuse": "matiere premier", "Olive": "matiere premier", "Harissa": "matiere premier", "Lanchon": "matiere premier", "Fromage Carré": "matiere premier", "Epices": "matiere premier",
    "Baguette": "Boulangerie",
    "Soda 25cl": "Boisson", "Soda 1 litre": "Boisson", "Eau 50cl": "Boisson", "Eau 1l": "Boisson",
    "Gant": "Emballage", "Sachet Frite": "Emballage", "Sachet Sandwiche Vergé": "Emballage", "Sachet Plastique": "Emballage", "Sachet Tissu": "Emballage", "Sac Kraft": "Emballage", "Paille": "Emballage", "Fourchette en plastique": "Emballage", "Papier Plateaux": "Emballage", "Papier Glacé": "Emballage", "Papier Thermique": "Emballage", "Papier Mouchoire": "Emballage", "Pots Sauce": "Emballage", "Papier Film": "Emballage", "Barquette Salade": "Emballage", "Gobelet": "Emballage", "Graffeuse": "Emballage",
    "Transport": "transport",
    "Gazole": "energie", "Électricité": "energie", "Bouteille de gaz": "energie", "Internet": "energie", "Gardien": "energie", "Assurance Moto": "energie",
    "Réparation": "reparation",
    "Petit matériel": "Materiel",
    "Hafid Mb3": "avance sur salaire", "Imade Mb3": "avance sur salaire", "Noura Mb3": "avance sur salaire", "Youssef Mb3": "avance sur salaire", "Nouveau Employée": "avance sur salaire",
    "Javel": "entretien", "Oni": "entretien", "Torchon": "entretien", "Sac Poubelle": "entretien", "Sanicroi": "entretien", "Ajax": "entretien", "Allo": "entretien", "Jixe": "entretien",
    "Autre": "Divere", "Traitementet Caffare": "Divere",
    "Azizia Mb2": "Personnels", "Yassin Mb2": "Personnels", "Fatiha Mb2": "Personnels", "Zoubida Mb2": "Personnels", "Fatima Mb2": "Personnels", "Khadija Mb2": "Personnels", "Khaoula Mb2": "Personnels", "khadija lhouti Mb2": "Personnels", "Hassan Mb2": "Personnels", "Hicham Mb1": "Personnels", "Otmane Mb1": "Personnels", "Younesse Mb1": "Personnels", "Soad Matin Mb1": "Personnels", "Soad Soir Mb1": "Personnels", "Aymane Livreur MB1": "Personnels",
    "Offert": "Offert"
};

const ProductAutocomplete = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearch(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredProducts = KNOWN_PRODUCTS.filter(p => p.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={wrapperRef} className="relative flex-1 w-full">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    className="bg-white border border-gray-200 pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none w-full focus:border-blue-500 shadow-sm transition-all" 
                    placeholder="Chercher un produit..." 
                    value={search} 
                    onChange={e => {
                        setSearch(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-56 overflow-y-auto transform origin-top animate-in fade-in zoom-in-95">
                    {filteredProducts.length === 0 ? (
                        <div className="p-4 text-xs text-gray-400 text-center flex flex-col items-center gap-2">
                            <Package size={20} className="opacity-50"/>
                            Aucun produit trouvé
                        </div>
                    ) : (
                        filteredProducts.map(p => (
                            <div 
                                key={p} 
                                className="p-3 text-sm font-bold text-gray-700 border-b border-gray-50 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors flex items-center gap-2"
                                onClick={() => {
                                    onChange(p);
                                    setSearch(p);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                                {p}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default function AchatInventaire({ db, appId, profile, brand, showNotify }) {
    const [achats, setAchats] = useState([]);
    const [pendingScans, setPendingScans] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [viewAchat, setViewAchat] = useState(null);
    const [formData, setFormData] = useState({
        id: null,
        scanId: null,
        date: new Date().toISOString().split('T')[0],
        fournisseur: '',
        total: 0,
        items: [],
        note: ''
    });
    
    const fileInputRef = useRef(null);
    const urlParams = new URLSearchParams(window.location.search) || new URLSearchParams(window.location.hash.split('?')[1]);
    const branchId = profile?.managerBranchId || urlParams.get('branch') || 'laymoune';

    useEffect(() => {
        if (!db || !appId || !branchId) return;
        
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'achats'),
            where('branchId', '==', branchId)
        );

        const unsub = onSnapshot(q, (snap) => {
            let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => {
                const tA = a.createdAt?.seconds || 0;
                const tB = b.createdAt?.seconds || 0;
                return tB - tA;
            });
            setAchats(data);
        }, (error) => {
            console.error("Erreur chargement achats:", error);
        });

        return () => unsub();
    }, [db, appId, branchId]);

    const handleScanImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const scanId = Math.random().toString(36).substring(2, 9);
        const objectUrl = URL.createObjectURL(file);

        setPendingScans(prev => [{ id: scanId, url: objectUrl, status: 'processing', data: null, error: null }, ...prev]);
        
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        showNotify("Scan ajouté à la file d'attente 📸", "info");

        try {
            const img = new Image();
            img.src = objectUrl;
            
            img.onload = async () => {
                const MAX_SIZE = 1800; // Augmenté pour mieux lire l'écriture manuscrite
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = Math.round(height * (MAX_SIZE / width));
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width = Math.round(width * (MAX_SIZE / height));
                        height = MAX_SIZE;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64String = canvas.toDataURL('image/jpeg', 0.92); // Meilleure qualité pour éviter le flou
                const base64Data = base64String.split(',')[1] || base64String;

                try {
                    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
                    
                    // Apprentissage à partir de l'historique (Corrections de l'utilisateur)
                    const supplierHabitsMap = {};
                    [...achats].forEach(achat => {
                        if (!achat.fournisseur || !achat.items) return;
                        const fName = achat.fournisseur.trim().toUpperCase();
                        if (!supplierHabitsMap[fName]) supplierHabitsMap[fName] = new Set();
                        achat.items.forEach(item => {
                            if (item.name && supplierHabitsMap[fName].size < 12) supplierHabitsMap[fName].add(item.name);
                        });
                    });
                    
                    let habitsText = "";
                    Object.keys(supplierHabitsMap).slice(0, 25).forEach(f => {
                        const products = Array.from(supplierHabitsMap[f]).join(", ");
                        if (products) habitsText += `- Chez "${f}": ${products}\n`;
                    });
                    
                    const prompt = `Extrais les informations de cette facture ou reçu en Dirham (DH). 
                    ATTENTION: Ce reçu est souvent ÉCRIT À LA MAIN avec une écriture brouillonne et difficile à lire. Prends ton temps pour déchiffrer les lettres.
                    Retourne UNIQUEMENT un objet JSON avec cette structure:
                    {
                        "fournisseur": "Nom du magasin, du fournisseur, ou le nom de l'employé",
                        "date": "YYYY-MM-DD",
                        "total": 150.50,
                        "items": [
                            {"name": "Produit", "qty": 2, "price": 50, "total": 100}
                        ]
                    }
                    
                    RÈGLES TRÈS IMPORTANTES :
                    1. APPRENTISSAGE: L'utilisateur a corrigé tes erreurs dans le passé. Voici l'historique EXACT des produits que ce restaurant achète chez chaque fournisseur. Si tu reconnais le nom d'un de ces fournisseurs sur la photo, tu DOIS te baser sur cette liste pour deviner les mots mal écrits (ex: si l'écriture ressemble à "pout" chez le fournisseur "Boucherie X" qui vend du "Poulet", choisis obligatoirement "Poulet") :
                    ${habitsText}

                    2. Fais de ton mieux pour déchiffrer l'écriture manuscrite. Utilise le contexte (le prix, le type de restaurant, et l'historique ci-dessus) pour deviner le mot.
                    3. Même si les noms des produits sur la facture sont écrits en Arabe (ou en darija marocaine), tu dois les traduire et les faire correspondre EXACTEMENT aux noms de la liste officielle en Français.
                    4. Pour le "name" de chaque article (items), tu DOIS OBLIGATOIREMENT le faire correspondre à l'un des produits de cette liste officielle (choisis le plus phonétiquement ou visuellement proche s'il y a une erreur d'orthographe, sinon utilise "Autre"):
                    ${KNOWN_PRODUCTS.join(', ')}.

                    Ne mets pas de \`\`\`json ou autre texte, retourne juste l'objet JSON propre.`;

                    const result = await model.generateContent([
                        prompt,
                        { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
                    ]);

                    const responseText = result.response.text();
                    let data;
                    try {
                        let cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const firstBrace = cleanText.indexOf('{');
                        const lastBrace = cleanText.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
                        }
                        data = JSON.parse(cleanText);
                    } catch(e) {
                        throw new Error("Erreur de lecture de la photo.");
                    }

                    if (data && data.items) {
                        const parsedData = {
                            date: data.date || new Date().toISOString().split('T')[0],
                            fournisseur: data.fournisseur || 'Inconnu',
                            total: data.total || data.items.reduce((sum, item) => sum + (item.total || (item.price * (item.qty || 1)) || 0), 0) || 0,
                            items: data.items.map(item => {
                                const qty = item.qty || 1;
                                const totalPrice = item.total || (item.price * qty) || 0;
                                return {
                                    name: item.name || '',
                                    qty: qty,
                                    totalPrice: totalPrice,
                                    unitPrice: Number((totalPrice / qty).toFixed(2))
                                };
                            }),
                            note: 'Extrait par Photo'
                        };
                        
                        // Déduction automatique du fournisseur via la catégorie majoritaire
                        const catCounts = {};
                        parsedData.items.forEach(item => {
                            const cat = PRODUCT_CATEGORIES[item.name];
                            if (cat) {
                                catCounts[cat] = (catCounts[cat] || 0) + 1;
                            }
                        });
                        let maxCat = null;
                        let maxCount = 0;
                        Object.entries(catCounts).forEach(([cat, count]) => {
                            if (count > maxCount) { maxCount = count; maxCat = cat; }
                        });
                        if (maxCat) {
                            parsedData.fournisseur = maxCat;
                        }

                        setPendingScans(prev => prev.map(scan => 
                            scan.id === scanId ? { ...scan, status: 'ready', data: parsedData } : scan
                        ));
                        showNotify("Une facture est prête à être validée ! ✅", "success");
                    } else {
                        throw new Error("Impossible de lire la facture.");
                    }
                } catch (error) {
                    setPendingScans(prev => prev.map(scan => 
                        scan.id === scanId ? { ...scan, status: 'error', error: error.message || "Non reconnue." } : scan
                    ));
                    showNotify(`Erreur: ${error.message || "Non reconnue."}`, "error");
                }
            };
            img.onerror = () => {
                setPendingScans(prev => prev.map(scan => 
                    scan.id === scanId ? { ...scan, status: 'error', error: "Image corrompue" } : scan
                ));
            };
        } catch (err) {
            setPendingScans(prev => prev.map(scan => 
                scan.id === scanId ? { ...scan, status: 'error', error: "Erreur interne" } : scan
            ));
        }
    };

    const handleSaveAchat = async () => {
        if (!formData.fournisseur || formData.total <= 0) {
            return showNotify("Saisissez le fournisseur et le total svp.", "warning");
        }

        // Vérification stricte des doublons
        const isDuplicate = achats.some(a => 
            a.id !== formData.id &&
            a.date === formData.date && 
            a.total === formData.total &&
            a.fournisseur.toLowerCase().trim() === formData.fournisseur.toLowerCase().trim()
        );

        if (isDuplicate) {
            return showNotify("⚠️ Refusé: Cette facture a DÉJÀ été saisie !", "error");
        }

        let finalNote = formData.note || "";
        const calcTotal = formData.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
        if (formData.items.length > 0 && Math.abs(calcTotal - formData.total) > 0.5) {
            const overcharge = formData.total > calcTotal ? `(Facturé ${(formData.total - calcTotal).toFixed(2)} DH en TROP)` : '';
            const errorMsg = `⚠️ Erreur Fournisseur: Total saisi = ${formData.total} DH, Somme réelle = ${calcTotal} DH ${overcharge}`;
            if (!finalNote.includes("Erreur Fournisseur")) {
                finalNote = finalNote ? `${finalNote} | ${errorMsg}` : errorMsg;
            }
        }

        try {
            if (formData.id) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'achats', formData.id), {
                    date: formData.date,
                    fournisseur: formData.fournisseur,
                    total: formData.total,
                    items: formData.items,
                    note: finalNote,
                    updatedAt: serverTimestamp()
                });
                showNotify("Facture modifiée avec succès ! ✅", "success");
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'achats'), {
                    ...formData,
                    note: finalNote,
                    branchId: branchId,
                    userId: profile?.id || 'Inconnu',
                    createdAt: serverTimestamp()
                });
                showNotify("Achat enregistré avec succès ! ✅", "success");
            }

            if (formData.scanId) {
                const scanToRemove = pendingScans.find(s => s.id === formData.scanId);
                if (scanToRemove) URL.revokeObjectURL(scanToRemove.url);
                setPendingScans(prev => prev.filter(s => s.id !== formData.scanId));
            }

            setShowModal(false);
            setFormData({ id: null, scanId: null, date: new Date().toISOString().split('T')[0], fournisseur: '', total: 0, items: [], note: '' });
        } catch (error) {
            console.error("Erreur sauvegarde:", error);
            showNotify("Erreur lors de la sauvegarde.", "error");
        }
    };

    const addItemManually = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { name: '', qty: 1, totalPrice: 0, unitPrice: 0 }]
        }));
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        
        if (field === 'qty' || field === 'totalPrice') {
            const qty = Number(newItems[index].qty) || 1;
            const total = Number(newItems[index].totalPrice) || 0;
            newItems[index].unitPrice = Number((total / qty).toFixed(2));
        }
        
        let newFournisseur = formData.fournisseur;
        if (field === 'name' && value && PRODUCT_CATEGORIES[value]) {
            // Si le champ est vide ou qu'il contient déjà un nom de catégorie, on le met à jour automatiquement
            const isCategoryOrEmpty = !newFournisseur || Object.values(PRODUCT_CATEGORIES).includes(newFournisseur);
            if (isCategoryOrEmpty) {
                newFournisseur = PRODUCT_CATEGORIES[value];
            }
        }
        
        setFormData({ ...formData, items: newItems, fournisseur: newFournisseur });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const calculatedTotal = formData.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    const isTotalWrong = formData.items.length > 0 && Math.abs(calculatedTotal - formData.total) > 0.5;

    const isDuplicateStrict = achats.some(a => 
        a.id !== formData.id &&
        a.date === formData.date && 
        a.total === formData.total &&
        a.fournisseur.toLowerCase().trim() === formData.fournisseur.toLowerCase().trim() &&
        formData.total > 0
    );

    return (
        <div className="p-3 md:p-8 space-y-6 max-w-6xl mx-auto pb-24 md:pb-12 bg-gray-50/30 min-h-screen">
            {/* EN-TÊTE PREMIUM */}
            <div className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white transform -rotate-3 transition-transform hover:rotate-0">
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Achats & Inventaire</h2>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Gestion des factures</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => { setFormData({ id: null, scanId: null, date: new Date().toISOString().split('T')[0], fournisseur: '', total: 0, items: [], note: '' }); setShowModal(true); }}
                        className="w-full md:w-auto bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3.5 rounded-2xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={18}/> Saisie Manuelle
                    </button>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full md:w-auto relative group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                        <Camera size={18} className="relative z-10"/> 
                        <span className="relative z-10">Scanner Factures</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleScanImage} 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                    />
                </div>
            </div>

            {/* FILE D'ATTENTE DES SCANS */}
            {pendingScans.length > 0 && (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-blue-100 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                        <RefreshCcw size={18} className="text-blue-500 animate-spin-slow"/> Factures en cours ({pendingScans.length})
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                        {pendingScans.map(scan => (
                            <div key={scan.id} className={`shrink-0 w-64 rounded-2xl border-2 p-3 flex flex-col gap-3 relative shadow-sm transition-all snap-start ${scan.status === 'ready' ? 'border-green-400 bg-green-50/30' : scan.status === 'error' ? 'border-red-300 bg-red-50/30' : 'border-blue-200 bg-blue-50/30 hover:border-blue-300'}`}>
                                <div className="h-32 w-full bg-gray-100 rounded-xl overflow-hidden relative shadow-inner">
                                    <img src={scan.url} alt="Scan preview" className="w-full h-full object-cover mix-blend-multiply opacity-80" />
                                    {scan.status === 'processing' && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                                            <Loader2 size={28} className="text-blue-600 animate-spin"/>
                                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest bg-white/80 px-2 py-1 rounded-md">Analyse...</span>
                                        </div>
                                    )}
                                </div>
                                
                                {scan.status === 'ready' && (
                                    <button onClick={() => {
                                        setFormData({ ...scan.data, id: null, scanId: scan.id });
                                        setShowModal(true);
                                    }} className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-2.5 rounded-xl text-sm shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2 active:scale-95">
                                        <CheckCircle size={16}/> Valider ({scan.data?.total} DH)
                                    </button>
                                )}
                                
                                {scan.status === 'error' && (
                                    <div className="flex flex-col gap-2">
                                        <div className="bg-red-100 text-red-700 px-2 py-1.5 rounded-lg text-xs font-bold text-center">
                                            {scan.error}
                                        </div>
                                        <button onClick={() => {
                                            URL.revokeObjectURL(scan.url);
                                            setPendingScans(prev => prev.filter(s => s.id !== scan.id));
                                        }} className="w-full bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs transition-colors">Retirer</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORIQUE DES ACHATS */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="font-black text-gray-800 text-base uppercase tracking-widest">Historique récent</h3>
                </div>
                
                {/* VUE DESKTOP */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] uppercase tracking-widest text-gray-500">
                                <th className="px-6 py-5 font-black border-b border-gray-100">Date</th>
                                <th className="px-6 py-5 font-black border-b border-gray-100">Fournisseur</th>
                                <th className="px-6 py-5 font-black border-b border-gray-100 text-center">Articles</th>
                                <th className="px-6 py-5 font-black border-b border-gray-100 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {achats.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                            <FileText size={32} className="text-gray-300"/>
                                        </div>
                                        <p className="font-bold text-gray-400 text-lg">Aucun achat enregistré</p>
                                    </td>
                                </tr>
                            ) : achats.map((achat) => (
                                <tr key={achat.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer group" onClick={() => setViewAchat(achat)}>
                                    <td className="px-6 py-5">
                                        <span className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600 font-bold text-xs group-hover:bg-white border border-transparent group-hover:border-gray-200 transition-all">
                                            <Calendar size={14} className="text-blue-500"/>
                                            {achat.date ? achat.date.split('-').reverse().join('/') : 'Date inconnue'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-black text-gray-800 text-base">{achat.fournisseur}</td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[2rem] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">
                                            {achat.items?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className="font-black text-lg text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                            {achat.total} <span className="text-xs">DH</span>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* VUE MOBILE */}
                <div className="md:hidden flex flex-col gap-4 p-4 bg-gray-50/30">
                    {achats.length === 0 ? (
                        <div className="py-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <FileText size={24} className="text-gray-300"/>
                            </div>
                            <p className="font-bold text-gray-400 text-sm">Aucun achat enregistré</p>
                        </div>
                    ) : achats.map((achat) => (
                        <div key={achat.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 relative cursor-pointer active:scale-95 transition-transform" onClick={() => setViewAchat(achat)}>
                            <div className="flex justify-between items-start gap-4">
                                <span className="font-black text-gray-900 text-base leading-tight">{achat.fournisseur}</span>
                                <span className="font-black text-gray-900 text-lg whitespace-nowrap bg-gray-50 px-3 py-1 rounded-xl border border-gray-100">{achat.total} <span className="text-xs">DH</span></span>
                            </div>
                            <div className="flex justify-between items-center mt-2 border-t border-gray-50 pt-3">
                                <span className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                                    <Calendar size={14} className="text-blue-500"/>
                                    {achat.date ? achat.date.split('-').reverse().join('/') : 'Inconnue'}
                                </span>
                                <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    {achat.items?.length || 0} articles
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAL DE SAISIE PREMIUM */}
            {showModal && (
                <div className="fixed inset-0 z-[200] bg-gray-900/40 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-in fade-in" onClick={() => setShowModal(false)}>
                    <div className="bg-gray-50 rounded-t-[2rem] md:rounded-[2rem] w-full max-w-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 h-[92vh] md:h-auto md:max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        
                        {/* Header Modal */}
                        <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center shrink-0 shadow-sm relative z-10">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <FileText size={20} />
                                </div>
                                {formData.scanId ? "Validation Facture" : "Nouvelle Saisie"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
                        </div>
                        
                        {/* Body Modal */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar relative">
                            
                            {/* Bloc Informations Générales */}
                            {isDuplicateStrict && (
                                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl shadow-sm animate-pulse">
                                    <h3 className="font-black text-red-700 uppercase tracking-widest text-xs flex items-center gap-2 mb-1">
                                        ⚠️ Facture en double détectée
                                    </h3>
                                    <p className="text-sm font-bold text-red-600">
                                        Une facture identique (même fournisseur, date et total) a déjà été enregistrée. L'enregistrement est bloqué pour éviter les doublons.
                                    </p>
                                </div>
                            )}
                            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Informations Principales</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Fournisseur</label>
                                        <input type="text" className="w-full bg-gray-50 border border-gray-200 p-3.5 rounded-2xl font-black text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={formData.fournisseur} onChange={e => setFormData({...formData, fournisseur: e.target.value})} placeholder="Nom du magasin..." />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Date d'achat</label>
                                        <div className="relative">
                                            <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"/>
                                            <input type="date" className="w-full bg-gray-50 border border-gray-200 pl-11 pr-4 py-3.5 rounded-2xl font-black text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bloc Articles */}
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[40vh] md:h-[300px]">
                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Liste des articles</h3>
                                    <button onClick={addItemManually} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-1.5 shadow-sm">
                                        <Plus size={14}/> Ajouter ligne
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 custom-scrollbar">
                                    {formData.items.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                            <Package size={32} className="mb-2"/>
                                            <p className="text-sm font-bold">Ajoutez des articles</p>
                                        </div>
                                    )}
                                    {formData.items.map((item, index) => {
                                        const category = PRODUCT_CATEGORIES[item.name] || 'Non classé';
                                        return (
                                            <div key={index} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all relative flex flex-col gap-4">
                                                <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm">{index + 1}</div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">{category}</span>
                                                    </div>
                                                    <button onClick={() => removeItem(index)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                                    <div className="md:col-span-6 relative">
                                                        <span className="absolute -top-2.5 left-3 bg-white px-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest z-10">Produit</span>
                                                        <div className="border-2 border-gray-100 rounded-xl bg-gray-50/30 relative">
                                                            <ProductAutocomplete value={item.name} onChange={val => updateItem(index, 'name', val)} />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="md:col-span-3 relative">
                                                        <span className="absolute -top-2.5 left-3 bg-white px-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest z-10">Quantité</span>
                                                        <input type="number" className="w-full bg-gray-50 p-3.5 rounded-xl border-2 border-gray-100 text-base font-black text-gray-900 outline-none focus:border-blue-500 focus:bg-white text-center transition-colors" value={item.qty} onChange={e => updateItem(index, 'qty', Number(e.target.value))} />
                                                    </div>
                                                    
                                                    <div className="md:col-span-3 relative">
                                                        <span className="absolute -top-2.5 left-3 bg-blue-50 px-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest z-10 rounded-md">Prix Total (DH)</span>
                                                        <input type="number" className="w-full bg-blue-50/50 p-3.5 rounded-xl border-2 border-blue-100 text-base font-black text-blue-900 outline-none focus:border-blue-500 focus:bg-white text-center transition-colors" value={item.totalPrice} onChange={e => updateItem(index, 'totalPrice', Number(e.target.value))} />
                                                        {item.qty > 1 && (
                                                            <div className="absolute -bottom-5 left-0 w-full text-[10px] font-bold text-gray-400 text-center">{item.unitPrice} DH / unité</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bloc Total & Note */}
                            <div className="flex flex-col-reverse md:flex-row gap-5">
                                <div className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2 ml-1">Commentaire interne</label>
                                    <textarea className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl font-bold text-gray-700 outline-none focus:border-blue-500 resize-none h-[100px]" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Note, remarque sur la facture..."></textarea>
                                </div>
                                
                                <div className="md:w-72 bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-3xl shadow-xl border border-gray-700 relative overflow-hidden flex flex-col justify-center">
                                    <div className="absolute -right-6 -top-6 text-white/5 rotate-12"><DollarSign size={120}/></div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-2 relative z-10 text-center">Montant Final (DH)</label>
                                    <div className="relative z-10">
                                        <input type="number" className="w-full bg-black/30 border border-gray-600 py-3 rounded-2xl font-black text-3xl text-white outline-none focus:border-blue-500 text-center" value={formData.total} onChange={e => setFormData({...formData, total: Number(e.target.value)})} />
                                    </div>
                                    
                                    {isTotalWrong && (
                                        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-center relative z-10 animate-pulse backdrop-blur-md">
                                            {formData.total > calculatedTotal ? (
                                                <>
                                                    <span className="text-[10px] font-black text-red-300 uppercase tracking-widest block">⚠️ Surfacturation</span>
                                                    <span className="text-xs font-bold text-white block mt-1">+ {(formData.total - calculatedTotal).toFixed(2)} DH en trop</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] font-black text-red-300 uppercase tracking-widest block">⚠️ Erreur de somme</span>
                                                    <span className="text-xs font-bold text-white block mt-1">Le vrai total est {calculatedTotal} DH</span>
                                                </>
                                            )}
                                            <button onClick={() => setFormData({...formData, total: calculatedTotal})} className="mt-3 w-full bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors">Corriger</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 md:p-6 bg-white border-t border-gray-100 flex gap-4 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
                            <button onClick={() => setShowModal(false)} className="w-1/3 py-4 font-black text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">Annuler</button>
                            <button onClick={handleSaveAchat} className="w-2/3 py-4 font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg">
                                <CheckCircle size={22}/> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VIEW (Lecture Seule) */}
            {viewAchat && (
                <div className="fixed inset-0 z-[200] bg-gray-900/40 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-in fade-in" onClick={() => setViewAchat(null)}>
                    <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center">
                                    <FileText size={20} />
                                </div>
                                Facture du {viewAchat.date ? viewAchat.date.split('-').reverse().join('/') : 'Inconnue'}
                            </h2>
                            <div className="flex items-center gap-3">
                                <button onClick={() => {
                                    setFormData({
                                        id: viewAchat.id,
                                        scanId: null,
                                        date: viewAchat.date || (viewAchat.createdAt?.seconds ? new Date(viewAchat.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                                        fournisseur: viewAchat.fournisseur,
                                        total: viewAchat.total,
                                        items: viewAchat.items || [],
                                        note: viewAchat.note || ''
                                    });
                                    setViewAchat(null);
                                    setShowModal(true);
                                }} className="px-5 py-2.5 bg-yellow-100 text-yellow-700 font-black rounded-xl hover:bg-yellow-200 text-xs uppercase tracking-widest shadow-sm transition-colors">Modifier</button>
                                <button onClick={() => setViewAchat(null)} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Fournisseur</span>
                                    <span className="font-black text-gray-900 text-lg">{viewAchat.fournisseur}</span>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Total Payé</span>
                                    <span className="font-black text-blue-700 text-2xl">{viewAchat.total} <span className="text-sm">DH</span></span>
                                </div>
                            </div>

                            {viewAchat.note && (
                                <div className="bg-yellow-50/50 border border-yellow-100 p-4 rounded-2xl">
                                    <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest block mb-1">Note / Alerte</span>
                                    <p className="text-sm font-bold text-gray-700">{viewAchat.note}</p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Articles ({viewAchat.items?.length || 0})</h3>
                                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-2 space-y-1">
                                    {(!viewAchat.items || viewAchat.items.length === 0) && <p className="text-xs text-gray-500 text-center py-6">Aucun article enregistré.</p>}
                                    {viewAchat.items?.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-50">
                                            <div>
                                                <span className="font-bold text-gray-900 block">{item.name}</span>
                                                <span className="text-xs font-bold text-gray-500">{item.qty} × {item.unitPrice} DH</span>
                                            </div>
                                            <span className="font-black text-gray-900">{item.totalPrice} DH</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}