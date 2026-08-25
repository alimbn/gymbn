// Admin/Katılım sayfalarının kendi, izole Firebase bağlantısı.
// Bilerek js/cloudSync.js'i import ETMİYOR: o modül tek bir localStorage
// state'ini pull/push etmeye özel (users/{uid}/data/main), burada ise
// admins/coaches/students/*Invites gibi tamamen farklı koleksiyonlara
// doğrudan erişiliyor.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { initializeAuth, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBxS_9poiPlGAj0XuZMZ1t14a3kpCcwk0w',
  authDomain: 'gymbn-33e8f.firebaseapp.com',
  projectId: 'gymbn-33e8f',
  storageBucket: 'gymbn-33e8f.firebasestorage.app',
  messagingSenderId: '190634675327',
  appId: '1:190634675327:web:ff37d7d1ac76b10ae8434a',
};

// İsimlendirilmiş bir "secondary" Firebase app: index.html'in kendi oturumuyla
// (cloudSync.js'in DEFAULT app'i) KASITLI olarak hiç paylaşılmıyor — izolasyonu
// sağlayan bu isimlendirme (Firebase her app'in oturumunu kendi ayrı
// depolama anahtarında tutar), persistence türü değil. Kullanıcının sert kısıtı
// ("benim hesabım istisna kalsın") gereği — bu sayfalardan biri aynı tarayıcıda,
// hatta aynı anda başka bir sekmede açılsa bile ana uygulamanın oturumunu ne görebilir
// ne de bozabilir. Kalıcılık normal browserLocalPersistence — sayfa yenilenince
// oturum düşmüyor, sadece elle "Çıkış"a basınca kapanıyor (index.html'deki gibi).
export const app = initializeApp(firebaseConfig, 'gymbn-admin-coach');
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
export const db = getFirestore(app);
