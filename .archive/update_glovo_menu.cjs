const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBcQDTGG0vsKRtK6B233Wuc4YM1_Gta-7Y',
  authDomain: 'mon-bocadillo-menu.firebaseapp.com',
  projectId: 'mon-bocadillo-menu',
  storageBucket: 'mon-bocadillo-menu.firebasestorage.app',
  messagingSenderId: '555581310485',
  appId: '1:555581310485:web:a754eb9fcfb9a02c45b01c'
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mapping = [
  { name: "Formule Gourmande", glovoName: "Formule Gourmande", glovoPrice: 99, glovoCategory: "Formules Coca Cola", glovoDesc: "2 Sandwichs mixte + 2 cornet de frites + 1 L Coca Cola" },
  { name: "Formule Toi et Moi", glovoName: "Formule Toi et Moi", glovoPrice: 89, glovoCategory: "Formules Coca Cola", glovoDesc: "2 Bocadillos complet + 2 cornet de frites + 1 L Coca Cola" },
  { name: "Bocadillo Complet", glovoName: "Bocadillo Complet ", glovoPrice: 29, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, thon, œufs, charcuterie, fromage, crudités au choix, frites." },
  { name: "Bocadillo Cheese", glovoName: "Bocadillio Cheese", glovoPrice: 24, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, thon, fromage, crudités au choix, frites." },
  { name: "Bocadillo Tangérois", glovoName: "Bocadillo Tangérois", glovoPrice: 24, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, thon, œufs, crudités au choix, frites." },
  { name: "Bocadillo Tortilla Cheese", glovoName: "Bocadillo Tortilla Cheese", glovoPrice: 24, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, tortilla , fromage, frites." },
  { name: "Bocadillo Thon", glovoName: "Bocadillo Thon", glovoPrice: 22, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, thon, crudités au choix, frites." },
  { name: "Bocadillo Tortilla", glovoName: "Bocadillo Tortilla ", glovoPrice: 22, glovoCategory: "Bocadillos", glovoDesc: "Baguette française, tortilla , crudités au choix, frites." },
  { name: "Sandwich Américain", glovoName: " Sandwiche Américain", glovoPrice: 44, glovoCategory: "Sandwiches", glovoDesc: "Baguette française, viande hachée, garniture au choix, double œuf, fromage, frites" },
  { name: "Sandwich Mixte", glovoName: "Sandwich Mixte ", glovoPrice: 40, glovoCategory: "Sandwiches", glovoDesc: "Baguette française, mixe grille, garniture au choix, frites." },
  { name: "Sandwich Viande Hachée", glovoName: "Sandwich Viande Hachée", glovoPrice: 35, glovoCategory: "Sandwiches", glovoDesc: "Baguette française, viande hachée, garniture au choix, frites." },
  { name: "Sandwich Saucisse", glovoName: "Sandwich Saucisse de Bœuf", glovoPrice: 34, glovoCategory: "Sandwiches", glovoDesc: "Baguette française, saucisse, garniture au choix, frites." },
  { name: "Sandwich Brochettes de Poulet", glovoName: "Sandwich Brochettes de Poulet", glovoPrice: 30, glovoCategory: "Sandwiches", glovoDesc: "Baguette française, brochettes de poulet, garnitures au choix, frites." },
  { name: "Jus d'orange ", glovoName: "Jus d'Orange", glovoPrice: 25, glovoCategory: "Boissons Fraîches", glovoDesc: "Jus frais" },
  { name: "Eau 50 Cl", glovoName: "Eau minérale", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Eau minérale" },
  { name: "PEPSI", glovoName: "PEPSI", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Boisson gazeuse" },
  { name: "Mirinda Orange ", glovoName: "Mirinda Orange ", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Boisson gazeuse" },
  { name: "Miranda Citron", glovoName: "Miranda Citron", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Boisson gazeuse" },
  { name: "7up", glovoName: "7up", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Boisson gazeuse" },
  { name: "Mirinda Pomme", glovoName: "Mirinda Pomme", glovoPrice: 10, glovoCategory: "Boissons Fraîches", glovoDesc: "Boisson gazeuse" }
];

async function run() {
  const configSnap = await getDoc(doc(db, 'artifacts/mon-bocadillo-menu/public/data/settings/config'));
  const currentMenu = configSnap.data().menuItems || [];
  let updatedCount = 0;
  
  const updatedMenu = currentMenu.map(item => {
    const normItemName = item.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    const mapEntry = mapping.find(m => {
        const normMapName = m.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normMapName.includes('americain') && normItemName.includes('americain')) return true;
        if (normMapName.includes('saucisse') && normItemName.includes('saucisse')) return true;
        if (normMapName.includes('viandehachee') && normItemName.includes('viandehachee')) return true;
        if (normMapName.includes('mixte') && normItemName.includes('mixte') && normItemName.includes('sand')) return true;
        if (normMapName.includes('poulet') && normItemName.includes('poulet')) return true;
        if (normMapName.includes('tortilla') && normItemName.includes('tortillia') && !normMapName.includes('cheese') && !normItemName.includes('cheese')) return true;
        if (normMapName.includes('tortillacheese') && normItemName.includes('tortilliacheese')) return true;
        if (normMapName.includes('citron') && normItemName.includes('citron')) return true;
        if (normMapName.includes('pomme') && normItemName.includes('pomme')) return true;
        if (normMapName.includes('jusdorange') && normItemName.includes('jusdorange')) return true;
        if (normMapName.includes('eauminerale') && normItemName.includes('eau')) return true;
        if (normMapName.includes('eau') && normItemName.includes('eau')) return true;
        
        return normItemName === normMapName || normItemName.includes(normMapName) || normMapName.includes(normItemName);
    });
    
    if (mapEntry) {
      item.glovoName = mapEntry.glovoName;
      item.glovoPrice = mapEntry.glovoPrice;
      item.glovoCategory = mapEntry.glovoCategory;
      item.glovoDesc = mapEntry.glovoDesc;
      updatedCount++;
      console.log('Mapped:', item.name, '->', item.glovoName, 'Price:', item.glovoPrice);
    }
    return item;
  });
  
  console.log('Successfully mapped', updatedCount, 'items.');
  
  await updateDoc(doc(db, 'artifacts/mon-bocadillo-menu/public/data/settings/config'), {
    menuItems: updatedMenu
  });
  console.log('Firestore updated.');
  process.exit(0);
}
run().catch(console.error);
