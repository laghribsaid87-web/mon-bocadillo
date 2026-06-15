const fs = require('fs');
let content = fs.readFileSync('src/components/admin/KitchenDashboard.jsx', 'utf8');

content = content.replace(
`    const getSourceStyles = (source) => {
        if (source === 'pos') return {`,
`    const getSourceStyles = (source) => {
        if (source === 'glovo') return {
            border: 'border-[#FFC244] hover:border-yellow-400',
            bg: 'bg-[#FFC244]/20',
            headerBg: 'bg-[#FFC244]/40',
            headerBorder: 'border-[#FFC244]/50',
            text: 'text-yellow-400',
            label: <span className="flex items-center gap-1.5"><img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" className="h-3.5 object-contain" alt="Glovo"/> GLOVO</span>
        };
        if (source === 'pos') return {`
);

content = content.replace(
`{o.customerName || (o.source === 'table' ? 'Table ' + (o.tableNumber||'') : 'Client ' + o.source)}
                                                {o.source === 'pos' && <div className="text-[10px] bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block">Caisse</div>}`,
`{o.customerName || (o.source === 'table' ? 'Table ' + (o.tableNumber||'') : 'Client ' + o.source)}
                                                {o.source === 'pos' && <div className="text-[10px] bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm border border-blue-100 ml-2 font-black uppercase inline-block">Caisse</div>}
                                                {o.source === 'glovo' && (
                                                    <img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" alt="Glovo" className="h-3 object-contain ml-1 drop-shadow-sm" />
                                                )}`
);

fs.writeFileSync('src/components/admin/KitchenDashboard.jsx', content, 'utf8');
console.log('KitchenDashboard patched.');
