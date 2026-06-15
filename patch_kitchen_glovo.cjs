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

replaceSafely('src/components/admin/KitchenDashboard.jsx',
    [
        '        if (source === \'glovo\') return {',
        '            border: \'border-[#FFC244] hover:border-yellow-400\',',
        '            bg: \'bg-[#FFC244]/20\',',
        '            label: \'GLOVO\'',
        '        };'
    ],
    [
        '        if (source === \'glovo\') return {',
        '            border: \'border-[#FFC244] hover:border-yellow-400\',',
        '            bg: \'bg-[#FFC244]/20\',',
        '            headerBg: \'bg-[#FFC244]/40\',',
        '            headerBorder: \'border-[#FFC244]/50\',',
        '            text: \'text-yellow-400\',',
        '            label: <span className="flex items-center gap-1.5"><img src="https://upload.wikimedia.org/wikipedia/en/8/82/Glovo_logo.svg" className="h-3.5 object-contain" alt="Glovo"/> GLOVO</span>',
        '        };'
    ]
);

