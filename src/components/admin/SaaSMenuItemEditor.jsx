import React, { useState } from 'react';
// Remarque: T9der t-installer lucide-react ila makantch 3andk (npm install lucide-react)
import { Save, X, Tag, AlignLeft, DollarSign } from 'lucide-react';

export default function SaaSMenuItemEditor() {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    desc: '',
    img: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex justify-center items-start font-sans">
      {/* Conteneur de type "SaaS Card" */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* En-tête du formulaire */}
        <div className="border-b border-gray-100 px-8 py-5">
          <h2 className="text-xl font-bold text-gray-900">Ajouter un Plat</h2>
          <p className="text-sm text-gray-500 mt-1">Remplissez les informations ci-dessous pour ajouter un nouvel élément au menu.</p>
        </div>

        {/* Corps du formulaire */}
        <div className="p-8 space-y-6">
          
          {/* Ligne 1: Nom & Prix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Champ: Nom */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Tag size={16} className="text-gray-400" /> Nom du plat
              </label>
              <input
                type="text"
                name="name"
                placeholder="ex: Bocadillo Tangérois"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {/* Champ: Prix */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <DollarSign size={16} className="text-gray-400" /> Prix (DH)
              </label>
              <input
                type="number"
                name="price"
                placeholder="ex: 29"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                value={formData.price}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Ligne 2: Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlignLeft size={16} className="text-gray-400" /> Description
            </label>
            <textarea
              name="desc"
              rows="3"
              placeholder="ex: Viande hachée, fromage, sauce algérienne..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm resize-none"
              value={formData.desc}
              onChange={handleChange}
            ></textarea>
          </div>

        </div>

        {/* Footer (Actions) */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors flex items-center gap-2">
            <X size={18} /> Annuler
          </button>
          <button className="px-5 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 shadow-md transition-all active:scale-95 flex items-center gap-2">
            <Save size={18} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}