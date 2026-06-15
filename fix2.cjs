const fs = require('fs');
let content = fs.readFileSync('src/views/PosDashboard.jsx', 'utf8');

const brokenStr = \                            <button
                                onClick={() => { if(cart.length===0) return showNotify("Panier vide", "error"); setShowTelNumpad(false); setShowCreateGlovoModal(true); }}
                                className="w-full mt-3 bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ShoppingBag size={20} />
                                Client Glovo (Saisir Commande)
                            </button>
                        )}\;

const fixStr = \                            <button
                                onClick={() => { if(cart.length===0) return showNotify("Panier vide", "error"); setShowTelNumpad(false); setShowCreateGlovoModal(true); }}
                                className="w-full mt-3 bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ShoppingBag size={20} />
                                Client Glovo (Saisir Commande)
                            </button>
                            </>
                        )}\;

if (content.includes(brokenStr)) {
    content = content.replace(brokenStr, fixStr);
    fs.writeFileSync('src/views/PosDashboard.jsx', content);
    console.log("Fixed!");
} else {
    console.log("Not found.");
}
