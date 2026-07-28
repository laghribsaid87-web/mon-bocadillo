# -*- coding: utf-8 -*-
import re

with open('functions/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

translation_helper = '''
const translateGlovoOption = (text) => {
    let lower = text.toLowerCase();
    
    // Ingredients
    if (lower.includes('tomate')) return '?? ?????';
    if (lower.includes('oignon')) return '?? ???';
    if (lower.includes('olive')) return '?? ?????';
    if (lower.includes('laitue') || lower.includes('salade')) return '?? ??';
    if (lower.includes('carotte')) return '?? ????';
    if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return '?? ????';
    if (lower.includes('mayonnaise') || lower.includes('mayo')) return '?? ???????';
    if (lower.includes('harissa') || lower.includes('hrissa')) return '??? ?????';
    if (lower.includes('ketchup')) return '?? ??????';
    if (lower.includes('sauce')) return '?? ???';
    if (lower.includes('fromage')) return '?? ?????';
    
    // Meats/Proteins
    if (lower.includes('viande') || lower.includes('hachée')) return '?? ????? ???????';
    if (lower.includes('poulet')) return '?? ??????';
    if (lower.includes('oeuf') || lower.includes('œuf')) return '?? ?????';
    if (lower.includes('thon')) return '?? ?????';
    if (lower.includes('charcuterie')) return '?? ???????';
    if (lower.includes('saucisse')) return '?? ???????';

    return text;
};

'''

# Insert the helper before the webhook
if 'const translateGlovoOption =' not in content:
    content = content.replace('exports.glovoWebhookOrderDispatch = functions.https.onRequest(async (req, res) => {', translation_helper + 'exports.glovoWebhookOrderDispatch = functions.https.onRequest(async (req, res) => {')

# Now patch the attribute parsing
old_parsing = '''                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }'''

new_parsing = '''                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            const rawSans = attr.name.replace(/sans/i, '').trim();
                            selectedSans.push(translateGlovoOption(rawSans));
                        } else {
                            // Extract possible extra prefix (like 'extra' or 'ajout') to keep name clean if needed, 
                            // or just pass to translateGlovoOption which handles the raw name.
                            let rawExtra = attr.name.replace(/extra/i, '').replace(/ajout/i, '').trim();
                            // Some attributes might just be 'Fromage' without 'Extra', so we use rawExtra if not empty else attr.name
                            if (!rawExtra) rawExtra = attr.name.trim();
                            selectedExtras.push({ name: translateGlovoOption(rawExtra), price: (attr.price || 0) / 100 });
                        }
                    });
                }'''

content = content.replace(old_parsing, new_parsing)

with open('functions/index.js', 'w', encoding='utf-8') as f:
    f.write(content)
