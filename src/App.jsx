import React, { useState, useEffect } from 'react';
import PosScreen from './PosScreen';
import { supabase } from './supabaseClient';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');

  // Giriş yapma fonksiyonu
  const handleLogin = async (e) => {
    e.preventDefault();
    setHata('');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('kullanici_adi', kullaniciAdi)
      .eq('sifre', sifre)
      .single();

    if (error || !data) {
      setHata('Kullanıcı adı veya şifre hatalı!');
    } else {
      setCurrentUser(data); // Başarılı giriş, kullanıcı bilgilerini kaydet
    }
  };

  // Eğer kullanıcı giriş yapmadıysa Login ekranını göster
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '300px' }}>
          <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#1f2937' }}>Adem Haklı Baharat Giriş</h2>
          {hata && <p style={{ color: 'red', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>{hata}</p>}
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Kullanıcı Adı</label>
            <input 
              type="text" 
              value={kullaniciAdi} 
              onChange={(e) => setKullaniciAdi(e.target.value)} 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px' }}
              placeholder="adem veya ahmet"
              required 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Şifre</label>
            <input 
              type="password" 
              value={sifre} 
              onChange={(e) => setSifre(e.target.value)} 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px' }}
              placeholder="123"
              required 
            />
          </div>

          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  // Giriş yapıldıysa POS ekranını ve aktif kullanıcıyı göster
  return (
    <div>
      <div style={{ background: '#1e293b', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
        <span>Aktif Kullanıcı: <b>{currentUser.ad_soyad}</b> ({currentUser.rol})</span>
        <button onClick={() => setCurrentUser(null)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
          Çıkış Yap
        </button>
      </div>
      <PosScreen currentUser={currentUser} />
    </div>
  );
}

export default App;