import { auth, db } from '../shared/firebaseClient.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, getCountFromServer, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

export function onAdminAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

export function adminLogin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function adminSignOut() {
  return signOut(auth);
}

export function adminResetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function isCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const snap = await getDoc(doc(db, 'admins', user.uid));
  return snap.exists();
}

export async function listCoachesWithCounts() {
  const snap = await getDocs(collection(db, 'coaches'));
  const coaches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Promise.all(coaches.map(async (c) => {
    const countSnap = await getCountFromServer(query(collection(db, 'students'), where('coachId', '==', c.id)));
    return { ...c, studentCount: countSnap.data().count };
  }));
}

export async function listPendingCoachInvites() {
  const snap = await getDocs(query(collection(db, 'coachInvites'), where('status', '==', 'pending')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCoachInvite(displayName) {
  const token = crypto.randomUUID();
  await setDoc(doc(db, 'coachInvites', token), {
    displayName,
    status: 'pending',
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
  return token;
}

export async function cancelCoachInvite(token) {
  await deleteDoc(doc(db, 'coachInvites', token));
}
