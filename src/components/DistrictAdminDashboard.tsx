import React, { useState } from 'react';
import { Complaint, Neighborhood, District } from '../types/index.ts';
import { statusMeta } from '../lib/translations.ts';
import { ComplaintMap } from './ComplaintMap.tsx';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  MapPin,
  TrendingUp,
  BarChart3,
  Search,
} from 'lucide-react';

interface DistrictAdminDashboardProps {
  district: District | null;
  neighborhoods: Neighborhood[];
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
  onCreateNeighborhood: (data: any) => Promise<void>;
}

export const DistrictAdminDashboard: React.FC<DistrictAdminDashboardProps> = ({
  district,
  neighborhoods,
  complaints,
  onSelectComplaint,
  onCreateNeighborhood,
}) => {
  const [activeTab, setActiveTab] = useState<'neighborhoods' | 'complaints' | 'map'>('neighborhoods');
  const [showAddModal, setShowAddModal] = useState(false);

  // New neighborhood form
  const [nameUz, setNameUz] = useState('');
  const [chairmanName, setChairmanName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const totalComplaints = complaints.length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim() || !district) return;
    await onCreateNeighborhood({
      districtId: district.id,
      nameUz,
      chairmanName,
      phone,
      address,
      coordinatesLat: 38.8612,
      coordinatesLng: 65.7891,
    });
    setNameUz('');
    setChairmanName('');
    setPhone('');
    setAddress('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* District Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-[#16834B] font-bold">Tuman / Shahar Hokimligi Nazorat Paneli</span>
            <span>·</span>
            <span>Qashqadaryo viloyati</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {district?.nameUz || 'Qarshi shahri'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Nazoratdagi mahallalar soni: {neighborhoods.length} ta · Raqamli mahalla tizimi faol
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-[#16834B] hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yangi mahalla biriktirish
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Barcha mahallalar</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{neighborhoods.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1">100% raqamlashgan</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Tuman bo'yicha jami murojaatlar</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{totalComplaints}</div>
          <div className="text-[11px] text-slate-500 mt-1">Fuqarolar tomonidan</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-purple-600 font-medium">Bajarilish jarayonida</div>
          <div className="text-2xl font-bold text-purple-700 mt-2 font-mono tabular-nums">{inProgressCount}</div>
          <div className="text-[11px] text-purple-600 mt-1">Hokimlik nazoratida</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-medium">Hal etilish ko'rsatkichi</div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">{resolutionRate}%</div>
          <div className="text-[11px] text-emerald-600 mt-1">{resolvedCount} ta murojaat yopilgan</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab('neighborhoods')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'neighborhoods' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Mahallalar reyestri ({neighborhoods.length})
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'complaints' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Tuman murojaatlari monitoringi
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`py-3.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'map' ? 'border-[#16834B] text-[#16834B]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Geografik xarita
        </button>
      </div>

      {/* Neighborhoods List */}
      {activeTab === 'neighborhoods' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {neighborhoods.map((n) => {
            const count = complaints.filter((c) => c.neighborhoodId === n.id).length;
            const isPilot = n.code === 'qarshi_vatanparvar';

            return (
              <div
                key={n.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{n.nameUz}</span>
                  {isPilot ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#16834B]">
                      Asosiy hudud
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                      Faol
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>Rais: <span className="font-semibold text-slate-900">{n.chairmanName || 'Tayinlanmagan'}</span></div>
                  <div>Telefon: <span className="font-semibold text-slate-900">{n.phone || '+998 75 221-00-00'}</span></div>
                  <div>Manzil: <span className="text-slate-500 truncate block">{n.address || 'Qarshi shahri'}</span></div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Murojaatlar:</span>
                  <span className="font-mono font-bold text-[#16834B]">{count} ta</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complaints List */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Kodi</th>
                <th className="py-3 px-4">Murojaat</th>
                <th className="py-3 px-4">Kategoriya</th>
                <th className="py-3 px-4">Holati</th>
                <th className="py-3 px-4">Sana</th>
                <th className="py-3 px-4 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.map((c) => {
                const sMeta = statusMeta[c.status] || { uz: c.status, color: 'text-slate-700', bg: 'bg-slate-100' };
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-[#16834B]">{c.complaintCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.title}</td>
                    <td className="py-3 px-4">{c.category}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${sMeta.bg} ${sMeta.color}`}>
                        {sMeta.uz}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectComplaint(c)}
                        className="px-3 py-1 bg-slate-100 hover:bg-[#16834B] hover:text-white rounded text-slate-700 font-semibold transition-colors"
                      >
                        Tekshirish
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Map View */}
      {activeTab === 'map' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Qarshi shahri bo'yicha murojaatlar xaritasi</h3>
          <ComplaintMap
            complaints={complaints}
            center={[38.8612, 65.7891]}
            zoom={14}
            heightClass="h-[520px]"
            onSelectComplaint={onSelectComplaint}
          />
        </div>
      )}

      {/* Add Neighborhood Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Yangi mahalla qo'shish</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mahalla nomi</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Paxtakor MFY"
                  value={nameUz}
                  onChange={(e) => setNameUz(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mahalla raisi F.I.Sh.</label>
                <input
                  type="text"
                  placeholder="Masalan: Zafar Toirov"
                  value={chairmanName}
                  onChange={(e) => setChairmanName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aloqa telefoni</label>
                <input
                  type="text"
                  placeholder="+998 75 220 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mahalla idorasi manzili</label>
                <input
                  type="text"
                  placeholder="Qarshi shahri, Paxtakor ko'chasi 5-uy"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  Mahallani ro'yxatga olish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
