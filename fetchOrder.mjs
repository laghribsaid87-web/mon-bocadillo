import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBcQDTGG0vsKRtK6B233Wuc4YM1_Gta-7Y",
  authDomain: "mon-bocadillo-menu.firebaseapp.com",
  projectId: "mon-bocadillo-menu",
  storageBucket: "mon-bocadillo-menu.firebasestorage.app",
  messagingSenderId: "555581310485",
  appId: "1:555581310485:web:a754eb9fcfb9a02c45b01c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appIdPath = "mon-bocadillo-menu";

async function fetchOrder() {
  try {
    const ordersRef = collection(db, 'artifacts', appIdPath, 'public', 'data', 'orders');
    
    // Check orderNumber field
    let q = query(ordersRef, where('orderNumber', '==', '101726024436'));
    let snap = await getDocs(q);
    
    if (snap.empty) {
        q = query(ordersRef, where('orderNumber', '==', '#101726024436'));
        snap = await getDocs(q);
    }
    
    if (snap.empty) {
        const allSnap = await getDocs(query(ordersRef));
        const found = allSnap.docs.find(d => d.id.includes('101726024436') || (d.data().orderNumber && d.data().orderNumber.includes('101726024436')));
        if (found) {
            console.log(JSON.stringify(found.data(), null, 2));
        } else {
            console.log("Order not found");
        }
    } else {
        console.log(JSON.stringify(snap.docs[0].data(), null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fetchOrder();
