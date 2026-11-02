import React, { useState } from 'react';
import { Complaint, Announcement, Poll, User, Neighborhood } from '../types/index.ts';
import { categoriesMeta, statusMeta } from '../lib/translations.ts';
import { ComplaintMap } from './ComplaintMap.tsx';
import {
  Home,
  PlusCircle,
  ListFilter,
  Megaphone,
  Vote,
  User as UserIcon,
  HelpCircle,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Send,
  Star,
} from 'lucide-react';

interface TelegramMiniAppProps {
  currentUser: User;
  neighborhood: Neighborhood | null;
  complaints: Complaint[];
  announcements: Announcement[];
  polls: Poll[];
  onCreateComplaint: (data: any) => Promise<void>;
  onSelectComplaint: (complaint: Complaint) => void;
  onVotePoll: (pollId: string, optionId: string) => Promise<void>;
  onSwitchToChairman?: () => void;
}

export const TelegramMiniApp: React.FC<TelegramMiniAppProps> = ({
  currentUser,
  neighborhood,
  complaints,
  announcements,
  polls,
  onCreateComplaint,
  onSelectComplaint,
  onVotePoll,
  onSwitchToChairman,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'submit' | 'my' | 'announcements' | 'polls' | 'profile' | 'help'>('home');

  // Submit Complaint form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('street_lighting');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(38.8612);
  const [lng, setLng] = useState<number | null>(65.7891);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Voting state
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    const targetNeighborhoodId = neighborhood?.id || '33333333-3333-3333-3333-333333333301';

    try {
      setIsSubmitting(true);
      await onCreateComplaint({
        title,
        description,
        category,
        neighborhoodId: targetNeighborhoodId,
        address: address || 'Vatanparvar MFY, Qarshi',
        latitude: lat,
        longitude: lng,
        priority: 'MEDIUM',
        mediaUrls: photoUrl ? [photoUrl] : [],
      });

      setSubmitSuccess(true);
      setTitle('');
      setDescription('');
      setAddress('');
      setPhotoUrl('');
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('my');
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
        }
      );
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      setVotingPollId(pollId);
      await onVotePoll(pollId, optionId);
    } catch (err) {
      console.error(err);
    } finally {
      setVotingPollId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F5F7F6] flex flex-col pb-20 shadow-xl border-x border-slate-200">
      {/* Mini App Sticky Top Bar */}
      <header className="sticky top-0 z-30 bg-[#16834B] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <img
            src="/mahalla-one-logo.png"
            alt="Mahalla One"
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-xs"
          />
          <div>
            <div className="text-xs text-emerald-100 font-medium">Mahalla One — Mini App</div>
            <div className="text-sm font-bold truncate max-w-[200px]">
              {neighborhood?.nameUz || 'Qarshi, Vatanparvar MFY'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-[11px] font-mono">
          <span>@{currentUser.telegramUsername || 'fuqaro_bot'}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 space-y-4">
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-fade-in">
            {/* Hero Quick Banner */}
            <div className="bg-gradient-to-br from-[#16834B] to-emerald-800 text-white rounded-2xl p-5 shadow-sm">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-200">
                Xush kelibsiz
              </span>
              <h2 className="text-xl font-bold mt-1">Mahallangiz muammolarini tezda hal eting</h2>
              <p className="text-xs text-emerald-100 mt-2 leading-relaxed">
                Ko'cha chirog'i, ichimlik suvi, yo'llar yoki tozalash masalalari bo'yicha to'g'ridan-to'g'ri mahalla raisi va ustalarga murojaat yuboring.
              </p>
              <button
                onClick={() => setActiveTab('submit')}
                className="mt-4 w-full py-2.5 bg-white text-[#16834B] font-bold text-xs rounded-xl shadow hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Yangi murojaat qoldirish
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Mening murojaatlarim</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {complaints.length}
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">Ko'rish uchun bosing →</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Faol so'rovnomalar</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {polls.length}
                </div>
                <div className="text-[11px] text-blue-600 mt-1">Ovoz berish →</div>
              </div>
            </div>

            {/* Neighborhood Announcements Preview */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#16834B]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Mahalla e'lonlari</h3>
                </div>
                <button
                  onClick={() => setActiveTab('announcements')}
                  className="text-xs text-[#16834B] font-medium hover:underline"
                >
                  Barchasi
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center">Hozircha yangi e'lonlar yo'q</div>
              ) : (
                <div className="space-y-3">
                  {announcements.slice(0, 2).map((a) => (
                    <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="font-bold text-slate-900">{a.title}</div>
                      <p className="text-slate-600 mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                      <div className="text-[10px] text-slate-400 mt-2 font-mono">
                        {new Date(a.publishedAt).toLocaleDateString('uz-UZ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Neighborhood Leaflet Map */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#16834B]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Mahalla xaritasi</h3>
                </div>
                <span className="text-[10px] text-slate-500">Qarshi, Vatanparvar MFY</span>
              </div>
              <ComplaintMap
                complaints={complaints}
                center={[38.8612, 65.7891]}
                zoom={14}
                heightClass="h-[220px]"
                onSelectComplaint={onSelectComplaint}
              />
            </div>
          </div>
        )}

        {/* TAB 2: SUBMIT COMPLAINT */}
        {activeTab === 'submit' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Murojaat yoki taklif yuborish</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fotosurat va aniq lokatsiyani biriktirish muammoni tezroq hal etishga yordam beradi.
              </p>
            </div>

            {submitSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Murojaatingiz muvaffaqiyatli qabul qilindi va mahalla raisiga yuborildi!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Muammo toifasi</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]"
                >
                  {Object.entries(categoriesMeta).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.uz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Murojaat sarlavhasi</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Ko'cha chirog'i sinib tushgan"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batafsil tavsif</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Muammo qachon paydo bo'ldi, qayerda joylashganligi haqida yozing..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aniq manzil yoki mo'ljal</label>
                <input
                  type="text"
                  placeholder="Masalan: 4-ko'cha, 12-uy ro'parasi"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]"
                />
              </div>

              {/* Location Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">GPS Geolocation</label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="text-[11px] text-[#16834B] font-medium flex items-center gap-1 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Mening joyim
                  </button>
                </div>
                <div className="h-40 rounded-xl overflow-hidden border border-slate-200">
                  <ComplaintMap
                    selectable
                    center={[lat || 38.8612, lng || 65.7891]}
                    selectedLocation={lat && lng ? [lat, lng] : null}
                    onSelectLocation={(nLat, nLng) => {
                      setLat(nLat);
                      setLng(nLng);
                    }}
                    heightClass="h-full"
                  />
                </div>
                {lat && lng && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Tanlangan koordinatalar: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </div>
                )}
              </div>

              {/* Photo Upload URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fotosurat havolasi (ixtiyoriy)
                </label>
                <div className="relative">
                  <Camera className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://... (Foto URL)"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16834B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#16834B] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Yuborilmoqda...' : 'Murojaatni jo\'natish'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: MY COMPLAINTS */}
        {activeTab === 'my' && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Mening murojaatlarim ({complaints.length})</h2>
              <button
                onClick={() => setActiveTab('submit')}
                className="text-xs text-[#16834B] font-semibold flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Yangi qo'shish
              </button>
            </div>

            {complaints.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">Sizda hali murojaatlar yo'q</div>
                <p className="text-[11px] text-slate-400 mt-1">Birinchi shikoyat yoki taklifingizni qoldiring.</p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="mt-3 px-4 py-2 bg-[#16834B] text-white text-xs font-medium rounded-lg"
                >
                  Murojaat yozish
                </button>
              </div>
            ) : (
              complaints.map((c) => {
                const sMeta = statusMeta[c.status] || { uz: c.status, color: 'text-slate-700', bg: 'bg-slate-100' };
                const cMeta = categoriesMeta[c.category] || { uz: c.category };

                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectComplaint(c)}
                    className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-[#16834B] transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#16834B]">{c.complaintCode}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${sMeta.bg} ${sMeta.color}`}>
                        {sMeta.uz}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-slate-900">{c.title}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{c.description}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{cMeta.uz}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString('uz-UZ')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-3 animate-fade-in">
            <h2 className="text-base font-bold text-slate-900">Mahalla e'lonlari</h2>
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium text-emerald-700">Mahalla raisi devoni</span>
                  <span>{new Date(a.publishedAt).toLocaleDateString('uz-UZ')}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{a.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: POLLS */}
        {activeTab === 'polls' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-base font-bold text-slate-900">Mahalla so'rovnomalari</h2>
            <p className="text-xs text-slate-500">
              Mahallamiz obodonchiligi bo'yicha o'z fikringizni bildiring va ovoz bering.
            </p>

            {polls.map((p) => {
              const totalVotes = p.options?.reduce((sum, opt) => sum + (opt.voteCount || 0), 0) || 0;

              return (
                <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">{p.question}</h3>

                  <div className="space-y-2">
                    {p.options?.map((opt) => {
                      const percent = totalVotes > 0 ? Math.round(((opt.voteCount || 0) / totalVotes) * 100) : 0;
                      const isVoted = p.votedOptionId === opt.id;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => !p.hasVoted && handleVote(p.id, opt.id)}
                          className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                            isVoted
                              ? 'border-[#16834B] bg-emerald-50/50 font-semibold'
                              : p.hasVoted
                              ? 'border-slate-200 bg-slate-50/50 cursor-default'
                              : 'border-slate-200 hover:border-[#16834B] hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          {/* Progress bar background if voted */}
                          {p.hasVoted && (
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-emerald-100/60 z-0 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          )}

                          <div className="relative z-10 flex items-center justify-between">
                            <span className="text-slate-800">{opt.optionText}</span>
                            {p.hasVoted && (
                              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                {percent}% ({opt.voteCount})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {p.hasVoted && (
                    <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Siz ushbu so'rovnomada ovoz bergansiz
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-[#16834B] text-white flex items-center justify-center font-bold text-lg">
                {currentUser.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{currentUser.fullName}</h3>
                <span className="text-xs text-slate-500 font-mono">@{currentUser.telegramUsername || 'anvar_qarshi'}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Mahalla:</span>
                <span className="font-semibold text-slate-900">{neighborhood?.nameUz || 'Vatanparvar MFY'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Shahar:</span>
                <span className="font-semibold text-slate-900">Qarshi shahri</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Telefon:</span>
                <span className="font-semibold text-slate-900">{currentUser.phone || '+998 93 345 67 89'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Rol:</span>
                <span className="font-semibold text-emerald-700">Mahalla fuqarosi</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Telegram bildirishnomalari ulangan. Murojaatingiz statusi o'zgarganda bot orqali xabar keladi.
              </div>

              {onSwitchToChairman && (
                <button
                  onClick={onSwitchToChairman}
                  className="w-full py-2.5 px-4 bg-[#16834B] hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <UserIcon className="w-4 h-4" />
                  🏛 Mahalla Raisi Kabinetiga kirish (Boshqaruv)
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: HELP */}
        {activeTab === 'help' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <h2 className="text-base font-bold text-slate-900">Yordam va Aloqa</h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="font-bold text-slate-900 mb-1">Murojaatim qancha vaqtda ko'rib chiqiladi?</div>
                <div className="text-slate-600 leading-relaxed">
                  Mahalla raisi qonunchilikka asosan murojaatni 24 soat ichida ko'rib chiqadi va tegishli ustaga biriktiradi.
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="font-bold text-slate-900 mb-1">Qarshi shahri Vatanparvar MFY raisi:</div>
                <div className="text-slate-600 leading-relaxed">
                  Rustam Boboyev<br />
                  Telefon: +998 75 221-45-88 / +998 90 123 45 67<br />
                  Manzil: Mustaqillik shoh ko'chasi 14-uy
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Tab Navigation (Natural Thumb Zone) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 max-w-md mx-auto">
        <div className="grid grid-cols-5 items-center h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'home' ? 'text-[#16834B]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Bosh</span>
          </button>

          <button
            onClick={() => setActiveTab('submit')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'submit' ? 'text-[#16834B]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Yuborish</span>
          </button>

          <button
            onClick={() => setActiveTab('my')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'my' ? 'text-[#16834B]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <ListFilter className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Murojaatlar</span>
          </button>

          <button
            onClick={() => setActiveTab('polls')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'polls' ? 'text-[#16834B]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Vote className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Ovoz</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'profile' ? 'text-[#16834B]' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
