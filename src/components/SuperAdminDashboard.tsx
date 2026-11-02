import React, { useState } from 'react';
import { Region, District, Neighborhood, User, Complaint, SubscriptionPlan } from '../types/index.ts';
import {
  Globe,
  MapPin,
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  Plus,
  RefreshCw,
  Lock,
  FileCheck2,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  regions: Region[];
  districts: District[];
  neighborhoods: Neighborhood[];
  users: User[];
  complaints: Complaint[];
  plans: SubscriptionPlan[];
  onCreateRegion: (data: { nameUz: string; code: string }) => Promise<void>;
  onCreateDistrict: (data: { regionId: string; nameUz: string; code: string }) => Promise<void>;
  onCreateNeighborhood: (data: any) => Promise<void>;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  regions,
  districts,
  neighborhoods,
  users,
  complaints,
  plans,
  onCreateRegion,
  onCreateDistrict,
  onCreateNeighborhood,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'geography' | 'users' | 'subscriptions'>('overview');

  // Region modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');

  // District modal
  const [showDistModal, setShowDistModal] = useState(false);
  const [distRegionId, setDistRegionId] = useState(regions[0]?.id || '');
  const [distName, setDistName] = useState('');
  const [distCode, setDistCode] = useState('');

  const handleRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regCode) return;
    await onCreateRegion({ nameUz: regName, code: regCode });
    setRegName('');
    setRegCode('');
    setShowRegModal(false);
  };

  const handleDistrictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distName || !distCode) return;
    await onCreateDistrict({ regionId: distRegionId, nameUz: distName, code: distCode });
    setDistName('');
    setDistCode('');
    setShowDistModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Mahalla24 Bosh Administrator Boshqaruv Markazi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">O'zbekiston Respublikasi Mahallalari Ekotizimi</h1>
          <p className="text-xs text-slate-400 mt-1">
            Barcha viloyatlar, tumanlar va mahallalar ma'lumotlar bazasi hamda xavfsizlik nazorati
          </p>
        </div>

      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Viloyatlar / Hududlar</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{regions.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">14 ta hudud qamrovi</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Tuman va shaharlar</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{districts.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Qarshi, Shahrisabz va b.</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Raqamlashgan mahallalar</div>
          <div className="text-2xl font-bold text-[#16834B] mt-2 font-mono tabular-nums">{neighborhoods.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Vatanparvar MFY (Qarshi)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Tizim foydalanuvchilari</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">5 xil RBAC rollari</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Umumiy holat
        </button>
        <button
          onClick={() => setActiveTab('geography')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'geography' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          Geografik iyerarxiya (Viloyat → Tuman → Mahalla)
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Foydalanuvchilar va rollar ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'subscriptions' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Tarif rejalari va monetizatsiya
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Boshqaruv hududi: Qarshi shahri, Vatanparvar MFY</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mahalla24 tizimi Qashqadaryo viloyati Qarshi shahridagi "Vatanparvar" MFYda faoliyat yuritmoqda. Fuqarolar Telegram Mini App orqali murojaat yuborishmoqda, mahalla raisi va kommunal xizmat ustalari platforma orqali topshiriqlarni tezkor bajarishmoqda.
            </p>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold">Asosiy ko'rsatkichlar:</div>
              <div>• Mahalla: Vatanparvar MFY (Qarshi shahri)</div>
              <div>• Faol tarif: PRO (Cheksiz resurslar)</div>
              <div>• O'rtacha hal etish vaqti: 18.5 soat</div>
              <div>• Hal etish samaradorligi: 85% dan yuqori</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Tizim xavfsizlik arxitekturasi</h3>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Server-side RBAC:</strong> Frontendga ishonilmaydi, har bir API so'rovida rol va huquq tekshiriladi.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Multi-tenant izolyatsiyasi:</strong> Rais va xodim faqat o'z mahallasini boshqara oladi, fuqaro begona ma'lumotlarni ko'ra olmaydi.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Audit xronologiyasi:</strong> <code>complaint_history</code> jadvalida har bir status o'zgarishi qayd etiladi.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Telegram Webhook xavfsizligi:</strong> Webhook secret token tekshiruvi.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* 2. GEOGRAPHY */}
      {activeTab === 'geography' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">O'zbekiston ma'muriy-hududiy iyerarxiyasi</h3>
              <p className="text-xs text-slate-500">Viloyatlar, tumanlar va mahallalar ma'lumotlar bazasi</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRegModal(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Viloyat qo'shish
              </button>
              <button
                onClick={() => setShowDistModal(true)}
                className="px-3 py-1.5 bg-[#16834B] hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tuman qo'shish
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Regions list */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Viloyatlar ({regions.length})</h4>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {regions.map((r) => (
                  <div key={r.id} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 flex justify-between">
                    <span>{r.nameUz}</span>
                    <span className="font-mono text-slate-400 text-[10px]">{r.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Districts list */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tumanlar ({districts.length})</h4>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {districts.map((d) => (
                  <div key={d.id} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 flex justify-between">
                    <span>{d.nameUz}</span>
                    <span className="font-mono text-slate-400 text-[10px]">{d.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Neighborhoods list */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mahallalar ({neighborhoods.length})</h4>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {neighborhoods.map((n) => (
                  <div key={n.id} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 flex justify-between">
                    <span>{n.nameUz}</span>
                    <span className="font-mono text-emerald-700 text-[10px]">{n.subscriptionStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">F.I.Sh.</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Telefon</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Telegram</th>
                <th className="py-3 px-4">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">{u.phone || '—'}</td>
                  <td className="py-3 px-4">{u.email || '—'}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {u.telegramUsername ? `@${u.telegramUsername}` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-700 font-semibold">Faol</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. SUBSCRIPTIONS & MONETIZATION */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Mahalla24 Oylik Obuna Rejalari (Monetizatsiya)</h3>
            <p className="text-xs text-slate-500">Mahalla boshqaruv idoralari uchun taklif etiladigan tariflar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const features = JSON.parse(p.features || '[]');
              const isPro = p.code === 'PRO';

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-6 border transition-all ${
                    isPro ? 'border-[#16834B] ring-2 ring-[#16834B]/20 bg-emerald-50/20' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600">{p.name}</span>
                    {isPro && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#16834B] text-white">
                        Tavsiya etiladi
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {p.priceUzs.toLocaleString('uz-UZ')} UZS
                    <span className="text-xs font-normal text-slate-500"> / oy</span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2">{p.description}</p>

                  <ul className="mt-4 space-y-2 text-xs text-slate-700 border-t border-slate-100 pt-4">
                    {features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <FileCheck2 className="w-3.5 h-3.5 text-[#16834B] shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Region Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Yangi viloyat qo'shish</h3>
            <form onSubmit={handleRegionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Viloyat nomi</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Jizzax viloyati"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kodi</label>
                <input
                  type="text"
                  required
                  placeholder="jizzakh"
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add District Modal */}
      {showDistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Yangi tuman qo'shish</h3>
            <form onSubmit={handleDistrictSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Viloyatni tanlang</label>
                <select
                  value={distRegionId}
                  onChange={(e) => setDistRegionId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameUz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tuman nomi</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Kitob tumani"
                  value={distName}
                  onChange={(e) => setDistName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kodi</label>
                <input
                  type="text"
                  required
                  placeholder="kitob_tumani"
                  value={distCode}
                  onChange={(e) => setDistCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDistModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
