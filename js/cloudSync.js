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
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
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

// Bu hesap bir hocaya bağlı öğrenciyse students/{uid} dokümanını (displayName +
// coachId) döner, değilse (bireysel kullanım, ki çoğu hesap böyle) sessizce null
// — hata fırlatmıyor.
async function getMyStudentRecord() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'students', user.uid));
  return snap.exists() ? snap.data() : null;
}

// Ayarlar ekranındaki salt-okunur "Hocan: ..." satırı için. firestore.rules'ta
// coaches/{uid}'in get izni buna göre genişletildi (bkz. isMyCoach).
export async function getMyCoachInfo() {
  try {
    const rec = await getMyStudentRecord();
    if (!rec || !rec.coachId) return null;
    const coachSnap = await getDoc(doc(db, 'coaches', rec.coachId));
    return coachSnap.exists() ? { displayName: coachSnap.data().displayName } : null;
  } catch (err) {
    console.error('Hoca bilgisi okunamadı', err);
    return null;
  }
}

// bulkAdd.js için: hesap coach-yönetimli bir öğrenciyse (students/{uid} var)
// paylaşılan admin kataloğunu döner — o zaman bulkAdd.js "kendi uydurma" isim
// kabul etmeyip zorunlu bir dropdown'a geçiyor (hoca tarafındaki AYNI mantık,
// tekrarlayan/yazım-hatalı isimler sistem genelinde çoğalmasın diye). Bireysel
// hesaplarda (students dokümanı yok) null dönüp bulkAdd.js'in eski serbest metin
// davranışını hiç değiştirmiyor. firestore.rules'ta exerciseCatalog'un get/list
// izni buna göre genişletildi (bkz. isManagedStudent).
export async function getMyCatalogIfManaged() {
  try {
    const rec = await getMyStudentRecord();
    if (!rec) return null;
    const snap = await getDocs(collection(db, 'exerciseCatalog'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.archived);
  } catch (err) {
    console.error('Katalog okunamadı', err);
    return null;
  }
}

/* ---------- Uygulama içi bildirimler ---------- */

export async function listMyNotifications() {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('recipientUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Bildirimler okunamadı', err);
    return [];
  }
}

export async function markNotificationRead(id) {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (err) {
    console.error('Bildirim okundu işaretlenemedi', err);
  }
}

// Antrenman başlat/tamamla anlarında çağrılıyor — sadece hocaya bağlı hesaplarda
// gerçekten bir şey yazıyor, bireysel kullanımda sessizce hiçbir şey yapmıyor.
// `detail` sadece olayın kendisini anlatıyor ("Anterior-1 antrenmanına başladı") —
// öğrencinin adını students/{uid}'den kendi ekliyor, çağıran taraf bilmek zorunda
// değil (personal app kendi adını hiç saklamıyor, sadece bu dokümanda duruyor).
export async function notifyMyCoach(type, detail) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const rec = await getMyStudentRecord();
    if (!rec || !rec.coachId) return;
    const name = rec.displayName || 'Öğrencin';
    await addDoc(collection(db, 'notifications'), {
      recipientUid: rec.coachId,
      senderUid: user.uid,
      type,
      message: `${name} ${detail}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Hocaya bildirim gönderilemedi', err);
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
