import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './PosScreen.css';

// 🌐 SUPABASE BAĞLANTI BİLGİLERİNİZ
const SUPABASE_URL = 'https://odyrnbybxfauotoviabi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TXgWXQT9BoJ1i2EybvbLIQ_r_CjJZZm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ESC/POS Komutları (XP-P801A 32 Karakter Güvenli Mod)
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const FONT_A = ESC + '!' + '\x00'; 
const ALIGN_LEFT = ESC + 'a' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const CUT = GS + 'V' + '\x41' + '\x00';

function trToAscii(str) {
  if (!str) return '';
  return String(str)
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c');
}

function formatReceipt(satis) {
  let encoder = new TextEncoder();
  let rawText = '';
  
  rawText += INIT;
  rawText += FONT_A; 
  rawText += ALIGN_LEFT; 
  rawText += BOLD_ON + '     ADEM HAKLI BAHARAT\n' + BOLD_OFF;
  rawText += ' BILGI AMACLI MALI DEGERI YOKTUR\n';
  rawText += '------------------------------\n'; 
  rawText += `TARIH: ${satis.tarih}\n`;
  rawText += `FIS NO: #${satis.fisNo}\n`;
  rawText += `ELEMAN: ${trToAscii(satis.eleman)}\n`;
  rawText += `MUSTERI: ${trToAscii(satis.musteri)}\n`;
  rawText += '------------------------------\n';
  rawText += 'Urun       Fiyat Adet Tutar\n'; 
  
  if (satis.urunlerListesi && Array.isArray(satis.urunlerListesi)) {
    satis.urunlerListesi.forEach(u => {
      let urunAdi = trToAscii(u.ad || '').substring(0, 10).padEnd(10);
      let fiyat = String(u.fiyat).padStart(5);
      let adet = String(u.miktar).padStart(4);
      let tutar = String(u.fiyat * u.miktar).padStart(6);
      rawText += `${urunAdi} ${fiyat} ${adet} ${tutar}\n`;
    });
  }
  
  rawText += '------------------------------\n';
  rawText += BOLD_ON + `TOPLAM: ${satis.toplamTutar} TL\n` + BOLD_OFF;
  rawText += `ODENEN (Nakit): ${satis.nakitOdienen} TL\n`;
  rawText += `VERESIYE: ${satis.veresiyeYazilan} TL\n`;
  rawText += `ESKI BAKIYE: ${satis.eskiBakiye} TL\n`;
  rawText += `YENI BAKIYE: ${satis.yeniBakiye} TL\n`;
  rawText += '------------------------------\n';
  rawText += '        Yine Bekleriz...\n\n\n';
  rawText += CUT;

  return encoder.encode(rawText);
}

export default function PosScreen() {
  const [aktifSekme, setAktifSekme] = useState('satis');
  const [aktifPersonel, setAktifPersonel] = useState({ ad: "Adem Haklı", rol: "YÖNETİCİ" });

  const [musteriler, setMusteriler] = useState([]);
  const [kullanicilar, setKullanicilar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [satisHareketleri, setSatisHareketleri] = useState([]);

  const [yeniMusteri, setYeniMusteri] = useState({ ad: '', telefon: '', adres: '' });
  const [secilenCariDetay, setSecilenCariDetay] = useState(null);

  const [yeniPersonel, setYeniPersonel] = useState({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'ELEMAN' });
  const [yeniUrun, setYeniUrun] = useState({ ad: '', fiyat: '', stok: '', foto: '' });

  const [sepet, setSepet] = useState([]);
  const [secilenMusteri, setSecilenMusteri] = useState(null);
  const [odemeModalAcik, setOdemeModalAcik] = useState(false);
  const [nakitAlinan, setNakitAlinan] = useState('');
  
  const [fisModalAcik, setFisModalAcik] = useState(false);
  const [sonSatisDetayi, setSonSatisDetayi] = useState(null);

  // 🔄 VERİLERİ ÇEK (customers, users, products, sales tabloları)
  const verileriGetir = async () => {
    try {
      const { data: mData } = await supabase.from('customers').select('*');
      if (mData) setMusteriler(mData);

      const { data: kData } = await supabase.from('users').select('*');
      if (kData) setKullanicilar(kData);

      const { data: uData } = await supabase.from('products').select('*');
      if (uData) setUrunler(uData);

      const { data: sData } = await supabase.from('sales').select('*').order('id', { ascending: false });
      if (sData) setSatisHareketleri(sData);
    } catch (err) {
      console.error("Supabase veri çekme hatası:", err);
    }
  };

  useEffect(() => {
    verileriGetir();

    const kanal = supabase.channel('realtime-tum-tablolar')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        verileriGetir();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(kanal);
    };
  }, []);

  const sepeteEkle = (urun) => {
    setSepet(prev => {
      const varMi = prev.find(i => i.id === urun.id);
      if (varMi) {
        return prev.map(i => i.id === urun.id ? { ...i, miktar: i.miktar + 1 } : i);
      }
      return [...prev, { ...urun, miktar: 1 }];
    });
  };

  const sepetToplam = sepet.reduce((toplam, i) => toplam + (i.fiyat * i.miktar), 0);

  const dosyaSecildi = (e) => {
    const dosya = e.target.files[0];
    if (dosya) {
      const okuyucu = new FileReader();
      okuyucu.onloadend = () => {
        setYeniUrun(prev => ({ ...prev, foto: okuyucu.result }));
      };
      okuyucu.readAsDataURL(dosya);
    }
  };

  const satisOnayla = (tur) => {
    if (sepet.length === 0) { alert("Sepet boş!"); return; }
    if (!secilenMusteri) { alert("Lütfen müşteri seçiniz!"); return; }

    let nakit = 0;
    let veresiye = 0;

    if (tur === 'nakit') {
      nakit = sepetToplam;
    } else if (tur === 'veresiye') {
      veresiye = sepetToplam;
    } else if (tur === 'parcali') {
      nakit = parseFloat(nakitAlinan) || 0;
      veresiye = sepetToplam - nakit;
      if (veresiye < 0) { alert("Nakit tutar sepet toplamından büyük olamaz!"); return; }
    }

    const satisBilgisi = {
      fisNo: Math.floor(100000 + Math.random() * 900000),
      tarih: new Date().toLocaleString(),
      eleman: aktifPersonel.ad,
      musteri: secilenMusteri.ad,
      urunlerListesi: [...sepet],
      toplamTutar: sepetToplam,
      nakitOdienen: nakit,
      veresiyeYazilan: veresiye,
      eskiBakiye: secilenMusteri.bakiye,
      yeniBakiye: secilenMusteri.bakiye + veresiye
    };

    setSonSatisDetayi(satisBilgisi);
    setOdemeModalAcik(false);
    setFisModalAcik(true);
  };

  // 💾 SATIŞI BULUTA İŞLE
  const fisiKapatVeKaydet = async () => {
    if (!sonSatisDetayi) return;

    try {
      const guncelMusteri = musteriler.find(m => m.ad === sonSatisDetayi.musteri);
      if (guncelMusteri) {
        const { error: miktarHata } = await supabase
          .from('customers')
          .update({ bakiye: sonSatisDetayi.yeniBakiye })
          .eq('id', guncelMusteri.id);
        
        if (miktarHata) throw miktarHata;
      }

      const urunOzetMetni = sonSatisDetayi.urunlerListesi.map(u => `${u.miktar}x ${u.ad}`).join(', ');

      const yeniHareket = {
        tarih: sonSatisDetayi.tarih,
        eleman: sonSatisDetayi.eleman,
        musteri: sonSatisDetayi.musteri,
        urunlerListesi: urunOzetMetni, 
        tutar: sonSatisDetayi.toplamTutar,
        nakit: sonSatisDetayi.nakitOdienen,
        veresiye: sonSatisDetayi.veresiyeYazilan
      };

      const { error: satisHata } = await supabase.from('sales').insert([yeniHareket]);
      if (satisHata) throw satisHata;

      setSepet([]);
      setSecilenMusteri(null);
      setNakitAlinan('');
      setFisModalAcik(false);
      verileriGetir();
      alert("✅ Satış başarıyla buluta işlendi!");
    } catch (err) {
      console.error("Satış kaydetme hatası:", err);
      alert("Satış kaydedilirken hata oluştu: " + err.message);
    }
  };

  const xprinterYazdir = async () => {
    if (!sonSatisDetayi) return;
    try {
      if (!navigator.bluetooth) {
        alert('Tarayıcınız Web Bluetooth desteklemiyor!');
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let targetCharacteristic = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
            targetCharacteristic = characteristic;
            break;
          }
        }
        if (targetCharacteristic) break;
      }

      const receiptBytes = formatReceipt({
        ...sonSatisDetayi,
        musteri: trToAscii(sonSatisDetayi.musteri),
        eleman: trToAscii(sonSatisDetayi.eleman)
      });
      
      const MAX_CHUNK_SIZE = 20; 
      for (let i = 0; i < receiptBytes.length; i += MAX_CHUNK_SIZE) {
        const chunk = receiptBytes.slice(i, i + MAX_CHUNK_SIZE);
        await targetCharacteristic.writeValue(chunk);
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      alert('Fiş XP-P801A yazıcısından yazdırıldı!');
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      alert('Yazdırma hatası: ' + error.message);
    }
  };

  const cariEkstrePdfYazdir = () => { window.print(); };

  // 🏢 FİRMA / MÜŞTERİ EKLEME (customers tablosu)
  const firmaEkle = async () => {
    if (!yeniMusteri.ad) {
      alert("Lütfen firma / müşteri adı girin!");
      return;
    }
    try {
      const { error } = await supabase.from('customers').insert([{
        ad: yeniMusteri.ad,
        telefon: yeniMusteri.telefon || '-',
        adres: yeniMusteri.adres || '-',
        bakiye: 0
      }]);
      if (error) throw error;

      setYeniMusteri({ ad: '', telefon: '', adres: '' });
      verileriGetir();
      alert("✅ Müşteri başarıyla eklendi!");
    } catch (err) {
      console.error("Firma ekleme hatası:", err);
      alert("Müşteri eklenirken hata oluştu: " + err.message);
    }
  };

  // 👤 KULLANICI EKLEME (users tablosu)
  const kullaniciEkle = async () => {
    if (!yeniPersonel.adSoyad || !yeniPersonel.kullaniciAdi || !yeniPersonel.sifre) {
      alert("Lütfen tüm alanları doldurun!");
      return;
    }
    try {
      const { error } = await supabase.from('users').insert([yeniPersonel]);
      if (error) throw error;

      setYeniPersonel({ adSoyad: '', kullaniciAdi: '', sifre: '', rol: 'ELEMAN' });
      verileriGetir();
      alert("✅ Kullanıcı başarıyla eklendi!");
    } catch (err) {
      console.error("Kullanıcı ekleme hatası:", err);
      alert("Kullanıcı eklenirken hata oluştu: " + err.message);
    }
  };

  // 📦 ÜRÜN EKLEME (products tablosu)
  const urunEkle = async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat) {
      alert("Lütfen ürün adı ve fiyatı girin!");
      return;
    }
    try {
      const { error } = await supabase.from('products').insert([{
        ad: yeniUrun.ad,
        fiyat: parseFloat(yeniUrun.fiyat),
        stok: parseInt(yeniUrun.stok) || 0,
        foto: yeniUrun.foto || "https://via.placeholder.com/150"
      }]);
      if (error) throw error;

      setYeniUrun({ ad: '', fiyat: '', stok: '', foto: '' });
      verileriGetir();
      alert("✅ Ürün başarıyla eklendi!");
    } catch (err) {
      console.error("Ürün ekleme hatası:", err);
      alert("Ürün eklenirken hata oluştu: " + err.message);
    }
  };

  const firmaSil = async (id) => {
    try {
      await supabase.from('customers').delete().eq('id', id);
      verileriGetir();
    } catch (err) { console.error("Silme hatası:", err); }
  };

  const kullaniciSil = async (id) => {
    try {
      await supabase.from('users').delete().eq('id', id);
      verileriGetir();
    } catch (err) { console.error("Silme hatası:", err); }
  };

  const urunSil = async (id) => {
    try {
      await supabase.from('products').delete().eq('id', id);
      verileriGetir();
    } catch (err) { console.error("Silme hatası:", err); }
  };

  const secilenFirmaBilgisi = musteriler.find(m => m.ad === secilenCariDetay);

  return (
    <div className="otomasyon-wrapper">
      <header className="ust-header">
        <div className="logo-alan">
          <h2>ADEM HAKLI - BULUT OTOMASYON</h2>
          <span>Aktif Personel: <strong>{aktifPersonel.ad} ({aktifPersonel.rol})</strong></span>
        </div>
        <div className="menu-butonlari">
          <button className={aktifSekme === 'satis' ? 'aktif' : ''} onClick={() => setAktifSekme('satis')}>🛒 Satış Ekranı</button>
          <button className={aktifSekme === 'gunsonu' ? 'aktif' : ''} onClick={() => setAktifSekme('gunsonu')}>📊 Gün Sonu</button>
          <button className={aktifSekme === 'kullanici' ? 'aktif' : ''} onClick={() => setAktifSekme('kullanici')}>👤 Kullanıcılar</button>
          <button className={aktifSekme === 'firma' ? 'aktif' : ''} onClick={() => setAktifSekme('firma')}>🏢 Firmalar & Cari</button>
          <button className={aktifSekme === 'urun' ? 'aktif' : ''} onClick={() => setAktifSekme('urun')}>📦 Ürün & Fiyat</button>
        </div>
        <div className="personel-secici">
          <select onChange={(e) => {
            const p = kullanicilar.find(k => k.kullaniciAdi === e.target.value);
            if (p) setAktifPersonel({ ad: p.adSoyad, rol: p.rol });
          }}>
            {kullanicilar.map(k => (
              <option key={k.id} value={k.kullaniciAdi}>{k.adSoyad} ({k.rol})</option>
            ))}
          </select>
        </div>
      </header>

      <main className="icerik-alani">
        {aktifSekme === 'satis' && (
          <div className="satis-ekrani-grid">
            <div className="sol-urun-bolumu">
              <div className="musteri-secim-bar">
                <span>Müşteri Seç:</span>
                <select onChange={(e) => {
                  const m = musteriler.find(item => item.id === parseInt(e.target.value));
                  setSecilenMusteri(m || null);
                }} value={secilenMusteri ? secilenMusteri.id : ""}>
                  <option value="">-- Müşteri / Cari Seçiniz --</option>
                  {musteriler.map(m => (
                    <option key={m.id} value={m.id}>{m.ad} (Borç: {m.bakiye} TL)</option>
                  ))}
                </select>
              </div>

              <div className="urun-grid-kutu">
                {urunler.map(u => (
                  <div key={u.id} className="urun-kart-pos" onClick={() => sepeteEkle(u)}>
                    <img src={u.foto} alt={u.ad} />
                    <h4>{u.ad}</h4>
                    <span>{u.fiyat} TL</span>
                    <small>Stok: {u.stok}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="sag-sepet-bolumu">
              <h3>Hızlı Sepet</h3>
              <div className="sepet-liste-icerik">
                {sepet.length === 0 ? <p className="bos-mesaj">Sepet henüz boş.</p> : null}
                {sepet.map(i => (
                  <div key={i.id} className="sepet-satir">
                    <span>{i.ad} (x{i.miktar})</span>
                    <span>{i.fiyat * i.miktar} TL</span>
                  </div>
                ))}
              </div>

              <div className="sepet-alt-panel">
                <h4>Toplam: {sepetToplam} TL</h4>
                <button className="btn-yesil" onClick={() => satisOnayla('nakit')}>Peşin Nakit</button>
                <button className="btn-turuncu" onClick={() => satisOnayla('veresiye')}>Tamamen Veresiye</button>
                <button className="btn-mavi" onClick={() => setOdemeModalAcik(true)}>Parçalı Ödeme</button>
                <button className="btn-kirmizi" onClick={() => setSepet([])}>Sepeti Temizle</button>
              </div>
            </div>
          </div>
        )}

        {aktifSekme === 'gunsonu' && (
          <div className="yonetim-sayfasi">
            <h2>Bulut Genel Satış ve Ciro Özeti</h2>
            <div className="ozet-kartlar">
              <div className="kart mavi">Toplam Alınan Nakit: <strong>{satisHareketleri.reduce((a,b)=>a+(b.nakit||0), 0)} TL</strong></div>
              <div className="kart sari">Toplam Veresiye: <strong>{satisHareketleri.reduce((a,b)=>a+(b.veresiye||0), 0)} TL</strong></div>
              <div className="kart yesil">Toplam Ciro: <strong>{satisHareketleri.reduce((a,b)=>a+(b.tutar||0), 0)} TL</strong></div>
            </div>
            
            <h3>Buluttaki Tüm Satış Geçmişi</h3>
            <table className="veri-tablosu">
              <thead>
                <tr><th>Tarih / Saat</th><th>Eleman</th><th>Müşteri</th><th>Ürünler</th><th>Tutar</th><th>Nakit</th><th>Veresiye</th></tr>
              </thead>
              <tbody>
                {satisHareketleri.map(h => (
                  <tr key={h.id}>
                    <td>{h.tarih}</td>
                    <td>{h.eleman}</td>
                    <td>{h.musteri}</td>
                    <td>{typeof h.urunlerListesi === 'string' ? h.urunlerListesi : (Array.isArray(h.urunlerListesi) ? h.urunlerListesi.map(u => `${u.miktar}x ${u.ad}`).join(', ') : '')}</td>
                    <td>{h.tutar} TL</td>
                    <td className="text-yesil">{h.nakit} TL</td>
                    <td className="text-kirmizi">{h.veresiye} TL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aktifSekme === 'kullanici' && (
          <div className="yonetim-sayfasi">
            <h2>Kullanıcı Hesapları</h2>
            <div className="form-sirali">
              <input type="text" placeholder="Ad Soyad" value={yeniPersonel.adSoyad} onChange={e=>setYeniPersonel({...yeniPersonel, adSoyad: e.target.value})} />
              <input type="text" placeholder="Kullanıcı Adı" value={yeniPersonel.kullaniciAdi} onChange={e=>setYeniPersonel({...yeniPersonel, kullaniciAdi: e.target.value})} />
              <input type="password" placeholder="Şifre" value={yeniPersonel.sifre} onChange={e=>setYeniPersonel({...yeniPersonel, sifre: e.target.value})} />
              <select value={yeniPersonel.rol} onChange={e=>setYeniPersonel({...yeniPersonel, rol: e.target.value})}>
                <option value="ELEMAN">ELEMAN</option>
                <option value="YONETICI">YÖNETİCİ</option>
              </select>
              <button className="btn-yesil" onClick={kullaniciEkle}>Kullanıcı Ekle</button>
            </div>
            <table className="veri-tablosu">
              <thead><tr><th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Şifre</th><th>Rol</th><th>İşlem</th></tr></thead>
              <tbody>
                {kullanicilar.map(k => (
                  <tr key={k.id}>
                    <td>{k.adSoyad}</td><td>{k.kullaniciAdi}</td><td>{k.sifre}</td><td>{k.rol}</td>
                    <td><button className="btn-kirmizi-kucuk" onClick={()=>kullaniciSil(k.id)}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aktifSekme === 'firma' && (
          <div className="yonetim-sayfasi">
            <h2>Firma / Müşteri (Cari) Yönetimi</h2>
            <div className="form-sirali" style={{flexWrap: 'wrap'}}>
              <input type="text" placeholder="Firma / Müşteri Adı" value={yeniMusteri.ad} onChange={e=>setYeniMusteri({...yeniMusteri, ad: e.target.value})} />
              <input type="text" placeholder="Telefon Numarası" value={yeniMusteri.telefon} onChange={e=>setYeniMusteri({...yeniMusteri, telefon: e.target.value})} />
              <input type="text" placeholder="Adres Bilgisi" value={yeniMusteri.adres} onChange={e=>setYeniMusteri({...yeniMusteri, adres: e.target.value})} />
              <button className="btn-yesil" onClick={firmaEkle}>Firma Ekle</button>
            </div>

            <table className="veri-tablosu">
              <thead>
                <tr>
                  <th>Firma Adı</th>
                  <th>Telefon</th>
                  <th>Adres</th>
                  <th>Güncel Borç (Bakiye)</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {musteriler.map(m => (
                  <tr key={m.id}>
                    <td style={{fontWeight: 'bold', color: '#38bdf8', cursor: 'pointer'}} onClick={() => setSecilenCariDetay(m.ad)}>
                      {m.ad} 🔍 (Ekstre)
                    </td>
                    <td>{m.telefon}</td>
                    <td>{m.adres}</td>
                    <td className={m.bakiye > 0 ? "text-kirmizi" : "text-yesil"} style={{fontWeight: 'bold'}}>{m.bakiye} TL</td>
                    <td>
                      <button className="btn-mavi-kucuk" onClick={()=>setSecilenCariDetay(m.ad)} style={{marginRight: '5px'}}>Ekstre & PDF</button>
                      <button className="btn-kirmizi-kucuk" onClick={()=>firmaSil(m.id)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aktifSekme === 'urun' && (
          <div className="yonetim-sayfasi">
            <h2>Ürün Ekleme ve Fiyat Yönetimi</h2>
            <div className="form-sirali" style={{flexDirection: 'column'}}>
              <div style={{display: 'flex', gap: '10px', width: '100%'}}>
                <input type="text" placeholder="Ürün Adı" value={yeniUrun.ad} onChange={e=>setYeniUrun({...yeniUrun, ad: e.target.value})} />
                <input type="number" placeholder="Fiyat (TL)" value={yeniUrun.fiyat} onChange={e=>setYeniUrun({...yeniUrun, fiyat: e.target.value})} />
                <input type="number" placeholder="Stok" value={yeniUrun.stok} onChange={e=>setYeniUrun({...yeniUrun, stok: e.target.value})} />
              </div>
              <div style={{display: 'flex', gap: '10px', width: '100%', alignItems: 'center'}}>
                <label style={{background: '#334155', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'}}>
                  📷 Fotoğraf Seç
                  <input type="file" accept="image/*" onChange={dosyaSecildi} style={{display: 'none'}} />
                </label>
                <input type="text" placeholder="Veya Fotoğraf URL Adresi" value={yeniUrun.foto} onChange={e=>setYeniUrun({...yeniUrun, foto: e.target.value})} />
                <button className="btn-yesil" onClick={urunEkle} style={{padding: '12px 25px'}}>Ürünü Buluta Kaydet</button>
              </div>
            </div>

            <div className="urun-liste-grid">
              {urunler.map(u => (
                <div key={u.id} className="yonetim-urun-kart" style={{display: 'flex', alignItems: 'center', background: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '10px', justifyContent: 'space-between'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <img src={u.foto} alt="" style={{width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px'}} />
                    <div>
                      <h4 style={{margin: 0}}>{u.ad}</h4>
                      <p style={{margin: '5px 0 0 0', color: '#94a3b8'}}>Fiyat: {u.fiyat} TL | Stok: {u.stok}</p>
                    </div>
                  </div>
                  <button className="btn-kirmizi-kucuk" onClick={()=>urunSil(u.id)}>Sil</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {secilenCariDetay && (
        <div className="modal-arkaplan">
          <div className="modal-kutu" style={{width: '700px', maxWidth: '95%'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
              <h3>🏢 {secilenCariDetay} - Cari Hesap Ekstresi</h3>
              <button className="btn-mavi" onClick={cariEkstrePdfYazdir} style={{padding: '8px 15px', cursor: 'pointer'}}>📄 PDF Olarak İndir / Yazdır</button>
            </div>
            
            {secilenFirmaBilgisi && (
              <div style={{background: '#334155', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px'}}>
                <p><strong>Telefon:</strong> {secilenFirmaBilgisi.telefon} | <strong>Adres:</strong> {secilenFirmaBilgisi.adres}</p>
                <p><strong>Güncel Toplam Borç Bakiye:</strong> <span style={{color: '#f87171', fontWeight: 'bold'}}>{secilenFirmaBilgisi.bakiye} TL</span></p>
              </div>
            )}
            
            <div style={{maxHeight: '320px', overflowY: 'auto'}}>
              {satisHareketleri.filter(h => h.musteri === secilenCariDetay).length === 0 ? (
                <p style={{textAlign: 'center', padding: '20px', color: '#94a3b8'}}>Bu firmaya ait geçmiş işlem bulunamadı.</p>
              ) : (
                <table className="veri-tablosu" style={{fontSize: '13px'}}>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Alınan Ürünler</th>
                      <th>Tutar</th>
                      <th>Nakit Ödenen</th>
                      <th>Veresiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satisHareketleri
                      .filter(h => h.musteri === secilenCariDetay)
                      .map(h => (
                        <tr key={h.id}>
                          <td>{h.tarih}</td>
                          <td>{h.urunlerListesi}</td>
                          <td>{h.tutar} TL</td>
                          <td className="text-yesil">{h.nakit} TL</td>
                          <td className="text-kirmizi">{h.veresiye} TL</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-butonlar" style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end'}}>
              <button className="btn-kirmizi" onClick={() => setSecilenCariDetay(null)} style={{padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#fff', cursor: 'pointer'}}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {odemeModalAcik && (
        <div className="modal-arkaplan">
          <div className="modal-kutu">
            <h3>Parçalı Ödeme Girişi</h3>
            <p>Toplam Tutar: <strong>{sepetToplam} TL</strong></p>
            <label>Alınan Nakit Tutar:</label>
            <input type="number" value={nakitAlinan} onChange={e=>setNakitAlinan(e.target.value)} placeholder="Örn: 200" />
            <p>Veresiye Yazılacak Kalan: <strong>{sepetToplam - (parseFloat(nakitAlinan)||0)} TL</strong></p>
            <div className="modal-butonlar" style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
              <button className="btn-yesil" onClick={()=>satisOnayla('parcali')} style={{flex: 1, padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#fff', cursor: 'pointer'}}>Onayla</button>
              <button className="btn-kirmizi" onClick={()=>setOdemeModalAcik(false)} style={{flex: 1, padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#fff', cursor: 'pointer'}}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {fisModalAcik && sonSatisDetayi && (
        <div className="modal-arkaplan">
          <div className="fis-onizleme-kutu">
            <div className="termal-fis">
              <center>
                <h3>ADEM HAKLI BAHARAT</h3>
                <p>BİLGİ AMAÇLI MALİ DEĞERİ YOKTUR</p>
              </center>
              <hr />
              <p>TARİH: {sonSatisDetayi.tarih}</p>
              <p>FİŞ NO: #{sonSatisDetayi.fisNo}</p>
              <p>ELEMAN: {sonSatisDetayi.eleman}</p>
              <p>MÜŞTERİ: {sonSatisDetayi.musteri}</p>
              <hr />
              <table>
                <thead><tr><th>Ürün</th><th>Fiyat</th><th>Adet</th><th>Tutar</th></tr></thead>
                <tbody>
                  {sonSatisDetayi.urunlerListesi.map((item, index) => (
                    <tr key={index}>
                      <td>{item.ad}</td><td>{item.fiyat}</td><td>{item.miktar}</td><td>{item.fiyat * item.miktar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr />
              <p><strong>TOPLAM TUTAR:</strong> {sonSatisDetayi.toplamTutar} TL</p>
              <p><strong>ÖDENEN (Nakit):</strong> {sonSatisDetayi.nakitOdienen} TL</p>
              <p><strong>VERESİYE:</strong> {sonSatisDetayi.veresiyeYazilan} TL</p>
              <hr />
              <p>ESKİ BAKİYE: {sonSatisDetayi.eskiBakiye} TL</p>
              <p><strong>YENİ BAKİYE:</strong> {sonSatisDetayi.yeniBakiye} TL</p>
              <center><p>Yine Bekleriz...</p></center>
            </div>

            <div className="fis-butonlar">
              <button className="btn-mavi" onClick={xprinterYazdir}>🖨️ XP-P801A'dan Yazdır</button>
              <button className="btn-turuncu" onClick={()=>setFisModalAcik(false)}>✏️ Fişi Düzenle</button>
              <button className="btn-kirmizi" onClick={()=>setFisModalAcik(false)}>❌ Satışı İptal Et</button>
              <button className="btn-yesil" onClick={fisiKapatVeKaydet}>✔ Tamamla ve Buluta Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}