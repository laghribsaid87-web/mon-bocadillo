import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, UploadCloud, Eye } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function GlovoMenuConfig({ settings, saveSettings, brand }) {
    const [menuItems, setMenuItems] = useState([]);
    const [glovoConfig, setGlovoConfig] = useState({
        extraAttrs: [],
        boissonAttrs: [],
        garnitureAttrs: [],
        groupNames: {},
        groupSettings: {}
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setMenuItems(JSON.parse(JSON.stringify(settings.menuItems || [])));
            
            // Si c'est la première fois, on initialise avec les valeurs par défaut
            if (!settings.glovoConfig) {
                const defaultBoissons = [
                    { id: "bs_pepsi", name: "PEPSI", price_impact: 10, available: true },
                    { id: "bs_mirinda_orange", name: "Mirinda Orange", price_impact: 10, available: true },
                    { id: "bs_mirinda_citron", name: "Mirinda Citron", price_impact: 10, available: true },
                    { id: "bs_7up", name: "7UP", price_impact: 10, available: true },
                    { id: "bs_mirinda_pomme", name: "Mirinda Pomme", price_impact: 10, available: true },
                    { id: "bs_fanta", name: "Fanta Orange", price_impact: 10, available: true },
                    { id: "bs_eau", name: "Eaux 50cl", price_impact: 10, available: true },
                    { id: "bs_jus", name: "Jus d'orange", price_impact: 25, available: true }
                ];
                setGlovoConfig({
                    garnitureAttrs: [
                        { id: "sans_tomate", name: "Sans Tomate", price_impact: 0, available: true },
                        { id: "sans_oignon", name: "Sans Oignon", price_impact: 0, available: true },
                        { id: "sans_olive", name: "Sans Olive", price_impact: 0, available: true },
                        { id: "sans_laitue", name: "Sans Laitue", price_impact: 0, available: true },
                        { id: "sans_carotte", name: "Sans Carotte", price_impact: 0, available: true },
                        { id: "sans_pommes_de_terre", name: "Sans Pommes de Terre", price_impact: 0, available: true },
                        { id: "sans_mayo", name: "Sans Sauce Mayonnaise Maison", price_impact: 0, available: true },
                        { id: "sans_harissa", name: "Sans Harissa", price_impact: 0, available: true }
                    ],
                    extraAttrs: [
                        { id: "ext_frites", name: "\"Extra\" Frites", price_impact: 7, available: true },
                        { id: "ext_thon", name: "\"Extra\" Thon", price_impact: 8, available: true },
                        { id: "ext_charcuterie", name: "\"Extra\" Charcuterie", price_impact: 4, available: true },
                        { id: "ext_fromage", name: "\"Extra\" Fromage", price_impact: 3, available: true },
                        { id: "ext_oeuf", name: "\"Extra\" Ouf", price_impact: 3, available: true }
                    ],
                    boissonAttrs: defaultBoissons,
                    boissonIncluseAttrs: defaultBoissons.slice(0, 5).map(a => ({ ...a, id: a.id + "_inc", price_impact: 0 })),
                    boisson1LIncluseAttrs: [
                        { id: "bs_coca_1l_inc", name: "Coca-Cola 1L", price_impact: 0, available: true },
                        { id: "bs_pepsi_1l_inc", name: "PEPSI 1L", price_impact: 0, available: true },
                        { id: "bs_hawai_1l_inc", name: "Hawai 1L", price_impact: 0, available: true }
                    ],
                    groupNames: {
                        grp_garniture: "Choix de garniture",
                        grp_extra: "Souhaitez vous un Extra ?",
                        grp_boisson: "Souhaitez-vous une boisson ?",
                        grp_boisson_choix: "Boisson au choix",
                        grp_boisson_1L_choix: "Boisson 1L au choix"
                    },
                    groupSettings: {
                        grp_garniture: { min: 0, max: 8 },
                        grp_extra: { min: 0, max: 5 },
                        grp_boisson: { min: 0, max: 7 },
                        grp_boisson_choix: { min: 1, max: 1 },
                        grp_boisson_1L_choix: { min: 1, max: 1 }
                    }
                });
            } else {
                let parsedConfig = JSON.parse(JSON.stringify(settings.glovoConfig));
                if (!parsedConfig.boissonIncluseAttrs && parsedConfig.boissonAttrs) {
                    parsedConfig.boissonIncluseAttrs = parsedConfig.boissonAttrs.slice(0, 5).map(a => ({
                        ...a,
                        id: a.id + "_inc",
                        price_impact: 0
                    }));
                }
                if (!parsedConfig.groupNames) {
                    parsedConfig.groupNames = {
                        grp_garniture: "Choix de garniture",
                        grp_extra: "Souhaitez vous un Extra ?",
                        grp_boisson: "Souhaitez-vous une boisson ?",
                        grp_boisson_choix: "Boisson au choix",
                        grp_boisson_1L_choix: "Boisson 1L au choix"
                    };
                }
                if (!parsedConfig.groupSettings) {
                    parsedConfig.groupSettings = {
                        grp_garniture: { min: 0, max: 8 },
                        grp_extra: { min: 0, max: 5 },
                        grp_boisson: { min: 0, max: 7 },
                        grp_boisson_choix: { min: 1, max: 1 },
                        grp_boisson_1L_choix: { min: 1, max: 1 }
                    };
                }
                if (!parsedConfig.boisson1LIncluseAttrs) {
                    parsedConfig.boisson1LIncluseAttrs = [
                        { id: "bs_coca_1l_inc", name: "Coca-Cola 1L", price_impact: 0, available: true },
                        { id: "bs_pepsi_1l_inc", name: "PEPSI 1L", price_impact: 0, available: true },
                        { id: "bs_hawai_1l_inc", name: "Hawai 1L", price_impact: 0, available: true }
                    ];
                }
                setGlovoConfig(parsedConfig);
            }
        }
    }, [settings]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...menuItems];
        newItems[index][field] = value;
        setMenuItems(newItems);
    };

    const handleGlovoConfigToggle = (field, value) => {
        setGlovoConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleGroupSettingChange = (groupId, field, value) => {
        setGlovoConfig(prev => ({
            ...prev,
            groupSettings: {
                ...prev.groupSettings,
                [groupId]: {
                    ...(prev.groupSettings?.[groupId] || {min: 0, max: 8}),
                    [field]: value
                }
            }
        }));
    };

    const handleConfigGroupNameChange = (groupId, value) => {
        setGlovoConfig(prev => ({
            ...prev,
            groupNames: {
                ...prev.groupNames,
                [groupId]: value
            }
        }));
    };

    const handleAddOption = (categoryKey) => {
        const newConfig = { ...glovoConfig };
        const id = 'opt_' + Math.random().toString(36).substr(2, 9);
        newConfig[categoryKey] = [...(newConfig[categoryKey] || []), { id, name: "Nouvelle Option", price_impact: 0, available: true }];
        setGlovoConfig(newConfig);
    };

    const handleClearGroup = (categoryKey) => {
        if(!window.confirm("Voulez-vous vraiment supprimer toutes les options de ce groupe ?")) return;
        const newConfig = { ...glovoConfig };
        newConfig[categoryKey] = [];
        setGlovoConfig(newConfig);
    };

    const handleRemoveOption = (categoryKey, index) => {
        if(!window.confirm("Supprimer cette option ?")) return;
        const newConfig = { ...glovoConfig };
        newConfig[categoryKey] = newConfig[categoryKey].filter((_, i) => i !== index);
        setGlovoConfig(newConfig);
    };

    const deleteCategory = (category) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer toute cette catégorie (" + category + ") ?")) return;
        setMenuItems(menuItems.filter(item => item.category !== category));
    };

    const moveCategory = (category, direction) => {
        const categories = Object.keys(groupedItems);
        const catIndex = categories.indexOf(category);
        if ((direction === -1 && catIndex > 0) || (direction === 1 && catIndex < categories.length - 1)) {
            const newCategories = [...categories];
            [newCategories[catIndex], newCategories[catIndex + direction]] = [newCategories[catIndex + direction], newCategories[catIndex]];
            
            const newMenuItems = [];
            newCategories.forEach(cat => newMenuItems.push(...groupedItems[cat]));
            const noCatItems = menuItems.filter(m => !m.category);
            newMenuItems.push(...noCatItems);
            setMenuItems(newMenuItems);
        }
    };

    const moveItem = (index, direction) => {
        const newItems = [...menuItems];
        const item = newItems[index];
        const categoryItems = groupedItems[item.category];
        const categoryIndex = categoryItems.findIndex(m => m.id === item.id);
        
        if (direction === -1 && categoryIndex > 0) {
            const prevItemId = categoryItems[categoryIndex - 1].id;
            const prevIndex = newItems.findIndex(m => m.id === prevItemId);
            [newItems[index], newItems[prevIndex]] = [newItems[prevIndex], newItems[index]];
            setMenuItems(newItems);
        } else if (direction === 1 && categoryIndex < categoryItems.length - 1) {
            const nextItemId = categoryItems[categoryIndex + 1].id;
            const nextIndex = newItems.findIndex(m => m.id === nextItemId);
            [newItems[index], newItems[nextIndex]] = [newItems[nextIndex], newItems[index]];
            setMenuItems(newItems);
        }
    };

    const handleConfigChange = (category, index, field, value) => {
        const newConfig = { ...glovoConfig };
        newConfig[category][index][field] = value;
        setGlovoConfig(newConfig);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSettings({
                ...settings,
                menuItems,
                glovoConfig
            });
            alert("Configuration Glovo enregistrée avec succès!");
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'enregistrement.");
        }
        setIsSaving(false);
    };

    const groupedItems = menuItems.reduce((acc, item) => {
        if (!item.category) return acc;
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    const renderAttributeTable = (title, categoryKey) => (
        <div className="mb-2 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="p-3 text-sm font-bold text-gray-500 uppercase">Nom sur Glovo</th>
                            <th className="p-3 text-sm font-bold text-gray-500 uppercase">Prix Glovo (+ MAD)</th>
                            <th className="p-3 text-sm font-bold text-gray-500 uppercase">Disponible</th>
                            <th className="p-3 text-sm font-bold text-gray-500 uppercase w-16 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {glovoConfig[categoryKey]?.map((attr, index) => (
                            <tr key={attr.id} className="border-b border-gray-50">
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={attr.name}
                                        onChange={e => handleConfigChange(categoryKey, index, 'name', e.target.value)}
                                        className="w-full p-2 border border-gray-200 rounded-xl font-medium"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        value={attr.price_impact}
                                        onChange={e => handleConfigChange(categoryKey, index, 'price_impact', parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 border border-gray-200 rounded-xl font-bold text-[#FFC244]"
                                    />
                                </td>
                                <td className="p-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={attr.available !== false}
                                            onChange={e => handleConfigChange(categoryKey, index, 'available', e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-300 text-[#FFC244] focus:ring-[#FFC244]"
                                        />
                                        <span className="text-sm font-medium">Oui</span>
                                    </label>
                                </td>
                                <td className="p-3 text-center">
                                    <button onClick={() => handleRemoveOption(categoryKey, index)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex gap-4 mt-4">
                <button onClick={() => handleAddOption(categoryKey)} className="flex items-center gap-2 text-sm font-bold text-[#00a082] bg-[#00a082]/10 px-4 py-2 rounded-xl hover:bg-[#00a082]/20">
                    <Plus size={16} /> Ajouter une option
                </button>
                <button onClick={() => handleClearGroup(categoryKey)} className="flex items-center gap-2 text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100">
                    <Trash2 size={16} /> Vider le groupe
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => window.history.back()} 
                            className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black flex items-center gap-3">
                                Configuration Glovo Menu
                            </h1>
                            <p className="text-gray-500 font-medium mt-1">Gérez les prix et les options spécifiques à Glovo</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-[#FFC244] text-gray-900 font-bold px-6 py-3 rounded-2xl shadow-sm hover:bg-[#ffb01f] transition-all disabled:opacity-50"
                    >
                        {isSaving ? <span className="animate-spin text-xl">⏳</span> : <Save size={20} />}
                        <span className="hidden sm:inline">Enregistrer</span>
                    </button>
                </div>

                {/* TABS ou SECTIONS */}
                <div className="space-y-8">

                    
                    {/* SECTION AUTOMATOR */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black mb-6 border-b border-gray-100 pb-4">Configuration GoDroid Automator</h2>
                        <div className="flex items-center justify-between bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Désactiver la création de commandes (Automator)</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                                    Si activé, l'Automator mettra uniquement à jour le numéro de téléphone des commandes Glovo, sans les recréer en double. (Idéal si l'API officielle Glovo est activée).
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={glovoConfig.disableAutomatorOrderCreation || false} 
                                    onChange={e => handleGlovoConfigToggle('disableAutomatorOrderCreation', e.target.checked)} 
                                />
                                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#00a082]"></div>
                            </label>
                        </div>
                    </div>

                    {/* SECTION NOMS DES GROUPES ET OPTIONS */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black mb-6 border-b border-gray-100 pb-4">Paramétrage des Groupes d'Options</h2>
                        <div className="flex flex-col gap-8">
                            {[
                                { id: 'grp_garniture', label: 'Garnitures (Sans ...)', attrKey: 'garnitureAttrs' },
                                { id: 'grp_extra', label: 'Extras (+ MAD)', attrKey: 'extraAttrs' },
                                { id: 'grp_boisson', label: 'Boissons Payantes', attrKey: 'boissonAttrs' },
                                { id: 'grp_boisson_choix', label: 'Boissons Incluses (Formules - 0 DH)', attrKey: 'boissonIncluseAttrs' },
                                { id: 'grp_boisson_1L_choix', label: 'Boissons 1L Incluses (Formule Toi et Moi - 0 DH)', attrKey: 'boisson1LIncluseAttrs' }
                            ].map(group => (
                                <div key={group.id} className="flex flex-col gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-end mb-2 border-b border-gray-200 pb-4">
                                        <div className="flex-1 w-full">
                                            <label className="text-sm font-bold text-gray-800 mb-2 block">{group.label}</label>
                                            <input 
                                                type="text"
                                                placeholder="Nom du groupe sur Glovo (ex: Choix de garniture)"
                                                value={glovoConfig.groupNames?.[group.id] || ''}
                                                onChange={e => handleConfigGroupNameChange(group.id, e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[#FFC244]"
                                            />
                                        </div>
                                        
                                        <div className="flex items-center gap-6 pb-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={(glovoConfig.groupSettings?.[group.id]?.min || 0) >= 1}
                                                    onChange={e => handleGroupSettingChange(group.id, 'min', e.target.checked ? 1 : 0)}
                                                    className="w-5 h-5 text-[#00a082] rounded border-gray-300 focus:ring-[#00a082]"
                                                />
                                                <span className="text-sm font-bold text-gray-700">Obligatoire</span>
                                            </label>
                                            
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-700">Max choix:</span>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={glovoConfig.groupSettings?.[group.id]?.max || 1}
                                                    onChange={e => handleGroupSettingChange(group.id, 'max', parseInt(e.target.value) || 1)}
                                                    className="w-16 p-2 text-center border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-[#FFC244]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Tableau des options du groupe */}
                                    {renderAttributeTable(null, group.attrKey)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* API Token Section */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            🔑 Glovo API Token (Production)
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Collez ici le jeton d'accès (API Token) fourni par Glovo pour l'environnement de production. S'il est vide, le jeton de test sera utilisé par défaut.
                        </p>
                        <input
                            type="text"
                            value={glovoConfig.apiToken || ''}
                            onChange={(e) => setGlovoConfig({ ...glovoConfig, apiToken: e.target.value })}
                            placeholder="Ex: a1b2c3d4-e5f6-7890-1234-abcdef123456"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-50"
                        />
                    </div>
                    {/* SECTION PRODUITS */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black mb-6 border-b border-gray-100 pb-4">Produits Principaux</h2>
                        
                        {Object.entries(groupedItems).map(([category, items]) => (
                            <div key={category} className="mb-8 last:mb-0">
                                <div className="flex justify-between items-center bg-gray-100 px-4 py-2 rounded-xl mb-4">
                                    <h3 className="text-lg font-bold text-gray-700">{category}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => moveCategory(category, -1)} className="p-1 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-500" title="Monter la catégorie">▲</button>
                                        <button onClick={() => moveCategory(category, 1)} className="p-1 bg-white rounded shadow-sm hover:bg-gray-50 text-gray-500" title="Descendre la catégorie">▼</button>
                                        <button onClick={() => deleteCategory(category)} className="p-1 bg-red-50 rounded shadow-sm hover:bg-red-100 text-red-500 ml-2" title="Supprimer la catégorie">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase">Nom Original (POS)</th>
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase w-48">Nom sur Glovo</th>
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase text-center">Prix POS</th>
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase text-center w-32">Prix Glovo</th>
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase">Options (Groupes)</th>
                                                <th className="p-3 text-sm font-bold text-gray-500 uppercase text-center">En Rupture?</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map(item => {
                                                const index = menuItems.findIndex(m => m.id === item.id);
                                                return (
                                                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                        <td className="p-3 font-medium">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex flex-col gap-1 mr-2">
                                                                    <button onClick={() => moveItem(index, -1)} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded px-1 text-xs">▲</button>
                                                                    <button onClick={() => moveItem(index, 1)} className="text-gray-400 hover:text-gray-700 bg-gray-100 rounded px-1 text-xs">▼</button>
                                                                </div>
                                                                {item.img && <img src={item.img} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />} 
                                                                <span>{item.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <input 
                                                                type="text" 
                                                                value={item.glovoName || ''}
                                                                onChange={e => handleItemChange(index, 'glovoName', e.target.value)}
                                                                placeholder={item.name}
                                                                className="w-full p-2 border border-gray-200 rounded-xl font-medium text-sm"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-center text-gray-500 font-bold">
                                                            {item.price} MAD
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    value={item.glovoPrice || ''}
                                                                    onChange={e => handleItemChange(index, 'glovoPrice', parseFloat(e.target.value))}
                                                                    placeholder={item.price}
                                                                    className="w-full p-2 pr-10 border border-gray-200 rounded-xl font-bold text-[#FFC244]"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">MAD</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap gap-2 text-xs">
                                                                {[
                                                                    { id: 'grp_garniture', label: 'Garniture Standard' },
                                                                    { id: 'grp_garniture_1er_bocadillo', label: 'Garniture 1er Boc (Toi&Moi)' },
                                                                    { id: 'grp_garniture_2eme_bocadillo', label: 'Garniture 2ème Boc (Toi&Moi)' },
                                                                    { id: 'grp_garniture_1er_sandwich', label: 'Garniture 1er Sand (Gourmande)' },
                                                                    { id: 'grp_garniture_2eme_sandwich', label: 'Garniture 2ème Sand (Gourmande)' },
                                                                    { id: 'grp_extra', label: 'Extras' },
                                                                    { id: 'grp_boisson', label: 'Boissons Payantes' },
                                                                    { id: 'grp_boisson_choix', label: 'Boissons Incluses (0DH)' },
                                                                    { id: 'grp_boisson_1L_choix', label: 'Boissons 1L Incluses (0DH)' }
                                                                ].map(group => (
                                                                    <label key={group.id} className="flex items-center gap-1 cursor-pointer bg-gray-100 p-1 rounded hover:bg-gray-200">
                                                                        <input 
                                                                            type="checkbox"
                                                                            checked={(item.glovoAttrGroups || []).includes(group.id)}
                                                                            onChange={(e) => {
                                                                                const currentGroups = item.glovoAttrGroups || [];
                                                                                let newGroups;
                                                                                if (e.target.checked) {
                                                                                    newGroups = [...currentGroups, group.id];
                                                                                } else {
                                                                                    newGroups = currentGroups.filter(g => g !== group.id);
                                                                                }
                                                                                handleItemChange(index, 'glovoAttrGroups', newGroups);
                                                                            }}
                                                                            className="w-3 h-3 rounded border-gray-300 text-green-500 focus:ring-green-500"
                                                                        />
                                                                        <span>{group.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <label className="flex items-center justify-center gap-2 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={item.outOfStock || false}
                                                                    onChange={e => handleItemChange(index, 'outOfStock', e.target.checked)}
                                                                    className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                                                />
                                                            </label>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SECTION PUSH GLOVO MENU */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-20">
                        <h2 className="text-2xl font-black mb-6 border-b border-gray-100 pb-4">Synchronisation Glovo</h2>
                        <p className="text-gray-500 mb-6">
                            Avant d'envoyer le menu, vous pouvez le visualiser pour vérifier les prix et les options. 
                            Une fois vérifié, vous pouvez l'envoyer directement à chaque agence.
                        </p>
                        
                        <div className="flex flex-col gap-4">
                            <a 
                                href="https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoMenuDownload?appId=mon-bocadillo-menu" 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 bg-blue-50 text-blue-600 font-bold px-6 py-4 rounded-2xl hover:bg-blue-100 transition-all border border-blue-200 w-full md:w-auto"
                            >
                                <Eye size={20} />
                                Voir le Menu JSON (Avant l'envoi)
                            </a>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={async () => {
                                        if (!window.confirm("Envoyer le menu à l'agence LAYMOUNE ?")) return;
                                        try {
                                            const functions = getFunctions();
                                            const pushMenu = httpsCallable(functions, 'pushMenuToGlovo');
                                            alert("Synchronisation en cours vers Laymoune...");
                                            const res = await pushMenu({ appId: 'mon-bocadillo-menu', storeId: "370282" });
                                            alert("Succès Laymoune: " + res.data.message);
                                        } catch (e) {
                                            console.error(e);
                                            alert("Erreur Laymoune: " + e.message);
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 bg-[#FFC244] text-gray-900 font-bold px-6 py-4 rounded-2xl shadow-sm hover:bg-[#ffb01f] transition-all"
                                >
                                    <UploadCloud size={20} />
                                    Envoyer vers Laymoune
                                </button>

                                <button 
                                    onClick={async () => {
                                        if (!window.confirm("Envoyer le menu à l'agence OUM RABII ?")) return;
                                        try {
                                            const functions = getFunctions();
                                            const pushMenu = httpsCallable(functions, 'pushMenuToGlovo');
                                            alert("Synchronisation en cours vers Oum Rabii...");
                                            const res = await pushMenu({ appId: 'mon-bocadillo-menu', storeId: "249094" });
                                            alert("Succès Oum Rabii: " + res.data.message);
                                        } catch (e) {
                                            console.error(e);
                                            alert("Erreur Oum Rabii: " + e.message);
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 bg-[#FFC244] text-gray-900 font-bold px-6 py-4 rounded-2xl shadow-sm hover:bg-[#ffb01f] transition-all"
                                >
                                    <UploadCloud size={20} />
                                    Envoyer vers Oum Rabii
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

