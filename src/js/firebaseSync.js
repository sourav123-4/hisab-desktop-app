import { 
  db, 
  auth,
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from './firebase.js';

let isCloudConnected = false;
let syncListeners = [];

export function onCloudStatusChange(callback) {
  if (typeof callback === 'function') {
    syncListeners.push(callback);
    callback(isCloudConnected);
  }
}

function updateCloudStatus(status) {
  isCloudConnected = status;
  syncListeners.forEach(cb => cb(isCloudConnected));
}

// 1. Push Document to Firestore
export async function saveToCloud(collectionName, id, data) {
  if (!db || !collectionName || !id) return false;
  try {
    const docRef = doc(db, collectionName, String(id));
    const currentUid = auth && auth.currentUser ? auth.currentUser.uid : 'anonymous';
    const payload = {
      ...data,
      userId: data.userId || currentUid,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    updateCloudStatus(true);
    console.log(`[Firestore Push] Synced ${collectionName}/${id}`);
    return { success: true };
  } catch (err) {
    console.error(`[Firestore Push Failed] ${collectionName}/${id}:`, err);
    updateCloudStatus(false);
    return { success: false, error: err };
  }
}

// 2. Delete Document from Firestore
export async function deleteFromCloud(collectionName, id) {
  if (!db || !collectionName || !id) return false;
  try {
    const docRef = doc(db, collectionName, String(id));
    await deleteDoc(docRef);
    updateCloudStatus(true);
    console.log(`[Firestore Delete] Deleted ${collectionName}/${id}`);
    return true;
  } catch (err) {
    console.warn(`[Firestore Delete Failed] ${collectionName}/${id}:`, err.message);
    updateCloudStatus(false);
    return false;
  }
}

// 3. Real-time Subscription to Firestore Collections
export function subscribeToCloudCollection(collectionName, onUpdateCallback) {
  if (!db || !collectionName) return () => {};
  try {
    const colRef = collection(db, collectionName);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      updateCloudStatus(true);
      const items = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      if (typeof onUpdateCallback === 'function') {
        onUpdateCallback(items);
      }
    }, (error) => {
      console.warn(`[Firestore Subscription Error] ${collectionName}:`, error.message);
      updateCloudStatus(false);
    });
    return unsubscribe;
  } catch (err) {
    console.warn(`[Firestore Subscribe Failed] ${collectionName}:`, err.message);
    updateCloudStatus(false);
    return () => {};
  }
}

// 4. Batch Sync Full Data Payload to Firestore
export async function fullSyncToCloud(storeData) {
  if (!db || !storeData) return false;
  try {
    // Sync Transactions
    if (Array.isArray(storeData.transactions)) {
      for (const tx of storeData.transactions) {
        await saveToCloud('transactions', tx.id, tx);
      }
    }
    // Sync Salary
    if (Array.isArray(storeData.salary)) {
      for (const sal of storeData.salary) {
        await saveToCloud('salary', sal.id, sal);
      }
    }
    // Sync Loans
    if (Array.isArray(storeData.loans)) {
      for (const loan of storeData.loans) {
        await saveToCloud('loans', loan.id, loan);
      }
    }
    // Sync Investments
    if (Array.isArray(storeData.investments)) {
      for (const inv of storeData.investments) {
        await saveToCloud('investments', inv.id, inv);
      }
    }
    // Sync Budgets
    if (storeData.budgets) {
      await saveToCloud('settings', 'budgets', { categories: storeData.budgets });
    }
    updateCloudStatus(true);
    return true;
  } catch (err) {
    console.error('[Firestore Full Sync Error]', err);
    updateCloudStatus(false);
    return false;
  }
}
