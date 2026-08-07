import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBxS_9poiPlGAj0XuZMZ1t14a3kpCcwk0w',
  authDomain: 'gymbn-33e8f.firebaseapp.com',
  projectId: 'gymbn-33e8f',
  storageBucket: 'gymbn-33e8f.firebasestorage.app',
  messagingSenderId: '190634675327',
  appId: '1:190634675327:web:ff37d7d1ac76b10ae8434a',
};

const LOCAL_STORAGE_KEY = 'gymbnData'; // storage.js'deki STORAGE_KEY ile aynı tutulmalı

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Auth kalıcılığı ayarlanamadı', err);
});

let pullCompleted = false;
let pushTimer = null;

function userDocRef() {
  const user = auth.currentUser;
  if (!user) return null;
  return doc(db, 'users', user.uid, 'data', 'main');
}

export function onAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Firestore'daki doküman yerelden yeniyse localStorage'ı üzerine yazıp reload eder.
 * Dönüş değeri true ise reload zaten tetiklendi, çağıran initApp() çağırmamalı.
 */
export async function pullRemoteIfNewer(localUpdatedAt) {
  const ref = userDocRef();
  if (!ref) {
    pullCompleted = true;
    return false;
  }
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      pullCompleted = true;
      return false;
    }
    const remote = snap.data();
    const remoteUpdatedAt = remote.updatedAt && typeof remote.updatedAt.toMillis === 'function'
      ? remote.updatedAt.toMillis()
      : 0;
    if (remoteUpdatedAt > (localUpdatedAt || 0)) {
      const { updatedAt, ...rest } = remote;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...rest, updatedAt: remoteUpdatedAt }));
      pullCompleted = true;
      location.reload();
      return true;
    }
    pullCompleted = true;
    return false;
  } catch (err) {
    console.error('Bulut verisi çekilemedi', err);
    pullCompleted = true;
    return false;
  }
}

/** storage.js'in saveState()'i her çağrıldığında tetiklenir; kendi içinde ayrı debounce'u var. */
export function scheduleCloudPush(state) {
  if (!pullCompleted) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(state), 1500);
}

async function pushNow(state) {
  const ref = userDocRef();
  if (!ref) return;
  try {
    await setDoc(ref, { ...state, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Bulut senkronu başarısız', err);
  }
}
