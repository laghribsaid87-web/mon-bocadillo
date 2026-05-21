import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Utensils, Trash2, Image, Tag, AlignLeft, Settings2, Plus, Edit3, Copy, Check, X, Save, DollarSign, Layers, GripVertical, ChevronUp, ChevronDown, Upload, Download, Store } from 'lucide-react';
import { PREDEFINED_INGREDIENTS, PREDEFINED_EXTRAS, PREDEFINED_DRINKS } from '../../config/constants';

export default function AdminMenuEditor({
    editableMenu, setEditableMenu,
    activeEditZone,
    settings, saveSettings, showNotify
}) {
    const [editingItem, setEditingItem] = useState(null);
    const [editTab, setEditTab] = useState('basic');
    const [customPrompt, setCustomPrompt] = useState({ show: false });
    const [promptInput, setPromptInput] = useState({ name: '', price: '' });
    const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null });
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [choiceBuilderModal, setChoiceBuilderModal] = useState({ show: false, mode: 'select', selectedCat: '', selectedProds: [] });

    const categories = useMemo(() => {
        const cats = new Set((editableMenu || []).map(i => i.category).filter(Boolean));
        return ['ALL', ...Array.from(cats)];
    }, [editableMenu]);

    const filteredMenu = useMemo(() => {
        if (selectedCategory === 'ALL') return editableMenu || [];
        return (editableMenu || []).filter(i => i.category === selectedCategory);
    }, [editableMenu, selectedCategory]);

    // 🔥 Logique dyal Drag & Drop w Tartib
    const dragItem = useRef();
    const dragOverItem = useRef();

    const handleDrop = () => {
        if (selectedCategory !== 'ALL') {
            if (showNotify) showNotify("Désactivez le filtre pour réorganiser", "info");
            return;
        }
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
        if (selectedCategory !== 'ALL') {
            if (showNotify) showNotify("Désactivez le filtre pour réorganiser", "info");
            return;
        }
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
                setEditTab('basic');
                setTimeout(() => {
                    document.getElementById('section-menu')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }, [activeEditZone]);

    const handleAdd = () => {
        setEditingItem({ id: 'new_'+Date.now(), name: '', price: '', category: '', img: '🍔', desc: '', removableIngredients: '', choices: '', maxOptions: 0, isNew: true, outOfStock: false, hasVariations: false, variations: [], station: '', stepOrder: ['variations', 'choices', 'removableIngredients', 'extras'], disabledInBranches: [] });
        setEditTab('basic');
    };

    const handleEdit = (item) => {
        setEditingItem({ ...item, isNew: false });
        setEditTab('basic');
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

    const moveStepOrder = (index, direction) => {
        const currentOrder = editingItem.stepOrder || ['variations', 'choices', 'removableIngredients', 'extras'];
        const newOrder = [...currentOrder];
        if (index + direction < 0 || index + direction >= newOrder.length) return;
        const temp = newOrder[index];
        newOrder[index] = newOrder[index + direction];
        newOrder[index + direction] = temp;
        setEditingItem({ ...editingItem, stepOrder: newOrder });
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target.result;
            const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) {
                if (showNotify) showNotify("Le fichier CSV est vide ou invalide", "error");
                return;
            }

            const parseLine = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const c = line[i];
                    if (c === '"' && line[i+1] === '"') {
                        current += '"';
                        i++;
                    } else if (c === '"') {
                        inQuotes = !inQuotes;
                    } else if (c === ',' && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += c;
                    }
                }
                result.push(current);
                return result;
            };

            const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
            const newItems = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);
                if (values.length < 2) continue;
                
                const item = {
                    id: 'imp_' + Date.now() + '_' + i,
                    name: '', price: 0, category: '', img: '🍔', desc: '', 
                    removableIngredients: '', choices: '', maxOptions: 0, outOfStock: false, 
                    hasVariations: false, variations: [], station: '', 
                    stepOrder: ['variations', 'choices', 'removableIngredients', 'extras'],
                    disabledInBranches: [],
                    extras: []
                };

                headers.forEach((h, idx) => {
                    const val = values[idx] ? values[idx].trim() : '';
                    if (!val) return;
                    
                    if (h.includes('nom') || h === 'name') item.name = val;
                    else if (h.includes('prix') || h === 'price') item.price = Number(val) || 0;
                    else if (h.includes('cat') || h === 'category') item.category = val;
                    else if (h.includes('img') || h === 'image') item.img = val;
                    else if (h.includes('desc')) item.desc = val;
                    else if (h.includes('station')) item.station = val.toUpperCase();
                    else if (h.includes('choix') || h === 'choices') item.choices = val;
                    else if (h.includes('sans') || h.includes('remov')) item.removableIngredients = val;
                    else if (h.includes('agences') || h.includes('désactiv')) item.disabledInBranches = val.split(',').map(v=>v.trim()).filter(Boolean);
                    else if (h.includes('taille') || h.includes('variation')) {
                        item.hasVariations = true;
                        item.variations = val.split(',').map(v => {
                            const parts = v.split(':');
                            return { name: parts[0] ? parts[0].trim() : '', price: parts.length > 1 ? Number(parts[1]) : 0 };
                        }).filter(v => v.name);
                    }
                });

                if (item.name) newItems.push(item);
            }

            if (newItems.length > 0) {
                if (window.confirm(`Voulez-vous ajouter ces ${newItems.length} produits au menu actuel ?`)) {
                    setEditableMenu([...newItems, ...(editableMenu || [])]);
                    if (showNotify) showNotify(`${newItems.length} produits importés ✅`, "success");
                }
            } else {
                if (showNotify) showNotify("Aucun produit valide trouvé dans le fichier", "error");
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const handleExportCSV = () => {
        if (!editableMenu || editableMenu.length === 0) {
            if (showNotify) showNotify("Le menu est vide", "info");
            return;
        }
        
        const headers = ["Nom", "Categorie", "Prix", "Image", "Description", "Station", "Choix", "Sans", "Tailles", "Agences Désactivées"];
        const rows = editableMenu.map(item => {
            const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
            
            let tailles = "";
            if (item.hasVariations && item.variations) {
                tailles = item.variations.map(v => `${v.name}:${v.price}`).join(", ");
            }

            return [
                escape(item.name),
                escape(item.category),
                item.price || 0,
                escape(item.img),
                escape(item.desc),
                escape(item.station),
                escape(item.choices),
                escape(item.removableIngredients),
                escape(tailles),
                escape((item.disabledInBranches || []).join(', '))
            ].join(",");
        });

        const csvContent = "data:text/csv;charset=utf-8,\ufeff" + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Menu_Bocadillo_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div id="section-menu" className="animate-in fade-in pb-12">
            {!editingItem ? (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Utensils size={20} className="text-blue-500"/> Gestion du Menu</h3>
                            <p className="text-sm text-gray-500 mt-1">Gérez vos plats, prix et disponibilités.</p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <label className="cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Upload size={14} /> Importer CSV
                                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                                </label>
                                <button onClick={handleExportCSV} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Download size={14} /> Exporter (Modèle)
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <select 
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold outline-none cursor-pointer hover:border-blue-300 transition-colors"
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(c => (
                                    <option key={c} value={c}>{c === 'ALL' ? 'Toutes les catégories' : c}</option>
                                ))}
                            </select>
                            <button onClick={handleAdd} className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Plus size={16}/> Ajouter
                            </button>
                        </div>
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
                                    {filteredMenu.map((item, index) => (
                                        <tr key={item.id} id={`edit-item-${item.id}`} 
                                            draggable={selectedCategory === 'ALL'}
                                            onDragStart={(e) => { if(selectedCategory === 'ALL') dragItem.current = index; }}
                                            onDragEnter={(e) => { if(selectedCategory === 'ALL') dragOverItem.current = index; }}
                                            onDragEnd={handleDrop}
                                            onDragOver={(e) => e.preventDefault()}
                                            onClick={() => handleEdit(item)}
                                            className={`group hover:bg-gray-50/50 transition-colors cursor-pointer ${activeEditZone === 'menuItem_' + item.id ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-4 py-4 text-center text-gray-300 hover:text-gray-500 transition-colors" title="Glisser pour déplacer" onClick={e => e.stopPropagation()}>
                                                <GripVertical size={18} className={`mx-auto ${selectedCategory !== 'ALL' ? 'opacity-30 cursor-not-allowed' : 'cursor-move'}`} />
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
                                                        {item.disabledInBranches && item.disabledInBranches.length > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100"><Store size={10} className="mr-1"/> Agences Spécifiques</span>}
                                                    {item.isCombo && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100"><Layers size={10} className="mr-1"/> Combo (Menu)</span>}
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
                                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex flex-col pr-2 mr-1 border-r border-gray-200">
                                                        <button onClick={(e) => { e.stopPropagation(); moveItem(index, -1); }} disabled={index === 0 || selectedCategory !== 'ALL'} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors" title="Monter"><ChevronUp size={14}/></button>
                                                        <button onClick={(e) => { e.stopPropagation(); moveItem(index, 1); }} disabled={index === filteredMenu.length - 1 || selectedCategory !== 'ALL'} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors" title="Descendre"><ChevronDown size={14}/></button>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier"><Edit3 size={16}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Dupliquer"><Copy size={16}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!filteredMenu || filteredMenu.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center cursor-default" onClick={e => e.stopPropagation()}>
                                                <Utensils size={32} className="mx-auto text-gray-300 mb-3"/>
                                                <p className="text-sm font-medium text-gray-500">Le menu est vide pour cette catégorie.</p>
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

                    {/* TABS (NOUVEAU - POUR ALLÉGER L'INTERFACE) */}
                    <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar pb-2">
                        <button onClick={() => setEditTab('basic')} className={`px-6 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${editTab === 'basic' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
                            <AlignLeft size={18}/> 1. Infos de Base
                        </button>
                        <button onClick={() => setEditTab('options')} className={`px-6 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${editTab === 'options' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
                            <Settings2 size={18}/> 2. Options & Choix
                        </button>
                        <button onClick={() => setEditTab('advanced')} className={`px-6 py-3.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${editTab === 'advanced' ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
                            <Layers size={18}/> 3. Avancé & Stock
                        </button>
                    </div>

                    <div className="w-full">
                        {editTab === 'basic' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-right-4">
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
                                            <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-2 block">Suggestions :</span>
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
                        )}

                        {editTab === 'options' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-right-4">
                                <div className="bg-purple-50 p-6 md:p-8 rounded-3xl border border-purple-200 flex flex-col gap-6">
                                    <h5 className="font-black text-sm text-purple-800 uppercase tracking-widest flex items-center gap-2"><Settings2 size={18} className="text-purple-600"/> 1. Choix & Ingrédients</h5>
                                    
                                    {/* 1. Choix / Parfum */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-black text-purple-800 uppercase tracking-wide">Choix Obligatoires (Menus / Combos)</label>
                                            <button type="button" onClick={() => setChoiceBuilderModal({ show: true, mode: 'select', selectedCat: '', selectedProds: [] })} className="text-[10px] font-black uppercase text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">+ Ajouter un Choix</button>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {(editingItem.choices || '').split(';;;').map((choiceRaw, idx) => {
                                                const choice = choiceRaw.trim();
                                                if (!choice) return null;
                                                
                                                let label = '';
                                                let type = '';
                                                if (choice.toUpperCase().startsWith('CAT:')) {
                                                    label = choice.substring(4).trim();
                                                    type = 'Catégorie';
                                                } else if (choice.toUpperCase().startsWith('PROD:')) {
                                                    label = choice.substring(5).trim();
                                                    type = 'Produits Spécifiques';
                                                } else {
                                                    label = choice;
                                                    type = 'Manuel';
                                                }

                                                return (
                                                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-purple-100 shadow-sm">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">{type}</span>
                                                            <span className="text-sm font-black text-purple-900">{label}</span>
                                                        </div>
                                                        <button type="button" onClick={() => {
                                                            const arr = (editingItem.choices || '').split(';;;').map(c => c.trim()).filter(Boolean);
                                                            arr.splice(idx, 1);
                                                            setEditingItem({...editingItem, choices: arr.join(' ;;; ')});
                                                        }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg shadow-sm hover:bg-red-100 transition-colors"><Trash2 size={16}/></button>
                                                    </div>
                                                );
                                            })}
                                            {!(editingItem.choices || '').trim() && (
                                                <div className="p-5 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-center text-sm font-bold text-gray-400">
                                                    Aucun choix configuré.<br/>Cliquez sur <span className="text-purple-600">"+ Ajouter un Choix"</span> pour commencer.
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-purple-100 pt-4 mb-4">
                                            <span className="text-xs font-black text-gray-900 mb-2 block uppercase">Éditeur Avancé (Code brut)</span>
                                            <input 
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-purple-500 focus:bg-white transition-all font-mono" 
                                                placeholder="Ex: CAT:Boissons ;;; PROD:Coca, Sprite"
                                                value={editingItem.choices || ''} 
                                                onChange={e => setEditingItem({...editingItem, choices: e.target.value})}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Favoris (Ancien Système)</span>
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
                                            <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Favoris (Cliquez pour ajouter)</span>
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
                                </div>

                                <div className="bg-purple-50 p-6 md:p-8 rounded-3xl border border-purple-200 flex flex-col gap-6">
                                    <h5 className="font-black text-sm text-purple-800 uppercase tracking-widest flex items-center gap-2"><Plus size={18} className="text-purple-600"/> 2. Extras & Limites</h5>
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
                        )}

                        {editTab === 'advanced' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-right-4">
                            {/* 5. Ordre d'affichage (Wizard Client) */}
                            <div className="bg-orange-50 p-6 md:p-8 rounded-3xl border border-orange-200">
                                <h5 className="font-black text-sm text-orange-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers size={18} className="text-orange-600"/> Ordre d'affichage au client</h5>
                                <p className="text-xs font-bold text-orange-600 mb-4 leading-tight">Définissez l'ordre des étapes pour le client (1 par 1).</p>
                                <div className="space-y-2">
                                    {(editingItem.stepOrder || ['variations', 'choices', 'removableIngredients', 'extras']).map((step, idx) => (
                                        <div key={step} className="flex items-center justify-between bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                                            <span className="text-xs font-black text-gray-700 uppercase">
                                                <span className="text-orange-400 mr-2">{idx + 1}.</span>
                                                {step === 'variations' ? 'Prix & Tailles' : 
                                                 step === 'choices' ? 'Choix Obligatoires' :
                                                 step === 'removableIngredients' ? 'Garniture à retirer' : 'Suppléments & Boissons'}
                                            </span>
                                            <div className="flex flex-col border-l border-gray-100 pl-2">
                                                <button onClick={() => moveStepOrder(idx, -1)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 transition-colors" title="Monter"><ChevronUp size={14}/></button>
                                                <button onClick={() => moveStepOrder(idx, 1)} disabled={idx === (editingItem.stepOrder || ['variations', 'choices', 'removableIngredients', 'extras']).length - 1} className="p-0.5 text-gray-400 hover:text-orange-600 disabled:opacity-30 transition-colors" title="Descendre"><ChevronDown size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
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

                            {/* Disponibilité par Agence */}
                            {(settings?.branches || []).length > 0 && (
                                <div className="bg-blue-50 p-6 md:p-8 rounded-3xl border border-blue-200 mt-6">
                                    <h5 className="font-black text-sm text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Store size={18} className="text-blue-600"/> Disponibilité par Agence</h5>
                                    <p className="text-xs font-bold text-blue-600 mb-4 leading-tight">Par défaut, le produit est disponible dans toutes les agences. Décochez les agences où il ne doit pas apparaître.</p>
                                    <div className="space-y-3">
                                        {(settings?.branches || []).map(branch => {
                                            const isDisabled = (editingItem.disabledInBranches || []).includes(branch.id);
                                            return (
                                                <label key={branch.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-blue-100 shadow-sm cursor-pointer hover:bg-blue-50/50 transition-colors">
                                                    <span className={`text-sm font-black ${!isDisabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{branch.name}</span>
                                                    <div className={`w-12 h-6 rounded-full relative transition-all border-2 ${!isDisabled ? 'bg-blue-500 border-blue-600' : 'bg-gray-200 border-gray-300'}`}>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden" 
                                                            checked={!isDisabled} 
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                let newDisabled = [...(editingItem.disabledInBranches || [])];
                                                                if (checked) {
                                                                    newDisabled = newDisabled.filter(id => id !== branch.id);
                                                                } else {
                                                                    if (!newDisabled.includes(branch.id)) newDisabled.push(branch.id);
                                                                }
                                                                setEditingItem({...editingItem, disabledInBranches: newDisabled});
                                                            }} 
                                                        />
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${!isDisabled ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
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

            {choiceBuilderModal.show && (
                <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md flex flex-col overflow-hidden shadow-2xl border-2 border-purple-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-purple-50 flex justify-between items-center bg-purple-50/50">
                            <h3 className="text-lg font-black text-purple-900 uppercase tracking-tight">Ajouter un Choix</h3>
                            <button onClick={() => setChoiceBuilderModal({ show: false, mode: 'select', selectedCat: '', selectedProds: [] })} className="p-2 text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-full shadow-sm transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6">
                            {choiceBuilderModal.mode === 'select' && (
                                <div className="space-y-4">
                                    <button onClick={() => setChoiceBuilderModal({...choiceBuilderModal, mode: 'category'})} className="w-full p-4 border-2 border-purple-100 rounded-2xl flex items-center gap-4 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group">
                                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Layers size={24}/></div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-sm">Catégorie Entière</h4>
                                            <p className="text-xs text-gray-500 font-medium">Ex: Toutes les Boissons</p>
                                        </div>
                                    </button>
                                    <button onClick={() => setChoiceBuilderModal({...choiceBuilderModal, mode: 'products'})} className="w-full p-4 border-2 border-blue-100 rounded-2xl flex items-center gap-4 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Utensils size={24}/></div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-sm">Produits Spécifiques</h4>
                                            <p className="text-xs text-gray-500 font-medium">Ex: Coca, Sprite (Sélectionner)</p>
                                        </div>
                                    </button>
                                    <button onClick={() => {
                                        const current = editingItem.choices ? editingItem.choices.trim() + (editingItem.choices.trim().endsWith(';;;') ? '' : ' ;;; ') : '';
                                        setEditingItem({...editingItem, choices: current + 'Nouveau_Choix_1, Nouveau_Choix_2'});
                                        setChoiceBuilderModal({ show: false, mode: 'select', selectedCat: '', selectedProds: [] });
                                    }} className="w-full p-4 border-2 border-gray-100 rounded-2xl flex items-center gap-4 hover:border-gray-500 hover:bg-gray-50 transition-all text-left group">
                                        <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Type size={24}/></div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-sm">Texte Manuel</h4>
                                            <p className="text-xs text-gray-500 font-medium">Créer des choix manuellement</p>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {choiceBuilderModal.mode === 'category' && (
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-2 ml-1">Sélectionnez une catégorie :</label>
                                    <select 
                                        className="w-full bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all cursor-pointer"
                                        value={choiceBuilderModal.selectedCat}
                                        onChange={(e) => setChoiceBuilderModal({...choiceBuilderModal, selectedCat: e.target.value})}
                                    >
                                        <option value="" disabled>Choisir...</option>
                                        {categories.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button 
                                        disabled={!choiceBuilderModal.selectedCat}
                                        onClick={() => {
                                            const current = editingItem.choices ? editingItem.choices.trim() + (editingItem.choices.trim().endsWith(';;;') ? '' : ' ;;; ') : '';
                                            setEditingItem({...editingItem, choices: current + `CAT:${choiceBuilderModal.selectedCat}`});
                                            setChoiceBuilderModal({ show: false, mode: 'select', selectedCat: '', selectedProds: [] });
                                        }}
                                        className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-sm disabled:opacity-50"
                                    >
                                        Ajouter la catégorie
                                    </button>
                                    <button onClick={() => setChoiceBuilderModal({...choiceBuilderModal, mode: 'select'})} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-800">Retour</button>
                                </div>
                            )}

                            {choiceBuilderModal.mode === 'products' && (
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wide mb-2 ml-1">Cochez les produits :</label>
                                    <div className="max-h-60 overflow-y-auto border-2 border-gray-200 rounded-2xl p-2 bg-gray-50 space-y-1">
                                        {(editableMenu || []).map(prod => (
                                            <label key={prod.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${choiceBuilderModal.selectedProds.includes(prod.name) ? 'bg-blue-100 border-blue-200 border' : 'bg-white border border-transparent hover:border-gray-200'}`}>
                                                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 accent-blue-600 shrink-0" 
                                                    checked={choiceBuilderModal.selectedProds.includes(prod.name)}
                                                    onChange={(e) => {
                                                        const newArr = e.target.checked 
                                                            ? [...(choiceBuilderModal.selectedProds || []), prod.name] 
                                                            : (choiceBuilderModal.selectedProds || []).filter(n => n !== prod.name);
                                                        setChoiceBuilderModal({...choiceBuilderModal, selectedProds: newArr});
                                                    }}
                                                />
                                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                                    {prod.img?.startsWith('http') || prod.img?.startsWith('data:image') ? <img src={prod.img} className="w-full h-full object-cover"/> : <span className="text-xl">{prod.img}</span>}
                                                </div>
                                                <span className="font-bold text-sm text-gray-800 leading-tight">{prod.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button 
                                        disabled={!choiceBuilderModal.selectedProds || choiceBuilderModal.selectedProds.length === 0}
                                        onClick={() => {
                                            const current = editingItem.choices ? editingItem.choices.trim() + (editingItem.choices.trim().endsWith(';;;') ? '' : ' ;;; ') : '';
                                            const prodsStr = choiceBuilderModal.selectedProds.join(', ');
                                            setEditingItem({...editingItem, choices: current + `PROD:${prodsStr}`});
                                            setChoiceBuilderModal({ show: false, mode: 'select', selectedCat: '', selectedProds: [] });
                                        }}
                                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-sm disabled:opacity-50"
                                    >
                                        Ajouter les produits
                                    </button>
                                    <button onClick={() => setChoiceBuilderModal({...choiceBuilderModal, mode: 'select'})} className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-800">Retour</button>
                                </div>
                            )}
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