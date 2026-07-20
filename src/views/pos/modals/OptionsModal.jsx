import React from 'react';
import { CheckCircle } from 'lucide-react';
import { usePosContext } from '../PosContext';
import { PREDEFINED_DRINKS } from '../../../config/constants';

export default function OptionsModal({ 
    selectedItemForOptions, setSelectedItemForOptions,
    showPosSans, setShowPosSans,
    showPosExtras, setShowPosExtras,
    comboSelectionsForOptions, setComboSelectionsForOptions,
    togglePosComboRemovable,
    selectedVariationForOptions, setSelectedVariationForOptions,
    selectedChoiceForOptions, setSelectedChoiceForOptions,
    toggleExtra, handleConfirmOptions, formatSansIngredient, toggleOption
}) {
    const { brand } = usePosContext();

    const confirmOptionsAndAdd = () => {
        handleConfirmOptions(selectedItemForOptions);
    };

    if (!selectedItemForOptions) return null;

    return (
        <>
            {selectedItemForOptions && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedItemForOptions(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-gray-900 mb-1">{selectedItemForOptions.name}</h2>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Options du produit</p>

                            {/* 🔥 BOUTONS TOGGLES POUR SANS ET EXTRAS (POUR NE PAS DÉRANGER LE CAISSIER) */}
                            {((selectedItemForOptions.ingredients?.length > 0) || (selectedItemForOptions.extras?.length > 0)) && (
                                <div className="flex gap-2 mt-4">
                                    {selectedItemForOptions.ingredients?.length > 0 && (
                                        <button onClick={() => setShowPosSans(!showPosSans)} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm ${showPosSans ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                                            Sans Ingrédients
                                        </button>
                                    )}
                                    {selectedItemForOptions.extras?.length > 0 && (
                                        <button onClick={() => setShowPosExtras(!showPosExtras)} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm ${showPosExtras ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                                            Extras & Boissons
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-[60vh] bg-gray-50">

                        {selectedItemForOptions.isCombo && (
                            <div className="p-5 border-b border-gray-200 space-y-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Personnalisez votre Menu</p>
                                {selectedItemForOptions.comboItems?.map((cItem, idx) => (
                                    <div key={idx} className="p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 shadow-sm">
                                        <h4 className="font-black text-gray-900 mb-3 text-sm flex items-center gap-2">🔹 {cItem.name}</h4>
                                        {cItem.type === 'sandwich' && (
                                            <div>
                                                <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Ingrédients à retirer :</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Tomate', 'Oignon', 'Olive', 'Laitue', 'Carotte'].map(ing => {
                                                        const isRemoved = comboSelectionsForOptions[idx]?.removables?.includes(ing);
                                                        return (
                                                            <button key={ing} onClick={() => togglePosComboRemovable(idx, ing)} className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all ${isRemoved ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:border-red-200'}`}>
                                                                Sans {ing}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {cItem.type === 'drink' && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {cItem.options?.map(opt => (
                                                    <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${comboSelectionsForOptions[idx]?.selectedOption === opt ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                                        <input type="radio" className="w-5 h-5 accent-blue-600" checked={comboSelectionsForOptions[idx]?.selectedOption === opt} onChange={() => setComboSelectionsForOptions(prev => ({...prev, [idx]: {...prev[idx], selectedOption: opt}}))} />
                                                        <span className="text-sm font-bold text-gray-800">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedItemForOptions.hasVariations && selectedItemForOptions.variations?.length > 0 && (
                            <div className="p-5 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Taille / Variante <span className="text-red-500">*</span></p>
                                <div className="space-y-2">
                                    {selectedItemForOptions.variations.map((v, idx) => (
                                        <label key={idx} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedVariationForOptions?.name === v.name ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedVariationForOptions?.name === v.name ? 'border-blue-500' : 'border-gray-300'}`}>{selectedVariationForOptions?.name === v.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                <span className={`text-sm font-black uppercase leading-tight ${selectedVariationForOptions?.name === v.name ? 'text-blue-700' : 'text-gray-700'}`}>{v.name}</span>
                                            </div>
                                            <span className="font-black text-blue-600">{v.price} DH</span>
                                            <input type="radio" className="hidden" name="pos_variation" checked={selectedVariationForOptions?.name === v.name} onChange={() => setSelectedVariationForOptions(v)} />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedItemForOptions.choices?.length > 0 && (
                            <div className="p-5 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Choix (Obligatoire) <span className="text-red-500">*</span></p>
                                <div className={`${selectedItemForOptions.choices.some(c => c.includes('|')) ? 'grid grid-cols-2 gap-3' : 'space-y-2'}`}>
                                    {selectedItemForOptions.choices.map(c => {
                                        const parts = c.trim().split('|');
                                        const choiceName = parts[0].trim();
                                        const img = parts.length > 1 ? parts[1].trim() : null;
                                        return (
                                        <label key={choiceName} className={`flex ${img ? 'flex-col items-center text-center' : 'items-center gap-3'} p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedChoiceForOptions === choiceName ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                            {img && (
                                                <div className="w-16 h-16 mb-2 rounded-lg overflow-hidden flex items-center justify-center bg-transparent">
                                                    {img.startsWith('http') || img.startsWith('data:image') ? <img src={img} className="w-full h-full object-contain" alt={choiceName} /> : <span className="text-4xl">{img}</span>}
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-3 ${img ? 'w-full justify-center' : ''}`}>
                                            <input 
                                                type="radio" 
                                                name="pos_choice"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                                                checked={selectedChoiceForOptions === choiceName}
                                                onChange={() => setSelectedChoiceForOptions(choiceName)}
                                            />
                                            <span className={`text-sm font-black uppercase leading-tight ${selectedChoiceForOptions === choiceName ? 'text-blue-700' : 'text-gray-700'}`}>{choiceName}</span>
                                            </div>
                                        </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {showPosExtras && selectedItemForOptions.extras?.length > 0 && (
                            (() => {
                                const drinkNames = new Set(PREDEFINED_DRINKS.map(d => d.name));
                                const pureExtras = (selectedItemForOptions.extras || []).filter(e => !drinkNames.has(e.name));
                                const pureDrinks = (selectedItemForOptions.extras || []).filter(e => drinkNames.has(e.name));
                                
                                return (
                                    <>
                                        {pureExtras.length > 0 && (
                                            <div className="p-5 border-b border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">➕ Extras & Suppléments</p>
                                                <div className="space-y-2">
                                                    {pureExtras.map(ext => {
                                                        const isSelected = selectedItemForOptions.selectedExtras.some(e => e.name === ext.name);
                                                        return (
                                                            <label key={ext.name} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300'}`}>
                                                                <span className={`text-sm font-black uppercase ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>Avec {ext.name} <span className="text-green-600 ml-1">(+{ext.price} DH)</span></span>
                                                                <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-green-600 focus:ring-green-500 cursor-pointer" checked={isSelected} onChange={() => toggleExtra(ext)} />
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {pureDrinks.length > 0 && (
                                            <div className="p-5 border-b border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">🥤 Boissons</p>
                                                <div className="space-y-2">
                                                    {pureDrinks.map(ext => {
                                                        const isSelected = selectedItemForOptions.selectedExtras.some(e => e.name === ext.name);
                                                        return (
                                                            <label key={ext.name} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                                                <span className={`text-sm font-black uppercase ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{ext.name} <span className="text-blue-600 ml-1">(+{ext.price} DH)</span></span>
                                                                <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-blue-600 focus:ring-blue-500 cursor-pointer" checked={isSelected} onChange={() => toggleExtra(ext)} />
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )
                            })()
                        )}

                        {showPosSans && selectedItemForOptions.ingredients?.length > 0 && (
                            <div className="p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Options Sans (Khtar chno t7eyed)</p>
                                {selectedItemForOptions.ingredients.map(opt => {
                                    const isSelected = selectedItemForOptions.selectedSans.includes(opt);
                                    return (
                                        <label key={opt} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-red-300'}`}>
                                            <span className={`text-sm font-black ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>{formatSansIngredient(opt)}</span>
                                            <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer" checked={isSelected} onChange={() => toggleOption(opt)} />
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                        </div>
                        
                        <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                            <button onClick={() => setSelectedItemForOptions(null)} className="flex-1 py-4 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                            <button onClick={confirmOptionsAndAdd} className="flex-[2] py-4 font-black text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2" style={{backgroundColor: brand?.posColor || brand?.color || '#4f46e5'}}><CheckCircle size={20}/> {selectedItemForOptions.isEditingCartItemName ? "Valider la modification" : "Valider l'ajout"}</button>
                        </div>
                    </div>
                </div>
            )}

            
        </>
    );
}
