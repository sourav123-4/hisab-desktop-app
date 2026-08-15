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
let syncListeners: Array<(status: boolean) => void> = [];

export function onCloudStatusChange(callback: (status: boolean) => void): void {
  if (typeof callback === 'function') {
    syncListeners.push(callback);
    callback(isCloudConnected);
  }
}

function updateCloudStatus(status: boolean): void {
  isCloudConnected = status;
  syncListeners.forEach(cb => cb(isCloudConnected));
}

function getSafeUid(): string | null {
  const user = auth?.currentUser;
  if (user && !user.isAnonymous && user.uid) {
    return String(user.uid).replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('daily_hisab_last_known_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.uid) {
          return String(parsed.uid).replace(/[^a-zA-Z0-9_-]/g, '_');
        }
      }
    }
  } catch (e) {}
  return null;
}

function getCollectionRef(collectionName: string) {
  if (!db) return null;
  const safeUid = getSafeUid();
  if (safeUid) {
    return collection(db, 'users', safeUid, collectionName);
  }
  return collection(db, collectionName);
}

function getDocRef(collectionName: string, id: string) {
  if (!db || !collectionName || !id) return null;
  const safeUid = getSafeUid();
  const safeId = String(id).replace(/\//g, '_');
  if (safeUid) {
    return doc(db, 'users', safeUid, collectionName, safeId);
  }
  return doc(db, collectionName, safeId);
}

export async function saveToCloud(collectionName: string, id: string, data: any): Promise<any> {
  const docRef = getDocRef(collectionName, id);
  if (!docRef) return false;
  try {
    const currentUid = auth && auth.currentUser ? auth.currentUser.uid : 'anonymous';
    const payload = {
      ...data,
      userId: currentUid,
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

export async function deleteFromCloud(collectionName: string, id: string): Promise<boolean> {
  const docRef = getDocRef(collectionName, id);
  if (!docRef) return false;
  try {
    await deleteDoc(docRef);
    updateCloudStatus(true);
    console.log(`[Firestore Delete] Deleted ${collectionName}/${id}`);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore Delete Failed] ${collectionName}/${id}:`, err.message);
    updateCloudStatus(false);
    return false;
  }
}

export function subscribeToCloudCollection(collectionName: string, onUpdateCallback: (items: any[]) => void): () => void {
  const colRef = getCollectionRef(collectionName);
  if (!colRef) return () => {};
  try {
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      updateCloudStatus(true);
      const items: any[] = [];
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
  } catch (err: any) {
    console.warn(`[Firestore Subscribe Failed] ${collectionName}:`, err.message);
    updateCloudStatus(false);
    return () => {};
  }
}

export async function fullSyncToCloud(storeData: any): Promise<boolean> {
  if (!db || !storeData) return false;
  try {
    if (Array.isArray(storeData.transactions)) {
      for (const tx of storeData.transactions) {
        await saveToCloud('transactions', tx.id, tx);
      }
    }
    if (Array.isArray(storeData.salary)) {
      for (const sal of storeData.salary) {
        await saveToCloud('salary', sal.id, sal);
      }
    }
    if (Array.isArray(storeData.loans)) {
      for (const loan of storeData.loans) {
        await saveToCloud('loans', loan.id, loan);
      }
    }
    if (Array.isArray(storeData.investments)) {
      for (const inv of storeData.investments) {
        await saveToCloud('investments', inv.id, inv);
      }
    }
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
