import React, { useState, useEffect } from 'react';
import { Utensils, Trash2, Image, Tag, AlignLeft, Settings2, Plus, Edit3, Copy, Check, X, Save, DollarSign, Layers } from 'lucide-react';

export default function AdminMenuEditor({
    editableMenu, setEditableMenu,
    activeEditZone
}) {
    const [editingItem, setEditingItem] = useState(null);

    // Had l-message ghayban lik f Console (F12) bach t-t2ked bli version jdida khdama!
    console.log("🔥 Version SaaS dyal Menu Editor t-chargat!");

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
        setEditingItem({ id: 'new_'+Date.now(), name: '', price: '', category: '', img: '🍔', desc: '', removableIngredients: '', isNew: true, outOfStock: false, hasVariations: false, variations: [] });
    };

    const handleEdit = (item) => {
        setEditingItem({ ...item, isNew: false });
    };

    const handleDelete = (id) => {
        if(window.confirm('Wach met2ked bghiti tsprimi had l-produit ?')) {
            setEditableMenu((editableMenu || []).filter(i => i.id !== id));
        }
    };

    const handleDuplicate = (item) => {
        const newItem = { ...item, id: 'new_'+Date.now(), name: item.name + ' (Copie)' };
        setEditableMenu([newItem, ...(editableMenu || [])]);
    };

    const handleSave = () => {
        if (!editingItem.name) return alert("Le nom est obligatoire!");
        
        const { isNew, ...itemToSave } = editingItem;
        itemToSave.price = Number(itemToSave.price) || 0;

        if (isNew) {
            setEditableMenu([itemToSave, ...(editableMenu || [])]);
        } else {
            setEditableMenu((editableMenu || []).map(i => i.id === itemToSave.id ? itemToSave : i));
        }
        setEditingItem(null);
    };

    return (
        <div id="section-menu" className="animate-in fade-in pb-12">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><Utensils size={18} className="text-[#da291c]"/> Gestion du Menu</h3>
                <button onClick={handleAdd} disabled={!!editingItem} className={`px-8 py-4 rounded-2xl text-xs font-black uppercase shadow-xl transition-all flex items-center gap-2 ${editingItem ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800 active:scale-95'}`}><Plus size={18}/> Ajouter Plat</button>
            </div>

            {editingItem && (
                <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden mb-10 relative animate-in fade-in z-10">
                    {/* Header SaaS */}
                    <div className="border-b-2 border-gray-50 px-10 py-8 bg-gray-50/30 flex justify-between items-center">
                        <div>
                            <h4 className="font-black text-2xl uppercase italic text-gray-900 flex items-center gap-3">
                                {editingItem.isNew ? <Plus className="text-blue-500" size={20}/> : <Edit3 className="text-blue-500" size={20}/>}
                                {editingItem.isNew ? "Ajouter un Plat" : "Modifier le Plat"}
                            </h4>
                            <p className="text-xs font-bold text-gray-500 mt-2">Remplissez les informations ci-dessous pour le menu.</p>
                        </div>
                        <button onClick={() => setEditingItem(null)} className="p-3 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full transition-colors shadow-sm"><X size={24}/></button>
                    </div>

                    {/* Corps du Formulaire */}
                    <div className="p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Nom */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><Utensils size={14} className="text-gray-400"/> Nom du plat</label>
                                <input className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="Ex: Bocadillo Tangérois" />
                            </div>
                            {/* Prix */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><DollarSign size={14} className="text-gray-400"/> Prix (DH)</label>
                                <input type="number" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-blue-600 font-black text-lg focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} placeholder="Ex: 29" />
                            </div>
                            
                            {/* Image */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><Image size={14} className="text-gray-400"/> Image (URL ou Emoji)</label>
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 shrink-0 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl overflow-hidden border-2 border-gray-100 shadow-inner">{editingItem.img?.startsWith('http') ? <img src={editingItem.img} className="w-full h-full object-cover" alt="" /> : editingItem.img}</div>
                                    <input className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" value={editingItem.img} onChange={e => setEditingItem({...editingItem, img: e.target.value})} placeholder="🍔 ou https://..." />
                                </div>
                            </div>

                            {/* Catégorie */}
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><Tag size={14} className="text-gray-400"/> Catégorie</label>
                                <input className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} placeholder="Ex: Tacos, Boissons..." />
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-3 md:col-span-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><AlignLeft size={14} className="text-gray-400"/> Description / Ingrédients</label>
                                <textarea rows="3" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner resize-none" value={editingItem.desc || ''} onChange={e => setEditingItem({...editingItem, desc: e.target.value})} placeholder="Ex: Viande hachée, fromage, sauce algérienne..." />
                            </div>

                            {/* Variations / Tailles */}
                            <div className="flex flex-col gap-3 md:col-span-2 mt-4">
                                <div className="flex items-center justify-between bg-white p-5 border-2 border-gray-100 rounded-2xl shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-gray-900 uppercase flex items-center gap-2 mb-1"><Layers size={16} className="text-blue-500"/> Tailles & Variations</span>
                                        <span className="text-[11px] font-bold text-gray-500">Ajouter des tailles (ex: Petit 20DH, Grand 30DH).</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={editingItem.hasVariations || false} onChange={e => setEditingItem({...editingItem, hasVariations: e.target.checked, variations: editingItem.variations || []})} />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                                    </label>
                                </div>

                                {editingItem.hasVariations && (
                                    <div className="p-6 bg-blue-50/50 border-2 border-blue-100 rounded-2xl space-y-4">
                                        {(editingItem.variations || []).map((v, vIdx) => (
                                            <div key={vIdx} className="flex items-center gap-3">
                                                <input className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Nom (ex: Taille L)" value={v.name} onChange={e => { const newV = [...editingItem.variations]; newV[vIdx].name = e.target.value; setEditingItem({...editingItem, variations: newV}); }} />
                                                <input type="number" className="w-28 px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Prix DH" value={v.price} onChange={e => { const newV = [...editingItem.variations]; newV[vIdx].price = e.target.value; setEditingItem({...editingItem, variations: newV}); }} />
                                                <button onClick={() => { const newV = editingItem.variations.filter((_, i) => i !== vIdx); setEditingItem({...editingItem, variations: newV}); }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors shadow-sm bg-white border border-red-100"><X size={18}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setEditingItem({...editingItem, variations: [...(editingItem.variations || []), {name: '', price: ''}]})} className="text-xs font-black uppercase tracking-wider text-blue-600 bg-white border border-blue-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-blue-50 transition-all flex items-center gap-2 w-fit"><Plus size={16}/> Nouvelle Variation</button>
                                    </div>
                                )}
                            </div>

                            {/* Options Sans */}
                            <div className="flex flex-col gap-3 md:col-span-2 mt-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-2"><Settings2 size={14} className="text-gray-400"/> Options 'Sans' autorisées</label>
                                <input className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner" value={editingItem.removableIngredients || ''} onChange={e => setEditingItem({...editingItem, removableIngredients: e.target.value})} placeholder="Ex: Tomate, Oignon, Frites (séparées par virgule)" />
                            </div>
                        </div>

                        {/* Options Rupture de Stock */}
                        <div className="flex flex-col gap-3 md:col-span-2 mt-4">
                            <label className="flex items-center gap-4 p-5 bg-red-50/30 border-2 border-red-100 rounded-2xl cursor-pointer hover:bg-red-50 transition-colors shadow-sm">
                                <input type="checkbox" className="w-6 h-6 accent-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer" checked={editingItem.outOfStock || false} onChange={e => setEditingItem({...editingItem, outOfStock: e.target.checked})} />
                                <div className="flex flex-col">
                                    <span className="text-sm font-black uppercase tracking-wide text-red-900 mb-1">Rupture de stock (Masdoud)</span>
                                    <span className="text-[11px] font-bold text-red-700/60">Le plat apparaîtra comme épuisé.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Footer Actions SaaS */}
                    <div className="bg-gray-50 px-10 py-6 border-t-2 border-gray-100 flex items-center justify-end gap-4">
                        <button onClick={() => setEditingItem(null)} className="px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black uppercase text-xs shadow-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                            <X size={18}/> Annuler
                        </button>
                        <button onClick={handleSave} className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-gray-800 transition-all active:scale-95 flex items-center gap-2">
                            <Save size={18}/> {editingItem.isNew ? "Ajouter au menu" : "Enregistrer les modifications"}
                        </button>
                    </div>
                </div>
            )}
            
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                                <th className="px-8 py-6">Produit</th>
                                <th className="px-8 py-6">Catégorie</th>
                                <th className="px-8 py-6">Prix</th>
                                <th className="px-8 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {(editableMenu || []).map((item) => (
                                <tr key={item.id} id={`edit-item-${item.id}`} className={`hover:bg-gray-50/80 transition-colors ${activeEditZone === 'menuItem_' + item.id ? 'bg-blue-50/50 shadow-inner' : ''}`}>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 shrink-0 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl overflow-hidden border border-gray-200 shadow-inner">
                                                {item.img?.startsWith('http') ? <img src={item.img} className="w-full h-full object-cover"/> : item.img}
                                            </div>
                                            <div>
                                                <p className="font-black text-base text-gray-900 uppercase tracking-tight">{item.name}</p>
                                            {item.outOfStock && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 border border-red-200 mr-2">Rupture</span>}
                                            {item.removableIngredients && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 border border-gray-200"><Settings2 size={10} className="mr-1"/> Perso</span>}
                                            {item.hasVariations && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 ml-2"><Layers size={10} className="mr-1"/> Tailles</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">{item.category || '---'}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="font-mono font-black text-xl text-blue-600">{item.price} DH</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleEdit(item)} className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all shadow-sm" title="Modifier"><Edit3 size={18}/></button>
                                            <button onClick={() => handleDuplicate(item)} className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-xl transition-all shadow-sm" title="Dupliquer"><Copy size={18}/></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all shadow-sm" title="Supprimer"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(!editableMenu || editableMenu.length === 0) && (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center">
                                        <Utensils size={40} className="mx-auto text-gray-200 mb-4"/>
                                        <p className="text-xs font-black uppercase text-gray-400">Le menu est vide.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}