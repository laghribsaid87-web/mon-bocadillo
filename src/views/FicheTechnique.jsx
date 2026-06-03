import React from 'react';
import { BookOpen } from 'lucide-react';

export default function FicheTechnique({ db, appId, defaultMenu, showNotify }) {
    return (
        <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-xl">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-gray-900">Fiches Techniques</h2>
                        <p className="text-sm font-bold text-gray-500 mt-1">Module en cours de construction...</p>
                    </div>
                </div>
            </div>
        </div>
    );
}