const fs = require('fs');

function replaceSafely(filePath, searchLines, replacementLines) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Create clean versions ignoring spaces
    const searchClean = searchLines.join('').replace(/\s+/g, '');
    let found = false;
    
    // Simple fast search first
    if (content.includes(searchLines.join('\n'))) {
        content = content.replace(searchLines.join('\n'), replacementLines.join('\n'));
        found = true;
    } 
    // Fallback if line endings differ
    else if (content.includes(searchLines.join('\r\n'))) {
        content = content.replace(searchLines.join('\r\n'), replacementLines.join('\r\n'));
        found = true;
    }
    // Deep fallback ignoring whitespaces
    else {
        const regexStr = searchLines.map(line => line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
        const regex = new RegExp(regexStr);
        if (regex.test(content)) {
            content = content.replace(regex, replacementLines.join('\n'));
            found = true;
        }
    }
    
    if (found) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Patched ' + filePath);
    } else {
        console.log('Not found in ' + filePath);
    }
}

// 4. KitchenDashboard.jsx
replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        'const getSourceStyles = (source) => {',
        '        if (source === \'pos\') return {'
    ],
    [
        'const getSourceStyles = (source) => {',
        '        if (source === \'glovo\') return {',
        '            border: \'border-[#FFC244] hover:border-yellow-400\',',
        '            bg: \'bg-[#FFC244]/20\',',
        '            label: \'GLOVO\'',
        '        };',
        '        if (source === \'pos\') return {'
    ]
);

replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        '{o.source === \'pos\' ? \'POS\' : o.source === \'telephone\' ? \'T\u00E9L\' : \'APP\'}'
    ],
    [
        '{o.source === \'pos\' ? \'POS\' : o.source === \'telephone\' ? \'T\u00E9L\' : o.source === \'glovo\' ? \'GLOVO\' : \'APP\'}'
    ]
);

replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        '<span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${o.source === \'pos\' ? \'bg-blue-500/20 text-blue-400 border border-blue-500/30\' : o.source === \'telephone\' ? \'bg-purple-500/20 text-purple-400 border border-purple-500/30\' : \'bg-neutral-700 text-neutral-300 border border-neutral-600\'}`}>'
    ],
    [
        '<span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${o.source === \'pos\' ? \'bg-blue-500/20 text-blue-400 border border-blue-500/30\' : o.source === \'glovo\' ? \'bg-[#FFC244]/20 text-[#FFC244] border border-[#FFC244]/30\' : o.source === \'telephone\' ? \'bg-purple-500/20 text-purple-400 border border-purple-500/30\' : \'bg-neutral-700 text-neutral-300 border border-neutral-600\'}`}>'
    ]
);

// 5. PosDashboard.jsx (The missing order sorting part)
replaceSafely('src/views/PosDashboard.jsx',
    [
        'onlineOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => ('
    ],
    [
        'onlineOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => ('
    ]
);

