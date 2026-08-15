// Admin/Hoca/Katılım sayfalarının kendi, izole Firebase bağlantısı.
// Bilerek js/cloudSync.js'i import ETMİYOR: o modül tek bir localStorage
// state'ini pull/push etmeye özel (users/{uid}/data/main), burada ise
// admins/coaches/students/*Invites gibi tamamen farklı koleksiyonlara
// doğrudan erişiliyor.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { initializeAuth, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBxS_9poiPlGAj0XuZMZ1t14a3kpCcwk0w',
  authDomain: 'gymbn-33e8f.firebaseapp.com',
  projectId: 'gymbn-33e8f',
  storageBucket: 'gymbn-33e8f.firebasestorage.app',
  messagingSenderId: '190634675327',
  appId: '1:190634675327:web:ff37d7d1ac76b10ae8434a',
};

// İsimlendirilmiş bir "secondary" app + BELLEK-İÇİ auth persistence: index.html'in
// kendi oturumuyla (browserLocalPersistence, aynı origin'de sekmeler arası paylaşılan
// localStorage/IndexedDB) KASITLI olarak hiç paylaşılmıyor. Kullanıcının sert kısıtı
// ("benim hesabım istisna kalsın") gereği — bu sayfalardan biri aynı tarayıcıda,
// hatta aynı anda başka bir sekmede açılsa bile ana uygulamanın oturumunu ne görebilir
// ne de bozabilir; sekme kapanınca (veya yenilenince) buradaki oturum sıfırlanır.
export const app = initializeApp(firebaseConfig, 'gymbn-admin-coach');
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);
