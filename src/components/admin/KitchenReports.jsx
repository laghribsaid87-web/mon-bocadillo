import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, Search, Calendar, Clock, BarChart3, Award, Store } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function KitchenReports({ db, appId, settings }) {
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [dateRange, setDateRange] = useState({ 
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [ordersData, setOrdersData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const branches = settings?.branches || [];

    const loadData = async () => {
        setIsLoading(true);
        try {
            const startTimestamp = new Date(dateRange.start + 'T00:00:00');
            const endTimestamp = new Date(dateRange.end + 'T23:59:59');

            let q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                where('createdAt', '>=', startTimestamp),
                where('createdAt', '<=', endTimestamp)
            );

            const snap = await getDocs(q);
            const rawOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter by branch
            const filtered = selectedBranch === 'ALL' 
                ? rawOrders 
                : rawOrders.filter(o => o.nearestBranch?.id === selectedBranch);

            // Keep only ready/delivered orders that have a prepTime field
            const validOrders = filtered.filter(o => 
                (o.status === 'ready' || o.status === 'out_for_delivery' || o.status === 'delivered') && 
                o.prepTime
            );

            setOrdersData(validOrders);
        } catch (error) {
            console.error("Erreur Kitchen Reports", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (selectedBranch && dateRange.start && dateRange.end) {
            loadData();
        }
    }, [selectedBranch, dateRange]);

    const stats = useMemo(() => {
        const branchMap = {};

        ordersData.forEach(o => {
            const name = o.nearestBranch?.name || 'Inconnu';
            if (!branchMap[name]) branchMap[name] = { totalOrders: 0, totalPrepTime: 0, fastOrders: 0 };
            
            branchMap[name].totalOrders += 1;
            
            // o.prepTime is in minutes
            const prepTime = parseInt(o.prepTime) || 1;
            branchMap[name].totalPrepTime += prepTime;

            if (prepTime <= 10) {
                branchMap[name].fastOrders += 1;
            }
        });

        const arrayStats = Object.keys(branchMap).map(name => {
            const data = branchMap[name];
            return {
                name,
                totalOrders: data.totalOrders,
                avgPrepTime: data.totalOrders > 0 ? (data.totalPrepTime / data.totalOrders).toFixed(1) : 0,
                efficiency: data.totalOrders > 0 ? Math.round((data.fastOrders / data.totalOrders) * 100) : 0
            };
        });

        // Sort by totalOrders desc
        return arrayStats.sort((a, b) => b.totalOrders - a.totalOrders);
    }, [ordersData]);

    return (
        <div className="animate-in fade-in space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <ChefHat size={28} className="text-[#da291c]"/>
                        Performance Cuisine
                    </h2>
                    <p className="text-gray-500 font-medium text-sm mt-1">Statistiques des temps de préparation moyen par Agence.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <label className="block">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">Point de Vente</span>
                    <select 
                        value={selectedBranch} 
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">Tous les points de vente</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </label>
                
                <label className="block">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">Du</span>
                    <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                <label className="block">
                    <span className="text-xs font-bold text-gray-500 mb-1 block">Au</span>
                    <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500 font-bold animate-pulse">Chargement des statistiques...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {stats.map((staff, idx) => (
                        <div key={staff.name} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                            {idx === 0 && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-bl-2xl font-black text-xs flex items-center gap-1 shadow-sm"><Award size={14}/> Top Chef</div>}
                            {idx === 1 && <div className="absolute top-0 right-0 bg-gray-300 text-gray-800 px-3 py-1 rounded-bl-2xl font-black text-xs flex items-center gap-1 shadow-sm"><Award size={14}/> 2ème</div>}
                            {idx === 2 && <div className="absolute top-0 right-0 bg-amber-700 text-white px-3 py-1 rounded-bl-2xl font-black text-xs flex items-center gap-1 shadow-sm"><Award size={14}/> 3ème</div>}
                            
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">{staff.name}</h3>
                                    <p className="text-xs font-bold text-gray-500">Agence</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <span className="text-xs font-bold text-blue-500 block mb-1">Commandes Faites</span>
                                    <span className="text-2xl font-black text-blue-900">{staff.totalOrders}</span>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                                    <span className="text-xs font-bold text-orange-500 block mb-1">Moyenne (Temps)</span>
                                    <span className="text-2xl font-black text-orange-900">{staff.avgPrepTime} <span className="text-sm font-bold text-orange-600">min</span></span>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 border border-green-100 col-span-2 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-green-600 block mb-0.5">Vitesse (Efficacité)</span>
                                        <span className="text-[10px] font-medium text-green-700 block">Pourcentage en moins de 10 min</span>
                                    </div>
                                    <span className="text-2xl font-black text-green-700">{staff.efficiency}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {stats.length === 0 && (
                        <div className="col-span-3 text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
                            <ChefHat size={48} className="mx-auto text-gray-300 mb-4"/>
                            <p className="text-gray-500 font-bold text-lg">Aucune donnée trouvée pour cette période.</p>
                            <p className="text-gray-400 text-sm mt-1">Les commandes doivent être validées sur le KDS pour être comptabilisées.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
