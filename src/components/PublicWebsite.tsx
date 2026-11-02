import React, { useState } from 'react';
import { Neighborhood, Announcement, Complaint } from '../types/index.ts';
import { categoriesMeta } from '../lib/translations.ts';
import {
  Building2,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  HelpCircle,
  FileText,
  Phone,
  Mail,
  Users,
  Search,
} from 'lucide-react';

interface PublicWebsiteProps {
  neighborhoods: Neighborhood[];
  announcements: Announcement[];
  complaints: Complaint[];
  onOpenMiniApp: () => void;
  onSelectRole: (role: any) => void;
  onOpenComplaint: (complaint: Complaint) => void;
}

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  neighborhoods,
  announcements,
  complaints,
  onOpenMiniApp,
  onSelectRole,
  onOpenComplaint,
}) => {
  const [activeSection, setActiveSection] = useState<'home' | 'about' | 'how' | 'directory' | 'announcements' | 'faq' | 'contact' | 'terms' | 'privacy'>('home');
  const [directorySearch, setDirectorySearch] = useState('');

  const filteredNeighborhoods = neighborhoods.filter((n) => {
    if (!directorySearch) return true;
    const q = directorySearch.toLowerCase();
    return n.nameUz.toLowerCase().includes(q) || (n.address && n.address.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-12">
      {/* HERO SECTION */}
      {activeSection === 'home' && (
        <>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-[#16834B] to-emerald-950 text-white p-8 md:p-14 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-100 border border-white/15">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Qarshi shahri, Vatanparvar MFY raqamli boshqaruvi</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-balance">
                O'zbekiston mahallalari uchun yagona raqamli boshqaruv platformasi
              </h1>

              <p className="text-sm md:text-base text-emerald-100/90 leading-relaxed max-w-2xl">
                Fuqarolar murojaatlari, kommunal xizmat ustalari va mahalla raisi bir tizimda. Telegram boti va Mini App orqali uydan chiqmasdan ariza yuboring, ijro jarayonini fotosuratlar bilan kuzatib boring.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onOpenMiniApp}
                  className="px-6 py-3.5 bg-white text-[#16834B] font-bold text-sm rounded-xl shadow-md hover:bg-emerald-50 transition-transform active:scale-95 flex items-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Telegram Mini Appni ochish
                </button>
                <button
                  onClick={() => setActiveSection('how')}
                  className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur-sm border border-white/20 transition-colors flex items-center gap-2"
                >
                  Qanday ishlaydi
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          {/* Quick Metrics Bar */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Boshqaruv qamrovi</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">14 ta</div>
              <div className="text-xs text-slate-400 mt-0.5">Viloyat va respublika</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Raqamli mahallalar</div>
              <div className="text-2xl font-bold text-[#16834B] mt-1 font-mono">{neighborhoods.length} ta</div>
              <div className="text-xs text-emerald-600 mt-0.5">Pilot: Qarshi shahri</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Hal etilish tezligi</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">18.5 soat</div>
              <div className="text-xs text-slate-400 mt-0.5">O'rtacha javob vaqti</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Aholi qoniqishi</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">94%</div>
              <div className="text-xs text-emerald-600 mt-0.5">5 yulduzli baholashlar</div>
            </div>
          </section>

          {/* Problem Categories Covered */}
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Mahalla bo'yicha qamrab olingan sohalar</h2>
              <p className="text-xs text-slate-500 mt-1">Har qanday maishiy va ijtimoiy muammoni tezkor yechish imkoniyati</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(categoriesMeta).map(([k, meta]) => (
                <div key={k} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-[#16834B] transition-colors shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16834B] flex items-center justify-center font-bold text-xs mb-2">
                    ✓
                  </div>
                  <div className="font-semibold text-xs text-slate-900">{meta.uz}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Public Announcements Preview */}
          <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Rasmiy mahalla xabarnomalari</h3>
                <p className="text-xs text-slate-500">Qarshi shahri, Vatanparvar MFY fuqarolari uchun</p>
              </div>
              <button
                onClick={() => setActiveSection('announcements')}
                className="text-xs text-[#16834B] font-semibold hover:underline"
              >
                Barcha e'lonlar →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.slice(0, 2).map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="text-[11px] font-semibold text-emerald-700">Mahalla raisi devoni</div>
                  <h4 className="font-bold text-xs text-slate-900">{a.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{a.content}</p>
                  <div className="text-[10px] text-slate-400 font-mono pt-1">
                    {new Date(a.publishedAt).toLocaleDateString('uz-UZ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* HOW IT WORKS */}
      {activeSection === 'how' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900">Mahalla24 qanday ishlaydi?</h2>
            <p className="text-xs text-slate-500 mt-1">
              Fuqaro arizasidan tortib muammoning to'liq hal etilishigacha bo'lgan 5 bosqichli shaffof zanjir:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Ariza yuborish',
                desc: 'Fuqaro Telegram bot, Mini App yoki veb-sayt orqali fotosurat va GPS lokatsiyani biriktirib murojaat qoldiradi.',
              },
              {
                step: '02',
                title: 'Rais qabuli',
                desc: 'Mahalla raisi o\'z kabinetida yangi murojaatni qabul qilib oladi va unga dastlabki baho beradi.',
              },
              {
                step: '03',
                title: 'Ustaga topshirish',
                desc: 'Muammo sohasiga qarab (suv, elektr, yo\'l) mas\'ul mutaxassisga muddat va ko\'rsatma bilan biriktiriladi.',
              },
              {
                step: '04',
                title: 'Ijro va dalil',
                desc: 'Usta joyiga borib muammoni bartaraf etadi va platformaga natija fotosurati hamda tushuntirish kiritadi.',
              },
              {
                step: '05',
                title: 'Aholi baholashi',
                desc: 'Fuqaroga Telegram orqali xabar boradi. Fuqaro bajarilgan ish sifatini 1 dan 5 gacha baholaydi.',
              },
            ].map((s) => (
              <div key={s.step} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-xl font-bold font-mono text-[#16834B]">{s.step}</span>
                <h3 className="font-bold text-xs text-slate-900">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-center">
            <button
              onClick={() => setActiveSection('home')}
              className="px-6 py-2.5 bg-[#16834B] text-white text-xs font-semibold rounded-xl hover:bg-emerald-700"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        </section>
      )}

      {/* ABOUT */}
      {activeSection === 'about' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-2xl font-bold text-slate-900">Mahalla24 platformasi haqida</h2>
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong>Mahalla24</strong> — O'zbekiston mahallalari tizimini raqamlashtirish, fuqarolar bilan mahalla idoralari o'rtasidagi muloqotni shaffof, tezkor va qulay qilish uchun maxsus ishlab chiqilgan ko'p ijarachili (multi-tenant) platformadir.
            </p>
            <p>
              Tizim bir vaqtning o'zida bir nechta mustaqil foydalanuvchilar qatlamiga xizmat ko'rsatadi: oddiy mahalla fuqarolari, mahalla raislari, kommunal xizmat ustalari, tuman hokimligi mutasaddilari hamda viloyat va respublika bosh ma'murlari.
            </p>
            <p>
              Tizim hozirda <strong>Qashqadaryo viloyati Qarshi shahridagi "Vatanparvar" MFY</strong>da to'liq yo'lga qo'yilgan bo'lib, kelgusida butun respublika mahallalariga kengaytiriladi.
            </p>
          </div>
        </section>
      )}

      {/* DIRECTORY */}
      {activeSection === 'directory' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Mahallalar reyestri</h2>
              <p className="text-xs text-slate-500 mt-1">Platformaga ulangan mahallalar ro'yxati va aloqa ma'lumotlari</p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Mahalla nomi bo'yicha qidiruv..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredNeighborhoods.map((n) => (
              <div key={n.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">{n.nameUz}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-[#16834B]">
                    {n.subscriptionStatus}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Rais: <span className="font-semibold text-slate-900">{n.chairmanName || 'Tayinlanmagan'}</span></div>
                  <div>Telefon: <span className="font-semibold text-slate-900">{n.phone || '+998 75 221-45-88'}</span></div>
                  <div>Manzil: <span className="text-slate-500">{n.address || 'Qarshi shahri'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ANNOUNCEMENTS */}
      {activeSection === 'announcements' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Mahalla e'lonlari</h2>
          <div className="space-y-4">
            {announcements.map((a) => (
              <div key={a.id} className="p-5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-emerald-800">Qarshi shahri, Vatanparvar MFY</span>
                  <span>{new Date(a.publishedAt).toLocaleString('uz-UZ')}</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">{a.title}</h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{a.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {activeSection === 'faq' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Ko'p beriladigan savollar (FAQ)</h2>
          <div className="space-y-3">
            {[
              {
                q: 'Mahalla One tizimida ariza qoldirish bepulmi?',
                a: 'Ha, fuqarolar uchun shikoyat va taklif yuborish, e\'lonlarni kuzatish mutlaqo bepul.',
              },
              {
                q: 'Telegram boti orqali qanday ro\'yxatdan o\'tiladi?',
                a: 'Telegramda @mahallaone_bot ga kirib, /start buyrug\'ini yuborasiz va mahalla kodingizni kiritasiz.',
              },
              {
                q: 'Begona odamlar mening arizamni ko\'ra oladimi?',
                a: 'Yo\'q. Tizimda qat\'iy ko\'p ijarachilik (multi-tenant) va RBAC himoyasi o\'rnatilgan. Har bir fuqaro faqat o\'z murojaatini ko\'ra oladi.',
              },
              {
                q: 'Murojaat ko\'rib chiqilish muddati qancha?',
                a: 'Amaldagi me\'yorlarga asosan har bir ariza 24 soat ichida mas\'ul ustaga biriktirilishi shart.',
              },
            ].map((faq, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                <h3 className="font-bold text-xs text-slate-900">{faq.q}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTACT */}
      {activeSection === 'contact' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Bog'lanish va Qabul</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#16834B] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Mahalla idorasi manzili:</div>
                  <div>Qarshi shahri, Mustaqillik shoh ko'chasi 14-uy, Vatanparvar MFY</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#16834B] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Ishonch telefoni:</div>
                  <div>+998 75 221-45-88 / +998 90 123 45 67</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#16834B] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Elektron pochta:</div>
                  <div>aloqa@mahalla24.uz / qarshi.vatanparvar@mahalla24.uz</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-900 mb-2">Rais qabul kunlari:</div>
              <div className="text-slate-600 space-y-1">
                <div>• Dushanba: 09:00 - 12:00</div>
                <div>• Chorshanba: 14:00 - 17:00</div>
                <div>• Juma: 09:00 - 12:00</div>
                <div className="text-emerald-700 font-semibold pt-2">Elektron murojaatlar 24/7 qabul qilinadi.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PRIVACY POLICY */}
      {activeSection === 'privacy' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-4 text-xs text-slate-600 leading-relaxed">
          <h2 className="text-xl font-bold text-slate-900">Maxfiylik Siyosati (Privacy Policy)</h2>
          <p>
            Mahalla24 platformasi fuqarolarning shaxsiy ma'lumotlarini O'zbekiston Respublikasining "Shaxsiy ma'lumotlar to'g'risida"gi qonuniga muvofiq qat'iy himoya qiladi.
          </p>
          <p>
            Fuqaroning telefon raqami, aniq yashash manzili va yuborgan murojaatlari ochiq tarmoqda chop etilmaydi, faqatgina murojaatni ijro etuvchi mahalla xodimi va raisiga ko'rinadi.
          </p>
        </section>
      )}

      {/* TERMS OF SERVICE */}
      {activeSection === 'terms' && (
        <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-4 text-xs text-slate-600 leading-relaxed">
          <h2 className="text-xl font-bold text-slate-900">Foydalanish Shartlari (Terms of Service)</h2>
          <p>
            Platformadan foydalanuvchilar haqiqatga to'g'ri kelmaydigan, birovning sha'niga teguvchi yoki asossiz shikoyatlar yubormaslik majburiyatini oladilar.
          </p>
          <p>
            Barcha murojaatlar audit xronologiyasida saqlanadi va huquqiy javobgarlikka asos bo'ladi.
          </p>
        </section>
      )}

      {/* Internal Navigation Anchor Links */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-4 border-t border-slate-200">
        <button onClick={() => setActiveSection('about')} className="hover:text-slate-900">Platforma haqida</button>
        <span>·</span>
        <button onClick={() => setActiveSection('how')} className="hover:text-slate-900">Qanday ishlaydi</button>
        <span>·</span>
        <button onClick={() => setActiveSection('directory')} className="hover:text-slate-900">Mahallalar reyestri</button>
        <span>·</span>
        <button onClick={() => setActiveSection('announcements')} className="hover:text-slate-900">E'lonlar</button>
        <span>·</span>
        <button onClick={() => setActiveSection('faq')} className="hover:text-slate-900">FAQ</button>
        <span>·</span>
        <button onClick={() => setActiveSection('contact')} className="hover:text-slate-900">Aloqa</button>
        <span>·</span>
        <button onClick={() => setActiveSection('privacy')} className="hover:text-slate-900">Maxfiylik siyosati</button>
        <span>·</span>
        <button onClick={() => setActiveSection('terms')} className="hover:text-slate-900">Foydalanish shartlari</button>
      </div>
    </div>
  );
};
