import React from 'react';
import { X, Delete } from 'lucide-react';
import { usePosContext } from '../PosContext';

export default function StandardOrderModal() {
    const { 
        showStandardModal, setShowStandardModal, 
        showTelNumpad, setShowTelNumpad, 
        telInfo, setTelInfo, 
        total, handleSendWhatsappFromPOS 
    } = usePosContext();

    if (!showStandardModal) return null;

    return (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowStandardModal(false); setShowTelNumpad(false); }}>
            <div className="bg-white rounded-[2.5rem] w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                    <h2 className="text-lg font-black text-orange-800 flex items-center gap-2">
                        📞 Commande Téléphone
                    </h2>
                    <button onClick={() => { setShowStandardModal(false); setShowTelNumpad(false); }} className="p-2 bg-white rounded-full hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 bg-gray-50 flex flex-col gap-4">

                <label className="block text-left">
                    <span className="text-xs font-bold text-gray-700 mb-1.5 block">
                        Numéro de Téléphone Client <span className="text-red-500">*</span>
                    </span>
                    <input
                        type="tel"
                        readOnly
                        onClick={() => setShowTelNumpad(true)}
                        placeholder="06XXXXXXXX ou 07XXXXXXXX"
                        className="w-full bg-white border border-gray-300 p-4 rounded-2xl text-3xl tracking-widest text-center font-bold text-gray-900 outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-500/20 transition-all shadow-sm cursor-pointer"
                        value={telInfo.phone}
                        onChange={(e) => setTelInfo({ ...telInfo, phone: e.target.value.replace(/[^\d]/g, "").slice(0, 10) })}
                    />
                </label>

                {showTelNumpad && (
                    <div className="grid grid-cols-3 gap-y-4 gap-x-8 w-fit mx-auto my-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + num).slice(0, 10) }))}
                                className="w-20 h-20 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-full font-light text-4xl text-gray-800 flex items-center justify-center transition-all shadow-md border border-gray-100"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setTelInfo(prev => ({ ...prev, phone: prev.phone.slice(0, -1) }))}
                            className="w-20 h-20 bg-red-50 hover:bg-red-100 text-red-500 rounded-full font-light text-3xl flex items-center justify-center transition-all shadow-sm border border-red-100"
                        >
                            <Delete size={32} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + '0').slice(0, 10) }))}
                            className="w-20 h-20 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-full font-light text-4xl text-gray-800 flex items-center justify-center transition-all shadow-md border border-gray-100"
                        >
                            0
                        </button>
                        <button
                            type="button"
                            onClick={() => setTelInfo(prev => ({ ...prev, phone: '' }))}
                            className="w-20 h-20 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold text-xs uppercase flex items-center justify-center transition-all shadow-sm"
                        >
                            Effacer
                        </button>
                    </div>
                )}

                <label className="block text-left mt-2">
                    <span className="text-xs font-bold text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span>
                    <div className="flex gap-2">
                        {[0, 5, 10, 15, 20].map(fee => (
                            <button
                                key={fee}
                                onClick={() => setTelInfo({ ...telInfo, deliveryFee: fee })}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${Number(telInfo.deliveryFee) === fee ? "bg-orange-500 text-white border-orange-600 shadow-md scale-105" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                            >
                                {fee}
                            </button>
                        ))}
                    </div>
                </label>

                <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">Total commande</span>
                    <span className="text-2xl font-black text-gray-900">
                        {total + Number(telInfo.deliveryFee || 0)} <span className="text-sm">DH</span>
                    </span>
                </div>

                <button
                    onClick={handleSendWhatsappFromPOS}
                    className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    Créer Commande Tél & WhatsApp
                </button>
                </div>
            </div>
        </div>
    );
}
