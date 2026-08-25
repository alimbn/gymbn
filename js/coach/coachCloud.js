// Bilerek firebaseClient.js'in İZOLE app'i DEĞİL, cloudSync.js'in DEFAULT app'i
// kullanılıyor — hoca "Kendi Antrenmanım" sekmesine geçtiğinde index.html AYNI
// oturumu görsün diye (ikinci login yok). admin.html/join.html hâlâ izole kalıyor.
import { auth, db } from '../cloudSync.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

export function onCoachAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

export function coachLogin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function coachSignOut() {
  return signOut(auth);
}

export function coachResetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function isCurrentUserCoach() {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'coaches', user.uid));
  return snap.exists();
}

export async function listMyStudents() {
  const uid = auth.currentUser.uid;
  const snap = await getDocs(query(collection(db, 'students'), where('coachId', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStudent(studentUid) {
  const snap = await getDoc(doc(db, 'students', studentUid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listPendingStudentInvites() {
  const uid = auth.currentUser.uid;
  const snap = await getDocs(query(
    collection(db, 'studentInvites'),
    where('coachId', '==', uid),
    where('status', '==', 'pending'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createStudentInvite(displayName) {
  const token = crypto.randomUUID();
  await setDoc(doc(db, 'studentInvites', token), {
    displayName,
    status: 'pending',
    coachId: auth.currentUser.uid,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
  return token;
}

export async function cancelStudentInvite(token) {
  await deleteDoc(doc(db, 'studentInvites', token));
}

/* assignProgram.js için: hedef öğrencinin users/{uid}/data/main dokümanına
   doğrudan erişim — storage.js'in yerel singleton'ından bilerek bağımsız,
   çünkü burada "bu cihazın" değil BAŞKA bir öğrencinin verisi düzenleniyor. */
export async function getStudentAppState(studentUid) {
  const snap = await getDoc(doc(db, 'users', studentUid, 'data', 'main'));
  return snap.exists() ? snap.data() : null;
}

export async function setStudentAppState(studentUid, state) {
  await setDoc(doc(db, 'users', studentUid, 'data', 'main'), { ...state, updatedAt: serverTimestamp() });
}

// Ortak egzersiz kataloğu — salt okunur (bkz. firestore.rules: hoca sadece get/list
// yapabiliyor). Yazma/etiketleme sadece admin ekranından, adminCloud.js'te.
export async function listCatalog() {
  const snap = await getDocs(collection(db, 'exerciseCatalog'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.archived);
}

/* ---------- Uygulama içi bildirimler ---------- */

// Öğrenciye "program atandı" bildirimindeki gönderen adı için.
export async function getMyCoachProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'coaches', user.uid));
  return snap.exists() ? { displayName: snap.data().displayName } : null;
}

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

// Program atama başarıyla kaydedildikten sonra assignProgram.js'ten çağrılıyor.
// Bildirim yazımı başarısız olsa bile asıl atama zaten kaydedilmiş oluyor —
// burada sessizce yutuyoruz ki çağıran taraf "atama başarısız" gibi yanlış bir
// hata göstermek zorunda kalmasın.
export async function notifyStudent(studentUid, type, message) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'notifications'), {
      recipientUid: studentUid,
      senderUid: user.uid,
      type,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Öğrenciye bildirim gönderilemedi', err);
  }
}
