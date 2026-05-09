import React, { useState, useEffect, useRef } from 'react';
import { Utensils, Trash2, Image, Tag, AlignLeft, Settings2, Plus, Edit3, Copy, Check, X, Save, DollarSign, Layers, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { PREDEFINED_INGREDIENTS, PREDEFINED_EXTRAS, PREDEFINED_DRINKS } from '../../config/constants';

export default function AdminMenuEditor({
    editableMenu, setEditableMenu,
    activeEditZone,
    settings, saveSettings, showNotify
}) {
    const [editingItem, setEditingItem] = useState(null);
    const [customPrompt, setCustomPrompt] = useState({ show: false });
    const [promptInput, setPromptInput] = useState({ name: '', price: '' });
    const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null });

    // 🔥 Logique dyal Drag & Drop w Tartib
    const dragItem = useRef();
    const dragOverItem = useRef();

    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
        const copyMenu = [...(editableMenu || [])];
        const dragItemContent = copyMenu[dragItem.current];
        copyMenu.splice(dragItem.current, 1);
        copyMenu.splice(dragOverItem.current, 0, dragItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setEditableMenu(copyMenu);
    };

    const moveItem = (index, direction) => {
        const copyMenu = [...(editableMenu || [])];
        if (index + direction < 0 || index + direction >= copyMenu.length) return;
        const item = copyMenu[index];
        copyMenu.splice(index, 1);
        copyMenu.splice(index + direction, 0, item);
        setEditableMenu(copyMenu);
    };

    // 🔥 Interaction m3a l'Preview: mnin t-cliki 3la l'phone, kay7el lik l'formulaire auto!
    useEffect(() => {
        if (activeEditZone && activeEditZone.startsWith('menuItem_')) {
            const itemId = activeEditZone.replace('menuItem_', '');
            const item = (editableMenu || []).find(i => i.id === itemId);
            if (item && (!editingItem || editingItem.id !== itemId)) {
                setEditingItem({ ...item, isNew: false });
                setTimeout(() => {
                    document.getElementById('section-menu')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }, [activeEditZone]);

    const handleAdd = () => {
        setEditingItem({ id: 'new_'+Date.now(), name: '', price: '', category: '', img: '🍔', desc: '', removableIngredients: '', choices: '', maxOptions: 0, isNew: true, outOfStock: false, hasVariations: false, variations: [], station: '' });
    };

    const handleEdit = (item) => {
        setEditingItem({ ...item, isNew: false });
    };

    const handleDelete = (id) => {
        setConfirmDialog({
            show: true,
            title: "Supprimer le produit",
            message: "Wach met2ked bghiti tsprimi had l-produit ?",
            onConfirm: () => {
                setEditableMenu((editableMenu || []).filter(i => i.id !== id));
            }
        });
    };

    const handleDuplicate = (item) => {
        const newItem = { ...item, id: 'new_'+Date.now(), name: item.name + ' (Copie)' };
        setEditableMenu([newItem, ...(editableMenu || [])]);
    };

    // 🔥 Ingrédients et Choix Globaux (depuis Settings)
    const globalIngredients = settings?.globalIngredients !== undefined ? settings.globalIngredients : PREDEFINED_INGREDIENTS;
    const globalChoices = settings?.globalChoices || [];
    const globalExtras = settings?.globalExtras !== undefined ? settings.globalExtras : PREDEFINED_EXTRAS;
    const globalDrinks = settings?.globalDrinks !== undefined ? settings.globalDrinks : PREDEFINED_DRINKS;

    const handleAddGlobalIngredient = () => {
        setPromptInput({ name: '', price: '' });
        setCustomPrompt({
            show: true,
            title: "Ajouter un Favori",
            nameLabel: "Nom de l'ingrédient",
            namePlaceholder: "ex: Oignon, Fromage",
            requirePrice: false,
            onSubmit: (data) => {
                if (data.name && data.name.trim()) {
                    const newArr = [...globalIngredients, data.name.trim()];
                    saveSettings({ ...settings, globalIngredients: newArr });
                    showNotify("Ingrédient ajouté aux options globales ✅", "success");
                }
            }
        });
    };

    const handleAddGlobalChoice = () => {
        setPromptInput({ name: '', price: '' });
        setCustomPrompt({
            show: true,
            title: "Ajouter un Favori",
            nameLabel: "Nom du choix",
            namePlaceholder: "ex: Coca, Frites",
            requirePrice: false,
            onSubmit: (data) => {
                if (data.name && data.name.trim()) {
                    const newArr = [...globalChoices, data.name.trim()];
                    saveSettings({ ...settings, globalChoices: newArr });
                    showNotify("Choix ajouté aux options globales ✅", "success");
                }
            }
        });
    };

    const handleAddGlobalExtra = () => {
        setPromptInput({ name: '', price: '5' });
        setCustomPrompt({
            show: true,
            title: "Ajouter un Supplément",
            nameLabel: "Nom du supplément 'Avec'",
            namePlaceholder: "ex: Fromage, Frites",
            requirePrice: true,
            priceLabel: "Prix (en DH)",
            pricePlaceholder: "ex: 5",
            onSubmit: (data) => {
                if (data.name && data.name.trim() && data.price && !isNaN(data.price)) {
                    const newArr = [...(settings?.globalExtras || []), { name: data.name.trim(), price: Number(data.price) }];
                    saveSettings({ ...settings, globalExtras: newArr });
                    showNotify("Supplément ajouté aux options globales ✅", "success");
                }
            }
        });
    };

    const handleAddGlobalDrink = () => {
        setPromptInput({ name: '', price: '10' });
        setCustomPrompt({
            show: true,
            title: "Ajouter une Boisson",
            nameLabel: "Nom de la boisson",
            namePlaceholder: "ex: 🥤 Coca Cola",
            requirePrice: true,
            priceLabel: "Prix (en DH)",
            pricePlaceholder: "ex: 10",
            onSubmit: (data) => {
                if (data.name && data.name.trim() && data.price && !isNaN(data.price)) {
                    const newArr = [...globalDrinks, { name: data.name.trim(), price: Number(data.price) }];
                    saveSettings({ ...settings, globalDrinks: newArr });
                    showNotify("Boisson ajoutée aux options globales ✅", "success");
                }
            }
        });
    };

    const handleSave = () => {
        if (!editingItem.name) return alert("Le nom est obligatoire!");
        
        const { isNew, ...itemToSave } = editingItem;
        itemToSave.price = Number(itemToSave.price) || 0;
        itemToSave.maxOptions = Number(itemToSave.maxOptions) || 0;

        if (isNew) {
            setEditableMenu([itemToSave, ...(editableMenu || [])]);
        } else {
            setEditableMenu((editableMenu || []).map(i => i.id === itemToSave.id ? itemToSave : i));
        }
        setEditingItem(null);
    };

    return (
        <div id="section-menu" className="animate-in fade-in pb-12">
            {!editingItem ? (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Utensils size={20} className="text-blue-500"/> Gestion du Menu</h3>
                            <p className="text-sm text-gray-500 mt-1">Gérez vos plats, prix et disponibilités.</p>
                        </div>
                        <button onClick={handleAdd} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                            <Plus size={16}/> Ajouter un Plat
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <th className="px-4 py-4 w-12 text-center"></th>
                                        <th className="px-6 py-4">Produit</th>
                                        <th className="px-6 py-4">Catégorie</th>
                                        <th className="px-6 py-4">Prix</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {(editableMenu || []).map((item, index) => (
                                        <tr key={item.id} id={`edit-item-${item.id}`} 
                                            draggable
                                            onDragStart={(e) => dragItem.current = index}
                                            onDragEnter={(e) => dragOverItem.current = index}
                                            onDragEnd={handleDrop}
                                            onDragOver={(e) => e.preventDefault()}
                                            className={`group hover:bg-gray-50/50 transition-colors ${activeEditZone === 'menuItem_' + item.id ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-4 py-4 text-center cursor-move text-gray-300 hover:text-gray-500 transition-colors" title="Glisser pour déplacer">
                                                <GripVertical size={18} className="mx-auto" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 shrink-0 bg-gray-50 rounded-xl flex items-center justify-center text-xl overflow-hidden border border-gray-100 shadow-sm">
                                                        {item.img?.startsWith('http') || item.img?.startsWith('data:image') ? <img src={item.img} className="w-full h-full object-cover"/> : item.img}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900">{item.name}</span>
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            {item.outOfStock && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 border border-red-100">Rupture</span>}
                                                            {item.removableIngredients && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-gray-600 bg-gray-100 border border-gray-200"><Settings2 size={10} className="mr-1"/> {item.maxOptions > 0 ? `Max ${item.maxOptions}` : `Options`}</span>}
                                                            {item.hasVariations && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100"><Layers size={10} className="mr-1"/> Tailles</span>}
                                                        {item.choices && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-purple-600 bg-purple-50 border border-purple-100"><Tag size={10} className="mr-1"/> Choix</span>}
                                                        {item.extras && item.extras.length > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-green-600 bg-green-50 border border-green-100"><Plus size={10} className="mr-1"/> Suppléments</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">{item.category || '---'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-gray-900">{item.price} <span className="text-gray-500 text-xs">DH</span></span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex flex-col pr-2 mr-1 border-r border-gray-200">
                                                        <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors" title="Monter"><ChevronUp size={14}/></button>
                                                        <button onClick={() => moveItem(index, 1)} disabled={index === (editableMenu || []).length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors" title="Descendre"><ChevronDown size={14}/></button>
                                                    </div>
                                                    <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier"><Edit3 size={16}/></button>
                                                    <button onClick={() => handleDuplicate(item)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Dupliquer"><Copy size={16}/></button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!editableMenu || editableMenu.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <Utensils size={32} className="mx-auto text-gray-300 mb-3"/>
                                                <p className="text-sm font-medium text-gray-500">Le menu est vide.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] border border-gray-200 p-6 md:p-10 lg:p-12 animate-in slide-in-from-bottom-4 shadow-2xl w-full">
                    {/* EN-TÊTE FORMULAIRE */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                        <div>
                            <h4 className="font-black text-2xl text-gray-900 flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${editingItem.isNew ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                    {editingItem.isNew ? <Plus size={24} strokeWidth={3}/> : <Edit3 size={24} strokeWidth={3}/>}
                                </div>
                                {editingItem.isNew ? "Ajouter un Nouveau Plat" : "Modifier le Plat"}
                            </h4>
                            <p className="text-sm font-bold text-gray-500 mt-2">Configurez les détails, le prix et les options de personnalisation.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setEditingItem(null)} className="px-6 py-3.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-sm font-black hover:bg-gray-100 transition-colors flex items-center gap-2">
                                <X size={16}/> Annuler
                            </button>
                            <button onClick={handleSave} className={`px-8 py-3.5 text-white rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all flex items-center gap-2 ${editingItem.isNew ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30' : 'bg-green-600 hover:bg-green-700 hover:shadow-green-500/30'}`}>
                                <Save size={18}/> {editingItem.isNew ? "Enregistrer le Plat" : "Sauvegarder"}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
                        {/* 📦 COLONNE GAUCHE : INFO DE BASE */}
                        <div className="space-y-6">
                            
                            {/* BLOCK 1: INFORMATIONS GÉNÉRALES */}
                            <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200">
                                <h5 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Tag size={18} className="text-blue-500"/> Informations de Base</h5>
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Nom du plat <span className="text-red-500">*</span></label>
                                        <input className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Ex: Tacos Mixte" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Catégorie <span className="text-red-500">*</span></label>
                                            <input className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} placeholder="Ex: Tacos" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Cuisine</label>
                                            <select className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-sm appearance-none" value={editingItem.station || ''} onChange={e => setEditingItem({...editingItem, station: e.target.value})}>
                                                <option value="">Auto (Catégorie)</option>
                                                <option value="CHAUD">🔥 Chaud</option>
                                                <option value="FROID">❄️ Froid</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Image (URL, Emoji ou PC)</label>
                                        <div className="flex gap-3 items-center">
                                            <div className="w-16 h-16 shrink-0 bg-white rounded-2xl flex items-center justify-center text-3xl overflow-hidden border-2 border-gray-200 shadow-sm">
                                                {editingItem.img?.startsWith('http') || editingItem.img?.startsWith('data:image') ? <img src={editingItem.img} className="w-full h-full object-cover" alt="preview" /> : editingItem.img || '🍔'}
                                            </div>
                                            <div className="flex-1 flex flex-col gap-2">
                                                <input className="w-full px-5 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm" value={editingItem.img} onChange={e => setEditingItem({...editingItem, img: e.target.value})} placeholder="Lien URL (https://...) ou Emoji (🍔)" />
                                                <label className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors flex items-center justify-center shadow-sm active:scale-95">
                                                    <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            const img = new window.Image();
                                                            img.onload = () => {
                                                                const canvas = document.createElement('canvas');
                                                                const MAX_SIZE = 400; let width = img.width; let height = img.height;
                                                                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
                                                                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                                                                canvas.width = width; canvas.height = height;
                                                                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                                                                setEditingItem({ ...editingItem, img: canvas.toDataURL('image/webp', 0.8) });
                                                            };
                                                            img.src = event.target.result;
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }} />
                                                    <Image size={16} className="mr-2" /> Uploader depuis le PC
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Description & Ingrédients</label>
                                        <textarea rows="3" className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none shadow-sm" value={editingItem.desc || ''} onChange={e => setEditingItem({...editingItem, desc: e.target.value})} placeholder="Viande hachée, frites, sauce fromagère..." />
                                        {globalIngredients.length > 0 && (
                                            <div className="mt-3">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Suggestions :</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {globalIngredients.map(ing => (
                                                        <button 
                                                            key={ing} 
                                                            type="button"
                                                            onClick={() => {
                                                                const current = editingItem.desc || '';
                                                                const sep = current.length > 0 && !current.endsWith(' ') ? ', ' : '';
                                                                setEditingItem({...editingItem, desc: current + sep + ing});
                                                            }}
                                                            className="px-3 py-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 text-gray-600 text-[10px] font-black rounded-lg transition-all shadow-sm"
                                                        >
                                                            + {ing}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BLOCK 2: PRIX & TAILLES */}
                            <div className="bg-emerald-50 p-6 md:p-8 rounded-3xl border border-emerald-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h5 className="font-black text-sm text-emerald-800 uppercase tracking-widest flex items-center gap-2"><DollarSign size={18} className="text-emerald-600"/> Prix & Tailles</h5>
                                    <label className="relative inline-flex items-center cursor-pointer bg-white px-4 py-2 rounded-xl border border-emerald-100 shadow-sm">
                                        <span className="mr-3 text-xs font-black uppercase text-emerald-700">Prix Variables</span>
                                        <div className={`w-11 h-6 rounded-full relative transition-all ${editingItem.hasVariations ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                            <input type="checkbox" className="hidden" checked={editingItem.hasVariations || false} onChange={e => setEditingItem({...editingItem, hasVariations: e.target.checked, variations: editingItem.variations || []})} />
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${editingItem.hasVariations ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                        </div>
                                    </label>
                                </div>
                                
                                {!editingItem.hasVariations ? (
                                    <div>
                                        <label className="block text-xs font-black text-emerald-800 uppercase tracking-wide mb-2">Prix Fixe (DH) <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><DollarSign size={18} className="text-emerald-500"/></div>
                                            <input type="number" className="w-full pl-12 pr-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl text-lg font-black text-emerald-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm placeholder:font-medium" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} placeholder="0.00" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 bg-white/50 p-4 rounded-2xl border border-emerald-100">
                                        {(editingItem.variations || []).map((v, vIdx) => (
                                            <div key={vIdx} className="flex items-center gap-3">
                                                <input className="flex-1 px-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 shadow-sm" placeholder="Taille (ex: L, XL)" value={v.name} onChange={e => { const newV = [...editingItem.variations]; newV[vIdx].name = e.target.value; setEditingItem({...editingItem, variations: newV}); }} />
                                                <div className="relative w-32">
                                                    <input type="number" className="w-full px-4 py-3 bg-white border-2 border-emerald-100 rounded-xl text-sm font-black text-emerald-700 outline-none focus:border-emerald-500 shadow-sm" placeholder="Prix" value={v.price} onChange={e => { const newV = [...editingItem.variations]; newV[vIdx].price = e.target.value; setEditingItem({...editingItem, variations: newV}); }} />
                                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none"><span className="text-xs font-black text-emerald-400">DH</span></div>
                                                </div>
                                                <button onClick={() => { const newV = editingItem.variations.filter((_, i) => i !== vIdx); setEditingItem({...editingItem, variations: newV}); }} className="w-12 h-12 flex items-center justify-center bg-white border-2 border-red-100 text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 rounded-xl transition-colors shadow-sm"><Trash2 size={18}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setEditingItem({...editingItem, variations: [...(editingItem.variations || []), {name: '', price: ''}]})} className="w-full text-xs font-black uppercase tracking-wider text-emerald-600 bg-white border-2 border-emerald-200 border-dashed hover:border-emerald-400 hover:bg-emerald-50 py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"><Plus size={16}/> Ajouter une taille</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ⚙️ COLONNE DROITE : OPTIONS & REGLAGES */}
                        <div className="space-y-6">
                            <div className="bg-purple-50 p-6 md:p-8 rounded-3xl border border-purple-200">
                                <h5 className="font-black text-sm text-purple-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Settings2 size={18} className="text-purple-600"/> Options de Personnalisation</h5>
                                <div className="space-y-6">
                                    {/* 1. Choix / Parfum */}
                                    <div>
                                        <label className="block text-xs font-black text-purple-800 uppercase tracking-wide mb-2">Choix Obligatoires (Parfum, Viande...)</label>
                                        <input 
                                            className="w-full px-5 py-4 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all mb-3 shadow-sm" 
                                            placeholder="Ex: Viande Hachée, Poulet, Mixte (Séparés par virgule)"
                                            value={editingItem.choices || ''} 
                                            onChange={e => setEditingItem({...editingItem, choices: e.target.value})}
                                        />
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Favoris (Cliquez pour ajouter)</span>
                                            <button type="button" onClick={handleAddGlobalChoice} className="text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 bg-purple-100/50 hover:bg-purple-200 px-3 py-1.5 rounded-lg transition-colors">+ Créer Favori</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-purple-100 rounded-xl min-h-[60px] max-h-[150px] overflow-y-auto">
                                            {globalChoices.length === 0 ? (
                                                <span className="text-xs text-gray-400 font-bold my-auto mx-auto italic">Aucun favori enregistré.</span>
                                            ) : (
                                                globalChoices.map(choice => {
                                                    const currentList = editingItem.choices ? editingItem.choices.split(',').map(c=>c.trim()).filter(Boolean) : [];
                                                    const isSelected = currentList.includes(choice);
                                                    return (
                                                        <label key={choice} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-black uppercase ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-300'}`}>
                                                            <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                                let arr = [...currentList];
                                                                if (e.target.checked) arr.push(choice);
                                                                else arr = arr.filter(c => c !== choice);
                                                                setEditingItem({...editingItem, choices: arr.join(', ')});
                                                            }}/>
                                                            {isSelected && <Check size={14} className="text-purple-600"/>}
                                                            {choice}
                                                            <span onClick={(e) => {
                                                                e.preventDefault(); e.stopPropagation();
                                                                setConfirmDialog({
                                                                    show: true,
                                                                    title: "Supprimer Favori",
                                                                    message: `Supprimer le favori "${choice}" ?`,
                                                                    onConfirm: () => {
                                                                        const newArr = globalChoices.filter(c => c !== choice);
                                                                        saveSettings({ ...settings, globalChoices: newArr });
                                                                        if (currentList.includes(choice)) setEditingItem({...editingItem, choices: currentList.filter(c => c !== choice).join(', ')});
                                                                    }
                                                                });
                                                            }} className="text-gray-300 hover:text-red-500 ml-1 transition-colors"><X size={14}/></span>
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Ingrédients à retirer */}
                                    <div>
                                        <label className="block text-xs font-black text-red-800 uppercase tracking-wide mb-2">Garniture à retirer ("Sans ...")</label>
                                        <input 
                                            className="w-full px-5 py-4 bg-white border-2 border-red-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all mb-3 shadow-sm" 
                                            placeholder="Ex: Oignon, Tomate, Olives (Séparés par virgule)"
                                            value={editingItem.removableIngredients || ''} 
                                            onChange={e => setEditingItem({...editingItem, removableIngredients: e.target.value})}
                                        />
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Favoris (Cliquez pour ajouter)</span>
                                            <button type="button" onClick={handleAddGlobalIngredient} className="text-[10px] font-black uppercase text-red-600 hover:text-red-800 bg-red-100/50 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">+ Créer Favori</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-red-100 rounded-xl min-h-[60px] max-h-[150px] overflow-y-auto">
                                            {globalIngredients.length === 0 ? (
                                                <span className="text-xs text-gray-400 font-bold my-auto mx-auto italic">Aucun favori enregistré.</span>
                                            ) : (
                                                globalIngredients.map(ing => {
                                                    const currentList = editingItem.removableIngredients ? editingItem.removableIngredients.split(',').map(c=>c.trim()).filter(Boolean) : [];
                                                    const isSelected = currentList.includes(ing);
                                                    return (
                                                        <label key={ing} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-black uppercase ${isSelected ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-red-300'}`}>
                                                            <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                                let arr = [...currentList];
                                                                if (e.target.checked) arr.push(ing);
                                                                else arr = arr.filter(c => c !== ing);
                                                                setEditingItem({...editingItem, removableIngredients: arr.join(', ')});
                                                            }}/>
                                                            {isSelected && <Check size={14} className="text-red-600"/>}
                                                            Sans {ing}
                                                            <span onClick={(e) => {
                                                                e.preventDefault(); e.stopPropagation();
                                                                setConfirmDialog({
                                                                    show: true,
                                                                    title: "Supprimer Favori",
                                                                    message: `Supprimer le favori "${ing}" ?`,
                                                                    onConfirm: () => {
                                                                        const newArr = globalIngredients.filter(c => c !== ing);
                                                                        saveSettings({ ...settings, globalIngredients: newArr });
                                                                        if (currentList.includes(ing)) setEditingItem({...editingItem, removableIngredients: currentList.filter(c => c !== ing).join(', ')});
                                                                    }
                                                                });
                                                            }} className="text-gray-300 hover:text-red-500 ml-1 transition-colors"><X size={14}/></span>
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Extras */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-black text-emerald-800 uppercase tracking-wide">Extras & Suppléments (+ Prix)</label>
                                            <button type="button" onClick={handleAddGlobalExtra} className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-800 bg-emerald-100/50 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors">+ Créer Favori</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-emerald-100 rounded-xl min-h-[60px] max-h-[150px] overflow-y-auto shadow-inner">
                                        {globalExtras.map((ext, idx) => {
                                            const currentList = editingItem.extras || [];
                                            const isSelected = currentList.some(e => e.name === ext.name);
                                            return (
                                                    <label key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-black uppercase ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-300'}`}>
                                                    <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                        let arr = [...currentList];
                                                        if (e.target.checked) arr.push(ext);
                                                        else arr = arr.filter(c => c.name !== ext.name);
                                                        setEditingItem({...editingItem, extras: arr});
                                                    }}/>
                                                        {isSelected && <Check size={14} className="text-emerald-600"/>}
                                                        Avec {ext.name} <span className="opacity-60 ml-1">(+{ext.price}DH)</span>
                                                <span onClick={(e) => {
                                                            e.preventDefault(); e.stopPropagation();
                                                            setConfirmDialog({
                                                                show: true,
                                                                title: "Supprimer Favori",
                                                                message: `Supprimer le favori "${ext.name}" ?`,
                                                                onConfirm: () => {
                                                                    const newArr = globalExtras.filter(c => c.name !== ext.name);
                                                                    saveSettings({ ...settings, globalExtras: newArr });
                                                                    if (currentList.some(c => c.name === ext.name)) setEditingItem({...editingItem, extras: currentList.filter(c => c.name !== ext.name)});
                                                                }
                                                            });
                                                    }} className="text-gray-300 hover:text-red-500 ml-1 transition-colors"><X size={14}/></span>
                                                </label>
                                            )
                                        })}
                                        </div>
                                    </div>

                                    {/* 4. Boissons */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-black text-blue-800 uppercase tracking-wide">Boissons (+ Prix)</label>
                                            <button type="button" onClick={handleAddGlobalDrink} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 bg-blue-100/50 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors">+ Créer Favori</button>
                                    </div>
                                        <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-blue-100 rounded-xl min-h-[60px] max-h-[150px] overflow-y-auto shadow-inner">
                                        {globalDrinks.map((ext, idx) => {
                                            const currentList = editingItem.extras || [];
                                            const isSelected = currentList.some(e => e.name === ext.name);
                                            return (
                                                    <label key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-xs font-black uppercase ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300'}`}>
                                                    <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                                                        let arr = [...currentList];
                                                        if (e.target.checked) arr.push(ext);
                                                        else arr = arr.filter(c => c.name !== ext.name);
                                                        setEditingItem({...editingItem, extras: arr});
                                                    }}/>
                                                    {isSelected && <Check size={14} className="text-blue-600"/>}
                                                        {ext.name} <span className="opacity-60 ml-1">(+{ext.price}DH)</span>
                                                <span onClick={(e) => {
                                                        e.preventDefault(); e.stopPropagation();
                                                        setConfirmDialog({
                                                            show: true,
                                                            title: "Supprimer Favori",
                                                            message: `Supprimer le favori "${ext.name}" ?`,
                                                            onConfirm: () => {
                                                                const newArr = globalDrinks.filter(c => c.name !== ext.name);
                                                                saveSettings({ ...settings, globalDrinks: newArr });
                                                                if (currentList.some(c => c.name === ext.name)) setEditingItem({...editingItem, extras: currentList.filter(c => c.name !== ext.name)});
                                                            }
                                                        });
                                                    }} className="text-gray-300 hover:text-red-500 ml-1 transition-colors"><X size={14}/></span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-2">Max choix permis (0 = illimité)</label>
                                        <input type="number" min="0" className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all shadow-sm" value={editingItem.maxOptions === undefined ? '' : editingItem.maxOptions} onChange={e => setEditingItem({...editingItem, maxOptions: parseInt(e.target.value) || 0})} />
                                    </div>
                                </div>
                            </div>

                            {/* STOCK Toggles */}
                            <div className="bg-red-50 p-6 rounded-3xl border border-red-200">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex flex-col">
                                        <span className="font-black text-red-800 uppercase tracking-widest text-sm group-hover:text-red-900 transition-colors">Rupture de stock 🚫</span>
                                        <span className="text-xs font-bold text-red-500 mt-1">Désactiver ce plat temporairement</span>
                                    </div>
                                    <div className={`w-14 h-8 rounded-full relative transition-all border-2 shadow-inner ${editingItem.outOfStock ? 'bg-red-500 border-red-600' : 'bg-white border-red-200'}`}>
                                        <input type="checkbox" className="hidden" checked={editingItem.outOfStock || false} onChange={e => setEditingItem({...editingItem, outOfStock: e.target.checked})} />
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${editingItem.outOfStock ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {customPrompt.show && (
                <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border-2 border-blue-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{customPrompt.title}</h3>
                            <button onClick={() => setCustomPrompt({ show: false })} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-2 ml-1">{customPrompt.nameLabel}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" 
                                    placeholder={customPrompt.namePlaceholder}
                                    value={promptInput.name}
                                    onChange={(e) => setPromptInput({ ...promptInput, name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            {customPrompt.requirePrice && (
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-2 ml-1">{customPrompt.priceLabel}</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" 
                                        placeholder={customPrompt.pricePlaceholder}
                                        value={promptInput.price}
                                        onChange={(e) => setPromptInput({ ...promptInput, price: e.target.value })}
                                    />
                                </div>
                            )}
                            <button 
                                onClick={() => {
                                    if (customPrompt.onSubmit) customPrompt.onSubmit(promptInput);
                                    setCustomPrompt({ show: false });
                                }}
                                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-sm"
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDialog.show && (
                <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border-2 border-red-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center border-4 border-red-100 mb-2 shadow-inner">
                                <Trash2 size={36} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">{confirmDialog.title || "Confirmation"}</h3>
                                <p className="text-sm font-bold text-gray-500">{confirmDialog.message}</p>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setConfirmDialog({ show: false })} className="flex-1 py-4 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-black uppercase text-xs transition-colors border border-gray-200 shadow-sm">
                                Annuler
                            </button>
                            <button onClick={() => {
                                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                                setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
                            }} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-colors active:scale-95">
                                Oui, Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}