import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  KeyRound,
  Radio,
  MessageSquare,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

interface BotOverviewData {
  online: boolean;
  botInfo: {
    id?: number;
    is_bot?: boolean;
    first_name?: string;
    username?: string;
    can_join_groups?: boolean;
  } | null;
  webhookInfo: {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  } | null;
  stats: {
    registeredTelegramUsers: number;
    totalComplaints: number;
    totalAnnouncements: number;
  };
  serverUrl: string;
  botUsername: string;
  servicePins?: {
    chairmanPin?: string;
    superAdminPin?: string;
  };
  security?: {
    superAdminAuth?: string;
    pinAuthDisabled?: boolean;
  };
  timestamp: string;
}

interface TelegramUser {
  id: string;
  fullName: string;
  role: string;
  telegramId: string | null;
  telegramUsername: string | null;
  createdAt: string;
  neighborhoodId: string | null;
}

export const BotManagementPanel: React.FC = () => {
  const [overview, setOverview] = useState<BotOverviewData | null>(null);
  const [usersList, setUsersList] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Broadcast form state
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastButtonText, setBroadcastButtonText] = useState<string>('📱 Mini Appni ochish');
  const [broadcastButtonUrl, setBroadcastButtonUrl] = useState<string>('');
  const [broadcastSending, setBroadcastSending] = useState<boolean>(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Direct message modal state
  const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);
  const [directMsgText, setDirectMsgText] = useState<string>('');
  const [directSending, setDirectSending] = useState<boolean>(false);
  const [directResult, setDirectResult] = useState<string | null>(null);

  // Role change state
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const fetchBotData = async () => {
    try {
      setRefreshing(true);
      const [ovRes, usersRes] = await Promise.all([
        fetch('/api/bot/overview'),
        fetch('/api/bot/users'),
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverview(ovData);
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsersList(Array.isArray(uData) ? uData : []);
      }
    } catch (err) {
      console.error('Error fetching bot data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBotData();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    try {
      setBroadcastSending(true);
      setBroadcastResult(null);

      const res = await fetch('/api/bot/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle.trim() || undefined,
          message: broadcastMessage.trim(),
          urlButtonText: broadcastButtonText.trim() || undefined,
          urlButtonLink: broadcastButtonUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setBroadcastResult(`✅ ${data.message || "Xabar Telegram foydalanuvchilariga muvaffaqiyatli yuborildi!"}`);
        setBroadcastTitle('');
        setBroadcastMessage('');
        fetchBotData();
      } else {
        setBroadcastResult(`❌ Xatolik: ${data.error || "Yuborilmadi"}`);
      }
    } catch (err: any) {
      setBroadcastResult(`❌ Xatolik: ${err.message}`);
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleSendDirect = async () => {
    if (!selectedUser?.telegramId || !directMsgText.trim()) return;

    try {
      setDirectSending(true);
      setDirectResult(null);

      const res = await fetch('/api/bot/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: selectedUser.telegramId,
          message: directMsgText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDirectResult("✅ Xabar Telegram orqali yetkazildi!");
        setTimeout(() => {
          setSelectedUser(null);
          setDirectMsgText('');
          setDirectResult(null);
        }, 1500);
      } else {
        setDirectResult(`❌ Xatolik: ${data.error || "Yuborilmadi"}`);
      }
    } catch (err: any) {
      setDirectResult(`❌ Xatolik: ${err.message}`);
    } finally {
      setDirectSending(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setChangingRoleId(userId);
      const res = await fetch('/api/bot/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        await fetchBotData();
      }
    } catch (err) {
      console.error('Role change error:', err);
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleSyncWebhook = async () => {
    try {
      setRefreshing(true);
      await fetch('/api/telegram/set-webhook');
      await fetchBotData();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">👑 Super Admin</span>;
      case 'CHAIRMAN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#16834B]">🏛 Rais</span>;
      case 'STAFF':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">👨‍🔧 Usta</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">👤 Fuqaro</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-300 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Yagona Server & Real-Vaqt Bog'lanish</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Telegram Bot Boshqaruv Markazi
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Ushbu sahifa va Telegram bot (<strong>@{overview?.botUsername || 'mahallaone_bot'}</strong>) yagona Express server hamda PostgreSQL bazasiga ulangan. Botdagi har bir murojaat va fuqaro darhol shu yerda aks etadi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleSyncWebhook}
              disabled={refreshing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border border-white/15 shadow-sm"
              title="Webhookni tekshirish va qayta sozlash"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? "Yangilanmoqda..." : "Sinxronlash"}</span>
            </button>

            <a
              href={`https://t.me/${overview?.botUsername || 'mahallaone_bot'}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-[#16834B] hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
            >
              <Bot className="w-4 h-4" />
              <span>Botni ochish</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Bot Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Bot holati</span>
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${overview?.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-lg font-bold text-slate-900">
              {overview?.online ? 'Faol (Online)' : 'Ulanmoqda...'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            @{overview?.botUsername || 'mahallaone_bot'}
          </div>
        </div>

        {/* Card 2: Registered Telegram Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Telegram fuqarolari</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {overview?.stats.registeredTelegramUsers || usersList.length} <span className="text-xs font-normal text-slate-400">nafar</span>
          </div>
          <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Bazaga to'liq biriktirilgan</span>
          </div>
        </div>

        {/* Card 3: Complaints via Bot */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Jami arizalar</span>
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {overview?.stats.totalComplaints || 0} <span className="text-xs font-normal text-slate-400">ta</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Telegram & Veb orqali yagona oqim
          </div>
        </div>

        {/* Card 4: Security & Super Admin Auth */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Admin Autentifikatsiyasi</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">SuperAdmin:</span>
              <span className="font-mono font-bold bg-emerald-50 text-[#16834B] px-1.5 py-0.5 rounded text-[11px]">ID: 5564730141</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Ruxsat:</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Serverda himoyalangan
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Broadcast Form & Registered Users Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Broadcast Message to all Telegram Users (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#16834B] flex items-center justify-center font-bold">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Telegramga xabar tarqatish</h2>
              <p className="text-[11px] text-slate-500">Barcha ro'yxatdan o'tgan fuqarolarga birdaniga yetkaziladi</p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E'lon / Xabar sarlavhasi
              </label>
              <input
                type="text"
                placeholder="Masalan: Ichimlik suvi ta'miri haqida xabarnoma"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16834B] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Xabar matni <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Fuqarolarga yetkazilishi kerak bo'lgan rasmiy ma'lumotni yozing..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16834B] focus:bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tugma matni
                </label>
                <input
                  type="text"
                  placeholder="📱 Mini Appni ochish"
                  value={broadcastButtonText}
                  onChange={(e) => setBroadcastButtonText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Maxsus havola (ixtiyoriy)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={broadcastButtonUrl}
                  onChange={(e) => setBroadcastButtonUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                />
              </div>
            </div>

            {broadcastResult && (
              <div className={`p-3 rounded-xl text-xs font-medium ${
                broadcastResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {broadcastResult}
              </div>
            )}

            <button
              type="submit"
              disabled={broadcastSending || !broadcastMessage.trim()}
              className="w-full py-3 bg-[#16834B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{broadcastSending ? "Yuborilmoqda..." : "Barcha Telegram fuqarolariga yuborish"}</span>
            </button>
          </form>

          {/* Integration Info Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-[11px] text-slate-600">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Yagona Server Arxitekturasi</span>
            </div>
            <p>
              Ushbu tizimda alohida bot serveri yo'q. Frontend, Telegram Webhook hamda PostgreSQL bitta Node.js Express serverida ishlaydi. Bu orqali 100% real-vaqt ma'lumotlar sinxronligi kafolatlanadi.
            </p>
          </div>
        </div>

        {/* Right Column: Telegram Users Management Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Telegram Bot Foydalanuvchilari</h2>
                <p className="text-[11px] text-slate-500">Bot orqali tizimga ulangan barcha fuqarolar va rahbarlar</p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              Jami: {usersList.length} ta
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-[#16834B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : usersList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <Bot className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <div className="text-xs font-semibold text-slate-600">Hozircha Telegram foydalanuvchilari yo'q</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Telegramda <strong>@{overview?.botUsername || 'mahallaone_bot'}</strong> botiga kirib <code>/start</code> bosgan fuqarolar avtomatik bu yerda ko'rinadi.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2.5">Foydalanuvchi</th>
                    <th className="pb-2.5">Telegram ID</th>
                    <th className="pb-2.5">Joriy Rol</th>
                    <th className="pb-2.5 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                          {u.telegramUsername ? `@${u.telegramUsername}` : 'Username yo\'q'}
                        </div>
                      </td>

                      <td className="py-3 font-mono text-[11px] text-slate-600">
                        {u.telegramId || '—'}
                      </td>

                      <td className="py-3">
                        {roleBadge(u.role)}
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Direct Message Button */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setDirectResult(null);
                              setDirectMsgText('');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-[#16834B] hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                            title="Shaxsiy Telegram xabar yuborish"
                          >
                            <Send className="w-3 h-3" />
                            <span>Xabar</span>
                          </button>

                          {/* Quick Role Switcher Dropdown */}
                          <select
                            value={u.role}
                            disabled={changingRoleId === u.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="text-[11px] py-1 px-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16834B]"
                          >
                            <option value="CITIZEN">Fuqaro</option>
                            <option value="CHAIRMAN">Mahalla Raisi</option>
                            <option value="STAFF">Usta</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Direct Message Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#16834B] flex items-center justify-center font-bold text-xs">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Shaxsiy Telegram xabari</h3>
                  <p className="text-[11px] text-slate-500">Kimga: {selectedUser.fullName} (@{selectedUser.telegramUsername || selectedUser.telegramId})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Xabar matni
              </label>
              <textarea
                rows={4}
                autoFocus
                placeholder="Ushbu fuqaroning Telegramiga bevosita boradigan xabarni yozing..."
                value={directMsgText}
                onChange={(e) => setDirectMsgText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16834B] focus:bg-white resize-none"
              />
            </div>

            {directResult && (
              <div className={`p-2.5 rounded-xl text-xs font-medium ${
                directResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
              }`}>
                {directResult}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSendDirect}
                disabled={directSending || !directMsgText.trim()}
                className="px-4 py-2 bg-[#16834B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{directSending ? "Yuborilmoqda..." : "Yuborish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
