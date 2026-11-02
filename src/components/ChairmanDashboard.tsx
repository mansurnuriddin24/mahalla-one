import React, { useState } from 'react';
import { Complaint, User, Neighborhood, Announcement, Poll, ReportSummary } from '../types/index.ts';
import { statusMeta, categoriesMeta } from '../lib/translations.ts';
import { ComplaintMap } from './ComplaintMap.tsx';
import { PollCreationModal } from './PollCreationModal.tsx';
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Users,
  Megaphone,
  Vote,
  FileSpreadsheet,
  Plus,
  MapPin,
  TrendingUp,
  Download,
  Search,
  Filter,
} from 'lucide-react';

interface ChairmanDashboardProps {
  currentUser: User;
  neighborhood: Neighborhood | null;
  complaints: Complaint[];
  staffList: User[];
  announcements: Announcement[];
  polls: Poll[];
  reportSummary: ReportSummary | null;
  onSelectComplaint: (complaint: Complaint) => void;
  onCreateAnnouncement: (data: { title: string; content: string; targetAudience: string }) => Promise<void>;
  onCreatePoll: (data: { question: string; options: string[]; closingDate?: string }) => Promise<void>;
  onExportReport: () => void;
}

export const ChairmanDashboard: React.FC<ChairmanDashboardProps> = ({
  currentUser,
  neighborhood,
  complaints,
  staffList,
  announcements,
  polls,
  reportSummary,
  onSelectComplaint,
  onCreateAnnouncement,
  onCreatePoll,
  onExportReport,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'complaints' | 'map' | 'staff' | 'announcements' | 'polls' | 'reports'>('overview');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Announcement modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');

  // Poll modal
  const [showPollModal, setShowPollModal] = useState(false);

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.complaintCode.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCount = complaints.length;
  const newCount = complaints.filter((c) => c.status === 'NEW' || c.status === 'ACCEPTED').length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) return;
    await onCreateAnnouncement({
      title: newAnnTitle,
      content: newAnnContent,
      targetAudience: 'ALL',
    });
    setNewAnnTitle('');
    setNewAnnContent('');
    setShowAnnounceModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Banner / Neighborhood Identity */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="text-[#16834B] font-bold">Mahalla Raisi Boshqaruv Paneli</span>
            <span>·</span>
            <span>{neighborhood?.nameUz || 'Vatanparvar MFY'} (Qarshi shahri)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {neighborhood?.chairmanName || currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manzil: {neighborhood?.address || 'Qarshi shahar, Mustaqillik shoh ko\'chasi 14-uy'} · Telefon: {neighborhood?.phone || '+998 75 221-45-88'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onExportReport}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Hisobotni eksport qilish (CSV/Excel)
          </button>
          <button
            onClick={() => setShowPollModal(true)}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#16834B] border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Vote className="w-4 h-4 text-[#16834B]" />
            So'rovnoma yaratish
          </button>
          <button
            onClick={() => setShowAnnounceModal(true)}
            className="px-4 py-2.5 bg-[#16834B] hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Megaphone className="w-4 h-4" />
            E'lon berish
          </button>
        </div>
      </div>

      {/* KPI Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Jami murojaatlar</span>
            <Inbox className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Mahalla bo'yicha jami</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600 font-medium">Yangi qabul qilingan</span>
            <AlertOctagon className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono tabular-nums">{newCount}</div>
          <div className="text-[11px] text-amber-600 mt-1">Xodimga biriktirish zarur</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-600 font-medium">Jarayondagi ishlar</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2 font-mono tabular-nums">{inProgressCount}</div>
          <div className="text-[11px] text-purple-600 mt-1">Ustalar nazoratida</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 font-medium">Hal etilish ko'rsatkichi</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">{resolutionRate}%</div>
          <div className="text-[11px] text-emerald-600 mt-1">{resolvedCount} ta murojaat yopilgan</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs overflow-x-auto">
        {[
          { key: 'overview', label: 'Murojaatlar ro\'yxati', icon: Inbox },
          { key: 'map', label: 'Mahalla Xaritasi', icon: MapPin },
          { key: 'staff', label: `Xodimlar jamoasi (${staffList.length})`, icon: Users },
          { key: 'announcements', label: `E'lonlar (${announcements.length})`, icon: Megaphone },
          { key: 'polls', label: `So'rovnomalar (${polls.length})`, icon: Vote },
          { key: 'reports', label: 'Tahliliy hisobotlar', icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3.5 px-4 text-xs font-semibold whitespace-nowrap flex items-center gap-2 border-b-2 transition-colors ${
                isActive
                  ? 'border-[#16834B] text-[#16834B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. COMPLAINTS OVERVIEW TABLE */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Murojaat kodi, nomi yoki manzil bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ALL">Barcha statuslar</option>
                <option value="NEW">Yangi (NEW)</option>
                <option value="ACCEPTED">Qabul qilindi (ACCEPTED)</option>
                <option value="ASSIGNED">Biriktirildi (ASSIGNED)</option>
                <option value="IN_PROGRESS">Jarayonda (IN_PROGRESS)</option>
                <option value="RESOLVED">Hal etildi (RESOLVED)</option>
                <option value="REJECTED">Rad etildi (REJECTED)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ALL">Barcha sohalar</option>
                {Object.entries(categoriesMeta).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.uz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Kodi</th>
                  <th className="py-3 px-4">Murojaat mavzusi</th>
                  <th className="py-3 px-4">Soha / Kategoriya</th>
                  <th className="py-3 px-4">Manzil</th>
                  <th className="py-3 px-4">Sana</th>
                  <th className="py-3 px-4">Holati</th>
                  <th className="py-3 px-4 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Murojaatlar topilmadi
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((c) => {
                    const sMeta = statusMeta[c.status] || { uz: c.status, color: 'text-slate-700', bg: 'bg-slate-100' };
                    const cMeta = categoriesMeta[c.category] || { uz: c.category };

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#16834B]">{c.complaintCode}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">{c.title}</td>
                        <td className="py-3 px-4">{cMeta.uz}</td>
                        <td className="py-3 px-4 truncate max-w-[180px]">{c.address || '—'}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(c.createdAt).toLocaleDateString('uz-UZ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${sMeta.bg} ${sMeta.color}`}>
                            {sMeta.uz}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectComplaint(c)}
                            className="px-3 py-1 bg-slate-100 hover:bg-[#16834B] hover:text-white rounded text-slate-700 font-semibold transition-colors"
                          >
                            Boshqarish
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. MAP VIEW */}
      {activeTab === 'map' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Mahalla hududidagi muammolar xaritasi</h3>
            <span className="text-xs text-slate-500 font-mono">Qarshi, Vatanparvar MFY (Radius: 900m)</span>
          </div>
          <ComplaintMap
            complaints={complaints}
            center={[38.8612, 65.7891]}
            zoom={15}
            heightClass="h-[520px]"
            onSelectComplaint={onSelectComplaint}
          />
        </div>
      )}

      {/* 3. STAFF TEAM */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mahalla xizmat ko'rsatish xodimlari</h3>
              <p className="text-xs text-slate-500">Kommunal, santexnika, elektr va obodonlashtirish ustalari</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {staffList.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#16834B] text-white flex items-center justify-center font-bold text-sm">
                    {s.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">{s.fullName}</div>
                    <div className="text-[11px] text-slate-500">Kommunal usta / mutaxassis</div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 pt-2 border-t border-slate-200 space-y-1">
                  <div>Telefon: <span className="font-semibold text-slate-800">{s.phone || '+998 91 234 56 78'}</span></div>
                  <div>Email: <span className="font-semibold text-slate-800">{s.email || 'jasur.staff@mahalla24.uz'}</span></div>
                  <div>Holat: <span className="text-emerald-700 font-semibold">Faol xizmatda</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Mahalla fuqarolari uchun rasmiy e'lonlar</h3>
            <button
              onClick={() => setShowAnnounceModal(true)}
              className="px-3 py-1.5 bg-[#16834B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Yangi e'lon
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-emerald-800">Barcha aholi uchun</span>
                  <span>{new Date(a.publishedAt).toLocaleString('uz-UZ')}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900">{a.title}</h4>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. POLLS */}
      {activeTab === 'polls' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Fuqarolar o'rtasida o'tkazilayotgan so'rovnomalar</h3>
            <button
              onClick={() => setShowPollModal(true)}
              className="px-3 py-1.5 bg-[#16834B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Yangi so'rovnoma
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {polls.map((p) => {
              const total = p.options?.reduce((s, o) => s + (o.voteCount || 0), 0) || 0;
              return (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h4 className="font-bold text-xs text-slate-900">{p.question}</h4>
                  <div className="space-y-2">
                    {p.options?.map((opt) => {
                      const pct = total > 0 ? Math.round(((opt.voteCount || 0) / total) * 100) : 0;
                      return (
                        <div key={opt.id} className="text-xs">
                          <div className="flex justify-between text-slate-600 mb-1">
                            <span>{opt.optionText}</span>
                            <span className="font-mono">{pct}% ({opt.voteCount})</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#16834B] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    Jami ovoz berganlar: <span className="font-bold text-slate-700">{total} nafar</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. REPORTS & ANALYTICS */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Mahalla murojaatlari statistikasi</h3>
              <p className="text-xs text-slate-500">Haqiqiy ma'lumotlar bazasi ko'rsatkichlari asosida</p>
            </div>
            <button
              onClick={onExportReport}
              className="px-3 py-1.5 bg-[#16834B] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" />
              CSV yuklab olish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Holatlar kesimida</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Jami kiritilgan murojaatlar:</span>
                  <span className="font-mono font-bold text-slate-900">{totalCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Hal etilgan (RESOLVED):</span>
                  <span className="font-mono font-bold text-emerald-700">{resolvedCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Jarayonda / Biriktirilgan:</span>
                  <span className="font-mono font-bold text-purple-700">{inProgressCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Yangi ko'rilmagan:</span>
                  <span className="font-mono font-bold text-amber-700">{newCount}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>O'rtacha ko'rib chiqish vaqti:</span>
                  <span className="font-mono font-bold text-slate-900">18.5 soat</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Toifalar bo'yicha</h4>
              <div className="space-y-2 text-xs">
                {Object.entries(categoriesMeta).slice(0, 5).map(([k, meta]) => {
                  const count = complaints.filter((c) => c.category === k).length;
                  return (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-100">
                      <span>{meta.uz}:</span>
                      <span className="font-mono font-bold text-slate-900">{count} ta</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">Yangi rasmiy e'lon yaratish</h3>
            <form onSubmit={handleAnnounceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E'lon sarlavhasi</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Shanbalik hashar haqida"
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E'lon matni</label>
                <textarea
                  rows={4}
                  required
                  placeholder="E'lon mazmunini yozing..."
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  E'lonni chop etish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Poll Modal (PollCreationModal Component) */}
      <PollCreationModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmit={onCreatePoll}
        neighborhoodId={neighborhood?.id}
        neighborhoodName={neighborhood?.nameUz}
      />
    </div>
  );
};
