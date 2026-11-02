import React, { useState } from 'react';
import { Complaint, User } from '../types/index.ts';
import { statusMeta, categoriesMeta } from '../lib/translations.ts';
import { ComplaintMap } from './ComplaintMap.tsx';
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  Camera,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface StaffDashboardProps {
  currentUser: User;
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
  onStatusUpdate: (complaintId: string, newStatus: string, explanation: string, evidenceUrl?: string) => Promise<void>;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  currentUser,
  complaints,
  onSelectComplaint,
  onStatusUpdate,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

  // Quick resolution modal state
  const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>('IN_PROGRESS');
  const [explanation, setExplanation] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const filtered = complaints.filter((c) => {
    if (filter === 'ALL') return true;
    return c.status === filter;
  });

  const assignedCount = complaints.filter((c) => c.status === 'ASSIGNED').length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaint || !explanation.trim()) return;

    try {
      setIsUpdating(true);
      await onStatusUpdate(activeComplaint.id, resolutionStatus, explanation, evidenceUrl);
      setActiveComplaint(null);
      setExplanation('');
      setEvidenceUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Profile */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#16834B] text-white flex items-center justify-center font-bold text-xl shadow-xs">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-0.5">
              <span className="text-[#16834B] font-bold">Xodim / Ijrochi Kabineti</span>
              <span>·</span>
              <span>Vatanparvar MFY (Qarshi)</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{currentUser.fullName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Telefon: {currentUser.phone || '+998 91 234 56 78'} · Kommunal xizmat ustasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'ALL' ? 'bg-[#16834B] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Barchasi ({complaints.length})
          </button>
          <button
            onClick={() => setFilter('ASSIGNED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'ASSIGNED' ? 'bg-[#16834B] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Biriktirilgan ({assignedCount})
          </button>
          <button
            onClick={() => setFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'IN_PROGRESS' ? 'bg-[#16834B] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Jarayonda ({inProgressCount})
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'RESOLVED' ? 'bg-[#16834B] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tugatilgan ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Task Cards & Map Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Cards List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Sizga topshirilgan vazifalar ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-xs text-slate-500">
              Bu bo'limda hozircha vazifalar mavjud emas.
            </div>
          ) : (
            filtered.map((c) => {
              const sMeta = statusMeta[c.status] || { uz: c.status, color: 'text-slate-700', bg: 'bg-slate-100' };
              const cMeta = categoriesMeta[c.category] || { uz: c.category };

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#16834B]">{c.complaintCode}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-medium text-slate-600">{cMeta.uz}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${sMeta.bg} ${sMeta.color}`}>
                      {sMeta.uz}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{c.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.address || 'Qarshi, Vatanparvar'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{new Date(c.createdAt).toLocaleDateString('uz-UZ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onSelectComplaint(c)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                    >
                      Batafsil ma'lumot va tarix
                    </button>

                    <button
                      onClick={() => {
                        setActiveComplaint(c);
                        setResolutionStatus(c.status === 'ASSIGNED' ? 'IN_PROGRESS' : 'RESOLVED');
                      }}
                      className="px-4 py-1.5 bg-[#16834B] hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Holatni yangilash
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Map of Assigned Tasks */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Joylashuv xaritasi
          </h2>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <ComplaintMap
              complaints={filtered}
              center={[38.8612, 65.7891]}
              zoom={15}
              heightClass="h-[420px]"
              onSelectComplaint={onSelectComplaint}
            />
            <div className="mt-3 text-[11px] text-slate-500">
              Xaritadagi nuqtani bosish orqali murojaat haqida to'liq ma'lumotni ko'rishingiz mumkin.
            </div>
          </div>
        </div>
      </div>

      {/* Quick Status Update Modal */}
      {activeComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div>
              <div className="text-xs font-mono text-[#16834B] font-bold">{activeComplaint.complaintCode}</div>
              <h3 className="text-base font-bold text-slate-900">{activeComplaint.title}</h3>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Statusni tanlang</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                >
                  <option value="IN_PROGRESS">IN_PROGRESS (Ish olib borilmoqda)</option>
                  <option value="RESOLVED">RESOLVED (Ta'mirlandi / Hal etildi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bajarilgan ish hisoboti (Majburiy)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Qanday ishlar amalga oshirildi, qaysi qismlar yangilandi..."
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dalil fotosurati URL
                </label>
                <input
                  type="url"
                  placeholder="https://... (Natijani ko'rsatuvchi rasm)"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveComplaint(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  {isUpdating ? 'Saqlanmoqda...' : 'Hisobotni saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
