import React, { useState } from 'react';
import { Complaint, User } from '../types/index.ts';
import { statusMeta, categoriesMeta } from '../lib/translations.ts';
import { X, Calendar, MapPin, User as UserIcon, Clock, CheckCircle2, AlertTriangle, Star, ArrowRight, ShieldCheck } from 'lucide-react';

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  currentUser: User;
  staffList: User[];
  onClose: () => void;
  onStatusUpdate: (complaintId: string, newStatus: string, explanation: string, evidenceUrl?: string) => Promise<void>;
  onAssignStaff: (complaintId: string, staffId: string, notes: string, deadline?: string) => Promise<void>;
  onRateComplaint: (complaintId: string, score: number, comment?: string) => Promise<void>;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  currentUser,
  staffList,
  onClose,
  onStatusUpdate,
  onAssignStaff,
  onRateComplaint,
}) => {
  if (!complaint) return null;

  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'action'>('details');
  const [selectedStatus, setSelectedStatus] = useState<string>('IN_PROGRESS');
  const [statusExplanation, setStatusExplanation] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Assignment form state
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || '');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assignDeadline, setAssignDeadline] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  React.useEffect(() => {
    if (staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].id);
    }
  }, [staffList, selectedStaffId]);

  // Rating state
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [isRating, setIsRating] = useState(false);

  // Form error states
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const statusInfo = statusMeta[complaint.status] || { uz: complaint.status, color: 'text-slate-700', bg: 'bg-slate-100' };
  const categoryInfo = categoriesMeta[complaint.category] || { uz: complaint.category };

  const canManageStatus = currentUser.role === 'CHAIRMAN' || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'STAFF';
  const canAssign = currentUser.role === 'CHAIRMAN' || currentUser.role === 'SUPER_ADMIN';
  const canRate = (currentUser.role === 'CITIZEN' || currentUser.id === complaint.citizenId) &&
    (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') &&
    !complaint.rating;

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusExplanation.trim()) return;
    setStatusError(null);
    try {
      setIsUpdatingStatus(true);
      await onStatusUpdate(complaint.id, selectedStatus, statusExplanation, evidenceUrl);
      setStatusExplanation('');
      setEvidenceUrl('');
      setActiveTab('history');
    } catch (err: any) {
      console.warn('Status update notice:', err);
      setStatusError(err?.message || "Statusni o'zgartirishda xatolik yuz berdi");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    setAssignError(null);
    try {
      setIsAssigning(true);
      await onAssignStaff(complaint.id, selectedStaffId, assignNotes, assignDeadline);
      setAssignNotes('');
      setActiveTab('history');
    } catch (err: any) {
      console.warn('Assign notice:', err);
      setAssignError(err?.message || "Xodimga biriktirishda xatolik yuz berdi");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsRating(true);
      await onRateComplaint(complaint.id, ratingScore, ratingComment);
    } catch (err: any) {
      console.warn('Rating notice:', err);
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="font-mono text-[#16834B]">{complaint.complaintCode}</span>
              <span>·</span>
              <span>{categoryInfo.uz}</span>
              <span>·</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.uz}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{complaint.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-100 px-6 gap-2 bg-white">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#16834B] text-[#16834B]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tafsilotlar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-[#16834B] text-[#16834B]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tarix va Audit ({complaint.history?.length || 0})
          </button>
          {(canManageStatus || canAssign) && (
            <button
              onClick={() => setActiveTab('action')}
              className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'action'
                  ? 'border-[#16834B] text-[#16834B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Harakatlar / Boshqaruv
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Murojaat mazmuni</h4>
                <p className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                  {complaint.description}
                </p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Joylashuv manzili</div>
                    <div className="truncate">{complaint.address || 'Manzil yozilmagan'}</div>
                    {complaint.latitude && complaint.longitude && (
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Kiritilgan sana</div>
                    <div>{new Date(complaint.createdAt).toLocaleString('uz-UZ')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Murojaatchi fuqaro</div>
                    <div>{complaint.citizen?.fullName || 'Mahalla fuqarosi'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-[#16834B] shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Ustuvorlik darajasi</div>
                    <div className="font-semibold">{complaint.priority}</div>
                  </div>
                </div>
              </div>

              {/* Media Attachments */}
              {complaint.media && complaint.media.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Biriktirilgan fotosuratlar</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {complaint.media.map((m, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                        <img
                          src={m.fileUrl}
                          alt="Evidence"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating Component */}
              {complaint.rating && (
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-900">Fuqaro bahosi</span>
                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= complaint.rating!.score ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {complaint.rating.comment && (
                    <p className="text-xs text-amber-800 mt-2 italic">"{complaint.rating.comment}"</p>
                  )}
                </div>
              )}

              {/* Citizen Rating Form */}
              {canRate && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <h4 className="text-sm font-bold text-emerald-950 mb-2">Hal etilgan natijani baholang</h4>
                  <form onSubmit={handleRatingSubmit} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-medium">Baho:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingScore(star)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-5 h-5 ${star <= ratingScore ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-800 ml-2">{ratingScore} / 5</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Izohingiz (ixtiyoriy, masalan: Tez va sifatli bajarildi)"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                    />

                    <button
                      type="submit"
                      disabled={isRating}
                      className="w-full py-2 bg-[#16834B] text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isRating ? 'Saqlanmoqda...' : 'Bahoni tasdiqlash'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Murojaat bo'yicha audit xronologiyasi</h4>
              {(!complaint.history || complaint.history.length === 0) ? (
                <div className="text-center py-8 text-xs text-slate-500">Hozircha o'zgarishlar tarixi mavjud emas</div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {complaint.history.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-[#16834B] flex items-center justify-center" />
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">
                            {h.previousStatus ? `${h.previousStatus} → ${h.newStatus}` : h.newStatus}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(h.createdAt).toLocaleString('uz-UZ')}
                          </span>
                        </div>
                        <p className="text-slate-700">{h.explanation}</p>
                        {h.evidenceUrl && (
                          <div className="mt-2">
                            <img src={h.evidenceUrl} alt="Dalil" className="h-24 rounded-lg object-cover border border-slate-200" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'action' && (
            <div className="space-y-6">
              {/* Assign to Staff (Chairman / Super Admin) */}
              {canAssign && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-[#16834B]" />
                    Xodimga biriktirish
                  </h4>
                  <form onSubmit={handleAssignSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mas'ul xodimni tanlang</label>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      >
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName} ({s.phone || 'Kommunal usta'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Ijro topshirig'i / Ko'rsatma</label>
                      <input
                        type="text"
                        placeholder="Masalan: 24 soat ichida quvurni ta'mirlash"
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bajarilish muddati (Deadline)</label>
                      <input
                        type="datetime-local"
                        value={assignDeadline}
                        onChange={(e) => setAssignDeadline(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      />
                    </div>

                    {assignError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                        {assignError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAssigning}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isAssigning ? 'Biriktirilmoqda...' : 'Xodimga yuklash'}
                    </button>
                  </form>
                </div>
              )}

              {/* Status Update (Chairman / Staff) */}
              {canManageStatus && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16834B]" />
                    Statusni yangilash va dalil kiritish
                  </h4>
                  <form onSubmit={handleStatusSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Yangi holat (Status)</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      >
                        <option value="ACCEPTED">ACCEPTED (Qabul qilindi)</option>
                        <option value="IN_PROGRESS">IN_PROGRESS (Jarayonda / Ish bajarilmoqda)</option>
                        <option value="RESOLVED">RESOLVED (Muvaffaqiyatli hal etildi)</option>
                        <option value="REJECTED">REJECTED (Asossiz deb rad etildi)</option>
                        <option value="CLOSED">CLOSED (Yopildi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Bajarilgan ish yoki o'zgarish izohi (Majburiy)</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Masalan: Ta'mirlash brigadasi hududga borib kabelni almashtirdi, svet yondi."
                        value={statusExplanation}
                        onChange={(e) => setStatusExplanation(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Natija fotosurati URL (Dalil sifatida)</label>
                      <input
                        type="url"
                        placeholder="https://... (Natijani tasdiqlovchi rasm havolasi)"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                      />
                    </div>

                    {statusError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                        {statusError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isUpdatingStatus}
                      className="w-full py-2.5 bg-[#16834B] text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isUpdatingStatus ? 'Saqlanmoqda...' : 'Holatni saqlash va fuqaroga bildirishnoma yuborish'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
