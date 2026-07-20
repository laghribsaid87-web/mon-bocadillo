import { doc, updateDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * Updates the status or details of an existing order.
 * @param {Object} db - Firestore database instance
 * @param {string} appId - Application ID for the Firebase path
 * @param {string} orderId - ID of the order to update
 * @param {string} currentStatus - Current status of the order
 * @param {Object} updates - Additional fields to update
 */
export const updateOrderStatus = async (db, appId, orderId, currentStatus, updates = {}) => {
  let newStatus = currentStatus;
  
  if (currentStatus === 'pending') newStatus = 'preparing';
  else if (currentStatus === 'preparing' && !updates.prepTime && updates.prepTime !== 0) newStatus = 'ready';
  
  if (updates.status) newStatus = updates.status; 

  const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
  
  await updateDoc(orderRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    ...updates
  });
};

/**
 * Creates a new POS order.
 * @param {Object} db - Firestore database instance
 * @param {string} appId - Application ID for the Firebase path
 * @param {Object} orderData - The order data to save
 */
export const createPosOrder = async (db, appId, orderData) => {
  const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
  
  const newOrder = {
    ...orderData,
    source: 'pos',
    createdAt: orderData.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(ordersRef, newOrder);
  return docRef.id;
};

/**
 * Creates or updates a custom held cart (mise en attente).
 * @param {Object} db - Firestore database instance
 * @param {string} appId - Application ID for the Firebase path
 * @param {string} heldId - ID of the held cart (or null to create)
 * @param {Object} cartData - The cart data
 */
export const saveHeldCart = async (db, appId, heldId, cartData) => {
  const heldRef = doc(db, 'artifacts', appId, 'public', 'data', 'held_carts', heldId);
  
  await setDoc(heldRef, {
    ...cartData,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
