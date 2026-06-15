const fs = require('fs');
let p = fs.readFileSync('changes.patch', 'utf8');

const map = {
    'TÃ©lÃ©phone': 'Téléphone',
    'PrÃªte': 'Prête',
    'AssignÃ©': 'Assigné',
    'lancÃ©e': 'lancée',
    'paramÃ¨tre': 'paramètre',
    'acceptÃ©e': 'acceptée',
    'marquÃ©e': 'marquée',
    'âœ…': '✅',
    'ðŸ“ž': '📞',
    'ðŸ“±': '📱',
    'ðŸ“ ': '📌',
    'ðŸ”¥': '🔥',
    'ðŸ’°': '💰',
    'ðŸ’³': '💳',
    'ðŸŸ¢': '🟢',
    'ðŸ”µ': '🔵',
    'TÃ©l': 'Tél',
    'succÃ¨s': 'succès',
    'sauvegardÃ©es': 'sauvegardées',
    'EnregistrÃ©': 'Enregistré',
    'chargÃ©e': 'chargée',
    'ProblÃ¨mes': 'Problèmes',
    'prÃ©paration': 'préparation',
    'Ã©': 'é',
    'Ãª': 'ê',
    'Ã¨': 'è',
    'Ã ': 'à',
    'Ã§': 'ç',
    'Ã‰': 'É'
};

for (const [k, v] of Object.entries(map)) {
    p = p.split(k).join(v);
}

// Special case for POSDashboard BOM
p = p.replace('+﻿import React', '+import React');

fs.writeFileSync('changes_fixed.patch', p, 'utf8');
console.log('Fixed patch');
