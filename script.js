const fs = require('fs');
const path = 'c:/Users/pc/Desktop/mon-bocadillo/mon-bocadillo/src/views/ClientView.jsx';
const content = fs.readFileSync(path, 'utf-8');
const isWindows = content.includes('\r\n');
const lines = content.split(/\r?\n/);

const newLine = `               <div className={\`bg-white p-5 \${btnRadius} shadow-sm border border-black/5 text-left relative overflow-hidden\`}><div className={\`absolute top-0 right-0 bg-blue-100 text-blue-800 text-[9px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-blue-200\`}>POINT: {info.nearestBranch?.name}</div><h3 className="font-black text-[11px] uppercase tracking-widest mb-3 border-b border-gray-50 pb-2 opacity-50">Infos Livraison</h3><div className={\`w-full border-2 p-5 rounded-2xl flex flex-col gap-4 shadow-sm transition-all \${info.lat || info.nearestBranch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-300'}\`}><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="text-left flex-1"><p className="font-black text-gray-800 text-base flex items-center gap-2"><Navigation size={18} className={info.lat ? "text-green-600" : "text-red-500"}/> Localisation Exacte <span className="text-red-500">*</span></p><p className={\`text-xs font-bold mt-1.5 \${info.lat ? 'text-green-700' : info.nearestBranch ? 'text-blue-600' : 'text-red-500'}\`}>{info.lat ? \`✅ GPS: \${info.nearestBranch?.name}\` : info.nearestBranch ? \`✅ Manuel: \${info.nearestBranch?.name}\` : "❌ Darouri t7ded blastek"}</p></div><button onClick={handleGps} disabled={isG} className={\`px-5 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap \${info.lat ? 'bg-green-200 text-green-800' : 'bg-red-600 text-white shadow-xl hover:bg-red-700 active:scale-95 animate-pulse'}\`}>{isG ? 'Kantsnaw...' : info.lat ? 'Mbedel' : '📍 7ded GPS'}</button></div>{info.gpsFailed && (<div className="mt-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm animate-in slide-in-from-top-2"><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Choix Manuel</p><select className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-sm text-gray-800 mb-3 focus:border-black" value={info.nearestBranch?.id || ''} onChange={(e) => { const branch = activeBranches.find(b => b.id === e.target.value); setInfo(prev => ({ ...prev, nearestBranch: branch, lat: null, lng: null })); }}><option value="" disabled>Khtar a9rab ma7al...</option>{activeBranches.map(b => <option key={b.id} value={b.id} disabled={b.isOpen === false}>{b.name}</option>)}</select><input type="url" placeholder="Coller Lien Google Maps (Facultatif)" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:border-black text-sm font-bold text-gray-800" value={info.mapsLink || ''} onChange={(e) => setInfo(prev => ({ ...prev, mapsLink: e.target.value }))} /></div>)}</div></div>`;

if (lines[190] && lines[190].includes('Infos Livraison')) {
    lines[190] = newLine;
    fs.writeFileSync(path, lines.join(isWindows ? '\r\n' : '\n'));
    console.log('Successfully replaced line 191.');
} else {
    console.log('Error: Line 191 does not match expected content.');
    if (lines[190]) {
        console.log('Actual content: ' + lines[190].substring(0, 100));
    }
}
