export const DEFAULT_BRAND = { 
    name: "Mon Bocadillo", displayName: "<span style='color:#ffbc0d'>M</span>on <span style='color:#ffbc0d'>B</span>ocadillo", phone: "212661800728", 
    color: "#ffbc0d", textColor: "#000000", bgColor: "#f8f9fa", headerColor: "#ffffff", 
    // 🔥 ALWAN JDAD L-KDS W LES BOUTONS
    btnBgColor: "#ffbc0d", btnTextColor: "#000000", kdsBgColor: "#f1f5f9", kdsCardColor: "#ffffff", kdsBtnReadyColor: "#22c55e",
    fontFamily: "'Poppins', sans-serif", buttonStyle: "pill",
    coverUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80", 
    sliders: [
        "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
        "https://images.unsplash.com/photo-1512152272829-410a8be2a4af?w=800&q=80"
    ],
    ticketLogoUrl: "", ticketHeader: "", ticketPhone: "", ticketFooter: "Merci et bon appetit !", ticketWidth: "100%",
    promoMsg: "🔥 Livraison rapide & plats chauds ! M'rehba bikom.", theme: "premium", isAnimated: false, waInstanceId: "", waApiToken: "",   
    texts: { 
        navMenu: "VOIR MENU", navTrack: "SUIVI", navProfile: "PROFIL", btnAdd: "Ajouter", btnCart: "Panier", btnOrder: "Commander",
        adminTitle: "Idara", btnAdminOfficial: "1. Officiel", btnReady: "Prêt (Wajad)", btnAdminAskDriver: "Demander Livreur", btnOutDelivery: "En route 🛵",
        btnAcceptDriver: "Accepter", btnRejectDriver: "Rejeter", btnPickedUp: "J'ai récupéré la commande", btnDelivered: "Commande Livrée",
        // 🔥 TEXTES JDAD L-KDS W L-APP
        kdsTitle: "Cuisine (KDS)", btnKdsStart: "En préparation", btnKdsReady: "Commande Wajda", btnKdsCancel: "Annuler Cmd",
        cartEmpty: "Panier vide", orderSuccess: "Commande daret b naja7!"
    },
    messages: {
        otp: "🍔 *{brandName}*\n\nVotre code de confirmation est : *{code}*",
        newOrder: "*🍔 NOUVELLE COMMANDE #{orderNum} - {brandName}*\n\n👤 *Client:* {clientName}\n📞 *Tél:* {clientPhone}\n📍 *Adresse:* {clientAddress}\n🏢 *Point:* {branchName}{gpsLink}\n\n📋 *Détails:*\n{items}\n\n💵 *Sous-total:* {subtotal} DH\n🛵 *Livraison:* {deliveryFee} DH{discount}\n💰 *TOTAL À PAYER:* {total} DH\n\n⚙️ *Gérer la commande (Idara):*\n{adminLink}",
        standardOrder: "*🍔 Salam, m3ak {brandName} !*\n\nCommande dyalk tssajlat b naja7 ✅\n📋 *Détails:* \n{items}\n💰 *Total:* {total} DH\n⏳ *Temps estimé (Livraison):* ~{eta} min\n\n🎉 *Zidna application jdida!* Commander mnha lmera jaya bach tb3 commande dyalk (GPS) w tstafd mn les promos w points de fidélité 🎁!\n👉 *Dkhel hna:* {appUrl}",
        glovoInvite: "*🍔 Salam, m3ak {brandName} !*\n\nChokran 7it dwezti commande mn 3ndna f Glovo 🙏\n\n🎉 *Saybna Application dyalna* katsrbe l-khedma w fiha des points de fidélité w suivi GPS.\n\n🎁 Dkhel t-commander biha w dkhl code promo *GLOVO1* bach tstafd mn takhfid f awal commande dyalk!\n👉 *Lien:* {appUrl}",
        driverLocationReq: "Salam alikom, m3ak livreur dyal {brandName}.\n3afak dkhel l-had l-lien bach t-partager m3ana la position (GPS) dyalk, bach nwasal lik l-commande dyalk f a9rab wa9t.\n\n👉 *Sifet lina blastek mn hna:* {appUrl}?phone={clientPhone}",
        orderPreparing: "*🍔 Salam {clientName}!*\n\nCommande dyalk (#{orderNum}) raha katsayeb daba f l-kuzina 👨‍🍳🔥.\nNwajdouha w nsiftoha lik f a9rab wa9t!\n\n👉 *Tbe3 commande dyalk hna:* {appUrl}",
        orderOutForDelivery: "*🛵 Commande f Tri9! - {brandName}*\n\nSalam {clientName}, L-livreur {driverName} rah jayi 3andk daba b commande dyalk (#{orderNum})! 🚀\n\n📞 *Tél Livreur:* {driverPhone}\n\n👉 *Tbe3 L-livreur f GPS hna:* {appUrl}",
        orderDelivered: "*✅ Commande Livrée! - {brandName}*\n\nBseha w raha {clientName}! 🍔🍟\nNetmannaw tkon 3ejbatk l-makla.\n\n⭐ *Khli lina رأيك (Avis) dyalk hna:* {appUrl}",
        orderRejected: "*❌ Commande Annulée - {brandName}*\n\nSme7 lina {clientName}, tlaghlat commande dyalk (#{orderNum}) l-sabab: {reason}.\nIla kan chi mochkil, tawasl m3ana 3la {brandPhone}. 🙏"
    },
    animations: { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false }
};

export const PREDEFINED_INGREDIENTS = [
  "🍅 Tomate", "🧅 Oignon", "🟢 Olive", "🥬 Laitue", "🥕 Carotte", "🥔 Purée de Pommes de Terre", "🥣 Sauce Mayonnaise Maison", "🌶️ Harissa"
];

export const PREDEFINED_EXTRAS = [
  { name: '🍟 "Extra" Frites', price: 7 },
  { name: '🐟 "Extra" Thon', price: 8 },
  { name: '🥓 "Extra" Charcuterie', price: 4 },
  { name: '🧀 "Extra" Fromage', price: 3 },
  { name: '🍳 "Extra" Œuf', price: 3 }
];

export const PREDEFINED_DRINKS = [
  { name: "🥤 Pepsi", price: 10 },
  { name: "🍊 Mirinda Orange", price: 10 },
  { name: "🍋 Mirinda Citron", price: 10 },
  { name: "🍏 Mirinda Pomme", price: 10 },
  { name: "🥤 Fanta Orange", price: 10 },
  { name: "💧 Eau 50cl", price: 10 },
  { name: "🧃 Jus d'orange", price: 25 }
];

export const DEFAULT_BRANCHES = [
  { id: 'laymoune', name: 'Laymoune', lat: 33.54059, lng: -7.67574, radius: 5, phone: '', isOpen: true, managerEmail: 'laymoune@bocadillo.com' },
  { id: 'oum_rabii', name: 'Oum Rabii', lat: 33.56064, lng: -7.67306, radius: 5, phone: '', isOpen: true, managerEmail: 'oumrabii@bocadillo.com' },
  { id: 'zoubire', name: 'Zoubire', lat: 33.53999, lng: -7.68120, radius: 5, phone: '', isOpen: true, managerEmail: 'zoubire@bocadillo.com' }
];

export const DEFAULT_MENU_ITEMS = [
  { id: 'b1', name: 'Bocadillo Complet', price: 29, category: 'Bocadillos', img: '🥪', desc: 'Complet m3a kolchi' },
  { id: 'b2', name: 'Bocadillo Tangérois', price: 29, category: 'Bocadillos', img: '🌯', desc: '7ar w m9awem' },
  { id: 's1', name: 'Sandwich Américain', price: 44, category: 'Sandwichs', img: '🍔', desc: 'Viande hachée, fromage' },
  { 
    id: 'f1', 
    name: 'Formule Toi Et Moi', 
    price: 112, 
    category: 'Formules', 
    img: '👩‍❤️‍👨', 
    desc: 'Pour 2 personnes (2 Sandwichs + 1L Boisson)',
    isCombo: true,
    comboItems: [
      { id: "c1", name: "1er Complet", type: "sandwich" },
      { id: "c2", name: "2ème Complet", type: "sandwich" },
      { id: "d1", name: "Boisson 1L", type: "drink", options: ["1 Litre Coca", "1 Litre Hawaii", "1 Litre Sprite", "1 Litre Fanta"] }
    ]
  }
];

export const DEFAULT_SETTINGS = { isOpen: true, disabledItems: [], branches: DEFAULT_BRANCHES };

export const FONTS_OPTIONS = [
    { name: 'Poppins', value: "'Poppins', sans-serif" }, { name: 'Montserrat', value: "'Montserrat', sans-serif" },
    { name: 'Playfair', value: "'Playfair Display', serif" }, { name: 'Oswald', value: "'Oswald', sans-serif" }, { name: 'System Default', value: "sans-serif" }
];