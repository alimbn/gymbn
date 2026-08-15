import { auth, db } from '../shared/firebaseClient.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp,
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
