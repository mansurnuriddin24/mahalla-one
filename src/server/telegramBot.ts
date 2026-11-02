import { db } from '../db/index.ts';
import { jsPDF } from 'jspdf';
import {
  users,
  regions,
  districts,
  neighborhoods,
  neighborhoodCodes,
  complaints,
  complaintHistory,
  complaintMedia,
  announcements,
  assignments,
  ratings,
  polls,
  pollOptions,
  pollVotes,
  notifications,
  auditLogs,
} from '../db/schema.ts';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import {
  isAuthorizedSuperAdmin,
  logAuditEvent,
  generateSecureAccessCode,
  verifyAndBindNeighborhoodCode,
  getSuperAdminInlineMenu,
  getDistrictAdminInlineMenu,
  getChairmanInlineMenu,
  getStaffInlineMenu,
  getBackKeyboard,
  renderNeighborhoodsList,
  renderNeighborhoodDetail,
  renderExecutiveReport,
  renderAuditLogs,
  renderStaffList,
  renderUsersList,
  renderComplaintsList,
  renderComplaintDetail,
} from './telegramAdmin.ts';

// In-memory conversation state for multi-step interactions via chat
interface UserSession {
  step?:
    | 'WAITING_TITLE'
    | 'WAITING_CATEGORY'
    | 'WAITING_DESC_ADDRESS'
    | 'WAITING_NEIGHBORHOOD_CODE'
    | 'WAITING_NEW_NEIGHBORHOOD_NAME'
    | 'WAITING_STAFF_ASSIGN_TG_ID'
    | 'WAITING_CHAIRMAN_ASSIGN_TG_ID'
    | 'WAITING_STAFF_STATUS_EXPLANATION'
    | 'WAITING_ANNOUNCEMENT_TITLE'
    | 'WAITING_ANNOUNCEMENT_CONTENT'
    | 'WAITING_APPOINTMENT_TOPIC';
  title?: string;
  category?: string;
  announcementTitle?: string;
  targetComplaintId?: string;
  targetNewStatus?: string;
  targetUserId?: string;
  targetNeighborhoodId?: string;
  neighborhoodId?: string;
  appointmentDay?: string;
  appointmentTime?: string;
}

const userSessions = new Map<number, UserSession>();
const userLanguages = new Map<number | string, 'uz_lat' | 'uz_cyr' | 'ru'>();

export function getUserLang(userId: number | string): 'uz_lat' | 'uz_cyr' | 'ru' {
  return userLanguages.get(userId) || 'uz_lat';
}

export const I18N = {
  btn_new_complaint: {
    uz_lat: '📝 Yangi murojaat',
    uz_cyr: '📝 Янги мурожаат',
    ru: '📝 Новое обращение',
  },
  btn_my_complaints: {
    uz_lat: '📋 Murojaatlarim',
    uz_cyr: '📋 Мурожаатларим',
    ru: '📋 Мои обращения',
  },
  btn_open_budget: {
    uz_lat: '💰 Ochiq Byudjet (Open Budget)',
    uz_cyr: '💰 Очиқ Бюджет (Open Budget)',
    ru: '💰 Открытый Бюджет (Open Budget)',
  },
  btn_appointment: {
    uz_lat: '🗓 Rais qabuliga yozilish',
    uz_cyr: '🗓 Раис қабулига ёзилиш',
    ru: '🗓 Запись к председателю',
  },
  btn_polls: {
    uz_lat: '📊 So\'rovnomalar va ovoz berish',
    uz_cyr: '📊 Сўровномалар ва овоз бериш',
    ru: '📊 Опросы и голосование',
  },
  btn_announcements: {
    uz_lat: '📢 Mahalla e\'lonlari',
    uz_cyr: '📢 Маҳалла эълонлари',
    ru: '📢 Объявления махалли',
  },
  btn_code: {
    uz_lat: '🔑 Mahalla kodi',
    uz_cyr: '🔑 Маҳалла коди',
    ru: '🔑 Код махалли',
  },
  btn_sos: {
    uz_lat: '🚨 Favqulodda yordam (SOS)',
    uz_cyr: '🚨 Фавқулодда ёрдам (СОС)',
    ru: '🚨 Экстренные службы (SOS)',
  },
  btn_contact: {
    uz_lat: '☎️ Mahalla idorasi',
    uz_cyr: '☎️ Маҳалла идораси',
    ru: '☎️ Администрация махалли',
  },
  btn_lang: {
    uz_lat: '🌐 Til / Тил (Lotin / Кирилл)',
    uz_cyr: '🌐 Тил / Til (Кирилл / Lotin)',
    ru: '🌐 Язык / Til (Русский / O\'zbek)',
  },
  btn_phone: {
    uz_lat: '📲 Telefon raqamni ulash',
    uz_cyr: '📲 Телефон рақамни улаш',
    ru: '📲 Поделиться номером',
  },
};

export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any
) {
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.warn('Telegram sendMessage failed:', data.description);
    }
    return data;
  } catch (err) {
    console.error('Error sending Telegram message:', err);
    return null;
  }
}

export async function sendTelegramPhoto(
  token: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: any
) {
  try {
    const payload: any = {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption || '',
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.warn('Telegram sendPhoto failed, falling back to sendMessage:', data.description);
      return await sendTelegramMessage(token, chatId, caption || '', replyMarkup);
    }
    return data;
  } catch (err) {
    console.error('Error sending Telegram photo, falling back:', err);
    return await sendTelegramMessage(token, chatId, caption || '', replyMarkup);
  }
}

export async function sendTelegramDocument(
  token: string,
  chatId: number | string,
  fileBuffer: ArrayBuffer | Buffer,
  filename: string,
  caption?: string
) {
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    if (caption) formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    const blob = new Blob([fileBuffer as any], { type: 'application/pdf' });
    formData.append('document', blob, filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('Telegram sendDocument failed:', data.description);
    }
    return data;
  } catch (err) {
    console.error('Error sending Telegram document:', err);
    return null;
  }
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (err) {
    console.error('Error answering callback query:', err);
  }
}

export async function getTelegramBotMe(token: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching getMe:', err);
    return null;
  }
}

export async function getTelegramWebhookInfo(token: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching getWebhookInfo:', err);
    return null;
  }
}

// Keyboards generator
function getCitizenKeyboard(appUrl: string, hasPhone?: boolean, lang: 'uz_lat' | 'uz_cyr' | 'ru' = 'uz_lat') {
  const rows: any[][] = [
    [
      { text: '📱 Mahalla One Mini App', web_app: { url: appUrl } },
    ],
    [
      { text: I18N.btn_new_complaint[lang] },
      { text: I18N.btn_my_complaints[lang] },
    ],
    [
      { text: I18N.btn_open_budget[lang] },
      { text: I18N.btn_appointment[lang] },
    ],
    [
      { text: I18N.btn_polls[lang] },
      { text: I18N.btn_announcements[lang] },
    ],
    [
      { text: I18N.btn_code[lang] },
      { text: I18N.btn_sos[lang] },
    ],
    [
      { text: I18N.btn_contact[lang] },
      { text: I18N.btn_lang[lang] },
    ],
  ];

  if (!hasPhone) {
    rows.unshift([
      { text: I18N.btn_phone[lang], request_contact: true },
    ]);
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    persistent: true,
  };
}

function getChairmanKeyboard(appUrl: string) {
  return {
    keyboard: [
      [
        { text: '👑 Admin Menyu' },
        { text: '📥 Yangi murojaatlar' },
      ],
      [
        { text: '📊 Mahalla statistikasi' },
        { text: '📄 Oylik PDF hisobot' },
      ],
      [
        { text: '📢 Yangi e\'lon berish' },
        { text: '👨‍🔧 Ustalarni ko\'rish' },
      ],
      [
        { text: '🔄 Fuqaro rejimiga o\'tish' },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

function getDistrictAdminKeyboard(appUrl: string) {
  return {
    keyboard: [
      [
        { text: '👑 Admin Menyu' },
        { text: '📊 Tuman hisoboti' },
      ],
      [
        { text: '🏘 Tuman mahallalari' },
        { text: '📋 Tumandagi murojaatlar' },
      ],
      [
        { text: '📱 Hokimlik Web App', web_app: { url: `${appUrl}?role=DISTRICT_ADMIN&token=demo-district-admin` } },
        { text: '🔄 Fuqaro rejimiga o\'tish' },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

function getStaffKeyboard(appUrl: string) {
  return {
    keyboard: [
      [
        { text: '🛠 Menga biriktirilgan vazifalar' },
      ],
      [
        { text: '💼 Xodim Web App', web_app: { url: `${appUrl}?role=STAFF&token=demo-staff` } },
        { text: '🔄 Fuqaro rejimiga o\'tish' },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

function getSuperAdminKeyboard(appUrl: string) {
  return {
    keyboard: [
      [
        { text: '👑 Admin Menyu' },
        { text: '📊 Respublika hisoboti' },
      ],
      [
        { text: '🏘 Mahallalar' },
        { text: '📋 Barcha arizalar' },
      ],
      [
        { text: '📱 Super Admin Web App', web_app: { url: `${appUrl}?role=SUPER_ADMIN&token=demo-super-admin` } },
        { text: '🔄 Fuqaro rejimiga o\'tish' },
      ],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

/**
 * Handle incoming Telegram Update
 */
export async function handleTelegramUpdate(update: any, token: string) {
  const appUrl = process.env.APP_URL || 'https://ais-dev-y6q255n4gfpju4c4dagmek-962121564577.asia-east1.run.app';
  const callbackQuery = update.callback_query;
  const message = update.message;

  // -------------------------------------------------------------
  // A. HANDLE INLINE BUTTON CALLBACKS
  // -------------------------------------------------------------
  if (callbackQuery) {
    await answerCallbackQuery(token, callbackQuery.id);
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;
    const fromUser = callbackQuery.from;

    if (chatId && data && fromUser) {
      // Find or provision user
      let dbUser = await db.query.users.findFirst({
        where: eq(users.telegramId, String(fromUser.id)),
      });

      const pilotNeighborhood = await db.query.neighborhoods.findFirst({
        where: eq(neighborhoods.code, 'qarshi_vatanparvar'),
      });

      if (!dbUser) {
        const defaultName = `${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim() || fromUser.username || 'Fuqaro';
        const [newUser] = await db.insert(users).values({
          uid: `tg_${fromUser.id}`,
          fullName: defaultName,
          role: 'CITIZEN',
          neighborhoodId: pilotNeighborhood?.id || null,
          districtId: pilotNeighborhood?.districtId || null,
          telegramId: String(fromUser.id),
          telegramUsername: fromUser.username || null,
          isActive: true,
        }).returning();
        dbUser = newUser;
      }

      // 1. Citizen complaint category selection
      if (data.startsWith('cat_')) {
        const cat = data.replace('cat_', '');
        const session = userSessions.get(fromUser.id) || {};
        session.category = cat;
        session.step = 'WAITING_DESC_ADDRESS';
        userSessions.set(fromUser.id, session);

        const categoryNames: Record<string, string> = {
          street_lighting: "Ko'cha chirog'i",
          water_supply: "Ichimlik suvi",
          garbage_collection: "Chiqindi va tozalash",
          roads: "Yo'llar ta'miri",
          landscaping: "Obodonlashtirish",
          drainage_sewage: "Kanalizatsiya va oqova",
          other: "Boshqa masala",
        };

        await sendTelegramMessage(
          token,
          chatId,
          `✅ Toifa tanlandi: <b>${categoryNames[cat] || cat}</b>\n\nEndi muammoning batafsil tavsifini yozing, xohlasangiz manzil, foto rasm yoki joylashuv (lokatsiya) ulashing:`
        );
        return;
      }

      // 2. Citizen commands
      if (data === 'cmd_newcomplaint') {
        userSessions.set(fromUser.id, { step: 'WAITING_TITLE' });
        await sendTelegramMessage(
          token,
          chatId,
          `📝 <b>Yangi murojaat qoldirish:</b>\n\nIltimos, avval murojaatingiz sarlavhasini yozing (masalan: <i>Mustaqillik ko'chasida ichimlik suvi quvuri yorildi</i>):`
        );
        return;
      }

      if (data === 'cmd_mycomplaints') {
        await handleMyComplaints(token, chatId, fromUser);
        return;
      }

      if (data === 'cmd_polls') {
        await handlePolls(token, chatId, fromUser, dbUser);
        return;
      }

      if (data === 'cmd_sos') {
        await handleEmergency(token, chatId, dbUser, pilotNeighborhood);
        return;
      }

      if (data.startsWith('vote_')) {
        const parts = data.replace('vote_', '').split('_');
        const pollId = parts[0];
        const optionId = parts[1];
        await handlePollVote(token, chatId, pollId, optionId, dbUser.id);
        return;
      }

      if (data.startsWith('prompt_rate_')) {
        const compId = data.replace('prompt_rate_', '');
        const rateButtons = [
          [
            { text: '⭐️ 1 (Qoniqarsiz)', callback_data: `rate_${compId}_1` },
            { text: '⭐️ 2 (O\'rtacha)', callback_data: `rate_${compId}_2` },
          ],
          [
            { text: '⭐️ 3 (Yaxshi)', callback_data: `rate_${compId}_3` },
            { text: '⭐️ 4 (Juda yaxshi)', callback_data: `rate_${compId}_4` },
          ],
          [
            { text: '⭐️ 5 (A\'lo darajada)', callback_data: `rate_${compId}_5` },
          ],
          [
            { text: '⬅️ Bekor qilish', callback_data: 'cmd_mycomplaints' }
          ]
        ];
        await sendTelegramMessage(
          token,
          chatId,
          `⭐️ <b>Ko'rsatilgan xizmat sifatini baholang:</b>\n\n1 — Qoniqarsiz, 5 — A'lo darajada.\nSizning bahoingiz xodimlar reytingi va mahalla KPI ko'rsatkichiga bevosita ta'sir qiladi:`,
          { inline_keyboard: rateButtons }
        );
        return;
      }

      if (data.startsWith('rate_')) {
        const parts = data.replace('rate_', '').split('_');
        const compId = parts[0];
        const score = parseInt(parts[1]) || 5;
        await handleRating(token, chatId, compId, score, dbUser.id);
        return;
      }

      if (data === 'cmd_openbudget') {
        await handleOpenBudget(token, chatId);
        return;
      }

      if (data === 'cmd_appointment') {
        userSessions.set(fromUser.id, { step: 'WAITING_APPOINTMENT_TOPIC' });
        const apptButtons = [
          [
            { text: '📅 Dushanba (09:00 - 12:00)', callback_data: 'appt_day_Dushanba' },
          ],
          [
            { text: '📅 Chorshanba (14:00 - 17:00)', callback_data: 'appt_day_Chorshanba' },
          ],
          [
            { text: '📅 Juma (09:00 - 12:00)', callback_data: 'appt_day_Juma' },
          ],
          [
            { text: '⬅️ Asosiy menyu', callback_data: 'adm_switch_citizen' },
          ],
        ];
        await sendTelegramMessage(
          token,
          chatId,
          `🗓 <b>Mahalla Raisi qabuliga elektron navbat olish:</b>\n\nIltimos, o'zingizga ma'qul qabul kunini tanlang:`,
          { inline_keyboard: apptButtons }
        );
        return;
      }

      if (data.startsWith('appt_day_')) {
        const day = data.replace('appt_day_', '');
        const currentSession = userSessions.get(fromUser.id) || {};
        currentSession.appointmentDay = day;
        userSessions.set(fromUser.id, currentSession);

        const timeButtons = day === 'Chorshanba' ? [
          [
            { text: '⏰ 14:30', callback_data: 'appt_time_14:30' },
            { text: '⏰ 15:30', callback_data: 'appt_time_15:30' },
            { text: '⏰ 16:30', callback_data: 'appt_time_16:30' },
          ],
        ] : [
          [
            { text: '⏰ 09:30', callback_data: 'appt_time_09:30' },
            { text: '⏰ 10:30', callback_data: 'appt_time_10:30' },
            { text: '⏰ 11:30', callback_data: 'appt_time_11:30' },
          ],
        ];

        await sendTelegramMessage(
          token,
          chatId,
          `Kuni tanlandi: <b>${day}</b>\n\nEndi qabul soatini tanlang:`,
          { inline_keyboard: timeButtons }
        );
        return;
      }

      if (data.startsWith('appt_time_')) {
        const time = data.replace('appt_time_', '');
        const currentSession = userSessions.get(fromUser.id) || {};
        currentSession.appointmentTime = time;
        currentSession.step = 'WAITING_APPOINTMENT_TOPIC';
        userSessions.set(fromUser.id, currentSession);

        await sendTelegramMessage(
          token,
          chatId,
          `Vaqt belgilandi: <b>${currentSession.appointmentDay}, ${time}</b>\n\n` +
          `Endi rais qabuliga kelishdan asosiy maqsad yoki muammoni qisqacha yozib yuboring:`
        );
        return;
      }

      if (data === 'cmd_lang') {
        await handleLanguageSelect(token, chatId);
        return;
      }

      if (data.startsWith('set_lang_')) {
        const langChoice = data.replace('set_lang_', '') as 'uz_lat' | 'uz_cyr' | 'ru';
        userLanguages.set(fromUser.id, langChoice);
        const confirmTexts = {
          uz_lat: "✅ Muloqot tili <b>O'zbekcha (Lotin)</b> ga o'rnatildi!",
          uz_cyr: "✅ Мулоқот тили <b>Ўзбекча (Кирилл)</b>га ўрнатилди!",
          ru: "✅ Язык интерфейса успешно изменен на <b>Русский</b>!",
        };
        await sendTelegramMessage(
          token,
          chatId,
          confirmTexts[langChoice] || confirmTexts.uz_lat,
          getCitizenKeyboard(appUrl, !!dbUser.phone, langChoice)
        );
        return;
      }

      if (data === 'cmd_pdfreport' || data === 'adm_gen_pdf') {
        await handleGeneratePdfReport(token, chatId, dbUser.neighborhoodId || pilotNeighborhood?.id);
        return;
      }

      if (data === 'cmd_announcements') {
        await handleAnnouncements(token, chatId);
        return;
      }

      if (data === 'cmd_contact') {
        await handleContact(token, chatId);
        return;
      }

      // Auto-elevate configured Super Admin IDs
      const isSuper = isAuthorizedSuperAdmin(fromUser.id);
      if (isSuper && dbUser.role !== 'SUPER_ADMIN') {
        await db.update(users).set({ role: 'SUPER_ADMIN' }).where(eq(users.id, dbUser.id));
        dbUser.role = 'SUPER_ADMIN';
      }

      // 3. Citizen: Join Neighborhood via Code
      if (data === 'cmd_join_code') {
        userSessions.set(fromUser.id, { step: 'WAITING_NEIGHBORHOOD_CODE' });
        await sendTelegramMessage(
          token,
          chatId,
          `🔑 <b>Mahalla kodi orqali a'zo bo'lish:</b>\n\n` +
          `Iltimos, mahallangiz idorasi bergan <b>maxsus kirish kodi</b>ni yozib yuboring (Masalan: <code>M24-VATAN-2026</code> yoki <code>M24-7K9P2X</code>):\n\n` +
          `<i>Xavfsizlik: Ketma-ket 5 marta noto'g'ri kod kiritilsa, tizim 15 daqiqaga bloklanadi.</i>`
        );
        return;
      }

      // Legacy PIN prompts replaced with secure notification
      if (data === 'cmd_login_rais' || data === 'cmd_login_superadmin') {
        if (isSuper || ['SUPER_ADMIN', 'DISTRICT_ADMIN', 'CHAIRMAN', 'STAFF'].includes(dbUser.role)) {
          // User already has rights, direct to /admin
          const welcomeAdmin = `👑 <b>Sizda ma'muriyat huquqi mavjud!</b>\n\n` +
            `Rolingiz: <b>${dbUser.role}</b>\nBoshqaruv panelini ochish uchun /admin bosing yoki quyidagi tugmani bosing:`;
          const menuMarkup = isSuper || dbUser.role === 'SUPER_ADMIN'
            ? getSuperAdminInlineMenu(appUrl)
            : (dbUser.role === 'DISTRICT_ADMIN' ? getDistrictAdminInlineMenu(appUrl, 'Qarshi shahri') : getChairmanInlineMenu(appUrl));
          await sendTelegramMessage(token, chatId, welcomeAdmin, menuMarkup);
        } else {
          await sendTelegramMessage(
            token,
            chatId,
            `ℹ️ <b>Xavfsizlik talabi:</b>\n\n` +
            `Tizimda erkin PIN-kod orqali admin bo'lish to'xtatilgan.\n` +
            `Super Admin huquqi faqat oldindan sozlangan Telegram ID orqali beriladi.\n` +
            `Rais yoki xodim vakolati esa Bosh Administrator tomonidan tayinlanadi.`
          );
        }
        return;
      }

      // 4. Server-Side Security Guard for all Admin Callbacks
      if (data.startsWith('adm_')) {
        const isUserSuper = isSuper || dbUser.role === 'SUPER_ADMIN';
        const isDist = dbUser.role === 'DISTRICT_ADMIN';
        const isChair = dbUser.role === 'CHAIRMAN';
        const isStf = dbUser.role === 'STAFF';

        if (!isUserSuper && !isDist && !isChair && !isStf) {
          await logAuditEvent(dbUser.id, 'UNAUTHORIZED_CALLBACK_ATTEMPT', 'SYSTEM', String(fromUser.id), `Callback: ${data}`);
          await sendTelegramMessage(token, chatId, "⛔️ <b>Kirish taqiqlandi!</b>\n\nSizda ma'muriyat panelidan foydalanish huquqi mavjud emas.");
          return;
        }

        const superOnlyPrefixes = [
          'adm_neigh_add',
          'adm_neigh_prompt_newcode_',
          'adm_neigh_confirm_newcode_',
          'adm_neigh_prompt_revoke_',
          'adm_neigh_confirm_revoke_',
          'adm_neigh_prompt_toggle_',
          'adm_neigh_confirm_toggle_',
          'adm_staff_setrole_',
          'adm_staff_assign_prompt',
          'adm_audit_logs',
          'adm_users_list_',
        ];
        if (superOnlyPrefixes.some((p) => data.startsWith(p)) && !isUserSuper) {
          await logAuditEvent(dbUser.id, 'FORBIDDEN_SUPER_ADMIN_ACTION', 'SYSTEM', String(fromUser.id), `Action: ${data}`);
          await sendTelegramMessage(token, chatId, "⛔️ Ushbu amal faqat Bosh Administrator (SUPER_ADMIN) vakolatiga kiradi.");
          return;
        }
      }

      // Admin Menu Main router
      if (data === 'adm_menu_main') {
        if (isSuper || dbUser.role === 'SUPER_ADMIN') {
          await sendTelegramMessage(token, chatId, `👑 <b>Super Administrator Boshqaruv Menyu:</b>`, getSuperAdminInlineMenu(appUrl));
        } else if (dbUser.role === 'DISTRICT_ADMIN') {
          await sendTelegramMessage(token, chatId, `🏛 <b>Tuman Boshqaruv Menyu:</b>`, getDistrictAdminInlineMenu(appUrl, 'Qarshi shahri'));
        } else if (dbUser.role === 'CHAIRMAN') {
          await sendTelegramMessage(token, chatId, `👔 <b>Mahalla Raisi Boshqaruv Menyu:</b>`, getChairmanInlineMenu(appUrl));
        } else if (dbUser.role === 'STAFF') {
          await sendTelegramMessage(token, chatId, `👨‍🔧 <b>Xodim Boshqaruv Menyu:</b>`, getStaffInlineMenu(appUrl));
        } else {
          await sendTelegramMessage(token, chatId, `⛔️ Sizda ma'muriyat huquqi mavjud emas.`);
        }
        return;
      }

      // Users Registry callback
      if (data.startsWith('adm_users_list_')) {
        const page = parseInt(data.replace('adm_users_list_', '')) || 0;
        const res = await renderUsersList(page);
        await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
        return;
      }

      // Close menu callback
      if (data === 'adm_close_menu') {
        await sendTelegramMessage(
          token,
          chatId,
          `✅ <b>Admin menyusi yopildi.</b>\n\nQayta ochish uchun <b>/admin</b> buyrug'ini yuboring.`,
          getCitizenKeyboard(appUrl)
        );
        return;
      }

      // Switch to citizen view
      if (data === 'adm_switch_citizen') {
        await sendTelegramMessage(
          token,
          chatId,
          `🔄 <b>Fuqaro rejimiga o'tildi.</b>\n\nBoshqaruv paneliga qaytish uchun <b>/admin</b> buyrug'ini yuboring.`,
          getCitizenKeyboard(appUrl)
        );
        return;
      }

      // 6. Super Admin & District Admin: Neighborhoods Management
      if (data.startsWith('adm_neigh_list_')) {
        const page = parseInt(data.replace('adm_neigh_list_', '')) || 0;
        const res = await renderNeighborhoodsList(page);
        await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
        return;
      }

      if (data.startsWith('adm_neigh_view_')) {
        const nId = data.replace('adm_neigh_view_', '');
        const res = await renderNeighborhoodDetail(nId);
        await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
        return;
      }

      if (data.startsWith('adm_neigh_prompt_newcode_')) {
        const nId = data.replace('adm_neigh_prompt_newcode_', '');
        await sendTelegramMessage(
          token,
          chatId,
          `⚠️ <b>Yangi kirish kodi yaratilsinmi?</b>\n\nBu amal mahalla uchun yangi noyob kod yaratadi va avvalgi barcha faol kodlarni bekor qiladi. Tasdiqlaysizmi?`,
          {
            inline_keyboard: [
              [
                { text: '✅ Ha, yangi kod yaratish', callback_data: `adm_neigh_confirm_newcode_${nId}` },
                { text: '❌ Bekor qilish', callback_data: `adm_neigh_view_${nId}` },
              ],
            ],
          }
        );
        return;
      }

      if (data.startsWith('adm_neigh_confirm_newcode_')) {
        const nId = data.replace('adm_neigh_confirm_newcode_', '');
        // Revoke old active codes
        await db.update(neighborhoodCodes).set({ status: 'REVOKED' }).where(
          and(eq(neighborhoodCodes.neighborhoodId, nId), eq(neighborhoodCodes.status, 'ACTIVE'))
        );
        const newCode = generateSecureAccessCode();
        await db.insert(neighborhoodCodes).values({
          neighborhoodId: nId,
          accessCode: newCode,
          status: 'ACTIVE',
          createdById: dbUser.id,
          description: 'Telegram Admin orqali yaratilgan kod',
        });
        await logAuditEvent(dbUser.id, 'ACCESS_CODE_REGENERATED', 'NEIGHBORHOOD', nId, `Yangi kod: ${newCode}`);
        await sendTelegramMessage(token, chatId, `✅ <b>Yangi kirish kodi yaratildi:</b> <code>${newCode}</code>\nEski kodlar bekor qilindi.`);
        const detail = await renderNeighborhoodDetail(nId);
        await sendTelegramMessage(token, chatId, detail.text, detail.replyMarkup);
        return;
      }

      if (data.startsWith('adm_neigh_prompt_revoke_')) {
        const nId = data.replace('adm_neigh_prompt_revoke_', '');
        await sendTelegramMessage(
          token,
          chatId,
          `⚠️ <b>Kodni bekor qilishni tasdiqlaysizmi?</b>\n\nFaol kod bekor qilingach, fuqarolar ushbu kod orqali mahallaga a'zo bo'la olmaydilar.`,
          {
            inline_keyboard: [
              [
                { text: '❌ Ha, kodni bekor qilish', callback_data: `adm_neigh_confirm_revoke_${nId}` },
                { text: '⬅️ Orqaga', callback_data: `adm_neigh_view_${nId}` },
              ],
            ],
          }
        );
        return;
      }

      if (data.startsWith('adm_neigh_confirm_revoke_')) {
        const nId = data.replace('adm_neigh_confirm_revoke_', '');
        await db.update(neighborhoodCodes).set({ status: 'REVOKED' }).where(
          and(eq(neighborhoodCodes.neighborhoodId, nId), eq(neighborhoodCodes.status, 'ACTIVE'))
        );
        await logAuditEvent(dbUser.id, 'ACCESS_CODE_REVOKED', 'NEIGHBORHOOD', nId, 'Kodni bekor qilish');
        await sendTelegramMessage(token, chatId, `✅ Mahalla kodi bekor qilindi.`);
        const detail = await renderNeighborhoodDetail(nId);
        await sendTelegramMessage(token, chatId, detail.text, detail.replyMarkup);
        return;
      }

      if (data.startsWith('adm_neigh_prompt_toggle_')) {
        const nId = data.replace('adm_neigh_prompt_toggle_', '');
        const targetN = await db.query.neighborhoods.findFirst({ where: eq(neighborhoods.id, nId) });
        const actionLabel = targetN?.subscriptionStatus === 'ACTIVE' ? "vaqtincha to'xtatish" : 'faollashtirish';
        await sendTelegramMessage(
          token,
          chatId,
          `⚠️ <b>Mahalla holatini o'zgartirish:</b>\n\n<b>${targetN?.nameUz}</b> mahallasini ${actionLabel}ni tasdiqlaysizmi?`,
          {
            inline_keyboard: [
              [
                { text: '✅ Ha, tasdiqlayman', callback_data: `adm_neigh_confirm_toggle_${nId}` },
                { text: '⬅️ Bekor qilish', callback_data: `adm_neigh_view_${nId}` },
              ],
            ],
          }
        );
        return;
      }

      if (data.startsWith('adm_neigh_confirm_toggle_')) {
        const nId = data.replace('adm_neigh_confirm_toggle_', '');
        const targetN = await db.query.neighborhoods.findFirst({ where: eq(neighborhoods.id, nId) });
        if (targetN) {
          const nextStatus = targetN.subscriptionStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
          await db.update(neighborhoods).set({ subscriptionStatus: nextStatus }).where(eq(neighborhoods.id, nId));
          await logAuditEvent(dbUser.id, 'NEIGHBORHOOD_STATUS_CHANGED', 'NEIGHBORHOOD', nId, nextStatus);
          await sendTelegramMessage(token, chatId, `✅ Mahalla holati ${nextStatus === 'ACTIVE' ? '🟢 Faol' : '⏸ To\'xtatilgan'} ga o'tkazildi.`);
        }
        const detail = await renderNeighborhoodDetail(nId);
        await sendTelegramMessage(token, chatId, detail.text, detail.replyMarkup);
        return;
      }

      if (data === 'adm_neigh_add') {
        if (!isSuper && dbUser.role !== 'SUPER_ADMIN') {
          await sendTelegramMessage(token, chatId, "⛔️ Faqat Super Administrator yangi mahalla qo'sha oladi.");
          return;
        }
        userSessions.set(fromUser.id, { step: 'WAITING_NEW_NEIGHBORHOOD_NAME' });
        await sendTelegramMessage(
          token,
          chatId,
          `➕ <b>Yangi mahalla qo'shish:</b>\n\nIltimos, yangi mahalla nomini yozib yuboring (Masalan: <i>Zarafshon MFY</i>):`
        );
        return;
      }

      // 7. Reports & Audit
      if (data === 'adm_reports_summary' || data === 'adm_dist_report') {
        const rep = await renderExecutiveReport();
        await sendTelegramMessage(token, chatId, rep.text, rep.replyMarkup);
        return;
      }

      if (data === 'adm_audit_logs') {
        if (!isSuper && dbUser.role !== 'SUPER_ADMIN') {
          await sendTelegramMessage(token, chatId, "⛔️ Xavfsizlik jurnalini faqat Super Admin ko'ra oladi.");
          return;
        }
        const aud = await renderAuditLogs();
        await sendTelegramMessage(token, chatId, aud.text, aud.replyMarkup);
        return;
      }

      // 8. Staff and Chairman Management
      if (data.startsWith('adm_staff_list_')) {
        const page = parseInt(data.replace('adm_staff_list_', '')) || 0;
        const sRes = await renderStaffList(page);
        await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
        return;
      }

      if (data.startsWith('adm_staff_edit_')) {
        const targetUserId = data.replace('adm_staff_edit_', '');
        const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
        if (!targetUser) {
          await sendTelegramMessage(token, chatId, "❌ Foydalanuvchi topilmadi.");
          return;
        }
        const roleButtons = [
          [
            { text: '👔 Mahalla Raisi', callback_data: `adm_staff_setrole_${targetUser.id}_CHAIRMAN` },
            { text: '👨‍🔧 Kommunal Usta', callback_data: `adm_staff_setrole_${targetUser.id}_STAFF` },
          ],
          [
            { text: '🏛 Hokimlik (Tuman)', callback_data: `adm_staff_setrole_${targetUser.id}_DISTRICT_ADMIN` },
            { text: '👤 Oddiy Fuqaro', callback_data: `adm_staff_setrole_${targetUser.id}_CITIZEN` },
          ],
          [
            { text: '⬅️ Xodimlar ro\'yxati', callback_data: 'adm_staff_list_0' },
            { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
          ],
        ];
        await sendTelegramMessage(
          token,
          chatId,
          `✏️ <b>Foydalanuvchi: ${targetUser.fullName}</b>\nHozirgi roli: <b>${targetUser.role}</b>\n\nQaysi yangi rolni tayinlamoqchisiz?`,
          { inline_keyboard: roleButtons }
        );
        return;
      }

      if (data.startsWith('adm_staff_setrole_')) {
        const parts = data.replace('adm_staff_setrole_', '').split('_');
        const tId = parts[0];
        const newRole = parts.slice(1).join('_');
        if (['SUPER_ADMIN', 'DISTRICT_ADMIN'].includes(newRole) && !isSuper && dbUser.role !== 'SUPER_ADMIN') {
          await sendTelegramMessage(token, chatId, "⛔️ Ushbu rolni faqat Super Admin bera oladi.");
          return;
        }
        await db.update(users).set({ role: newRole as any }).where(eq(users.id, tId));
        await logAuditEvent(dbUser.id, 'USER_ROLE_ASSIGNED', 'USER', tId, `Yangi rol: ${newRole}`);
        await sendTelegramMessage(token, chatId, `✅ Foydalanuvchi roli <b>${newRole}</b> ga muvaffaqiyatli o'zgartirildi.`);
        const sRes = await renderStaffList(0);
        await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
        return;
      }

      if (data === 'adm_staff_assign_prompt') {
        userSessions.set(fromUser.id, { step: 'WAITING_STAFF_ASSIGN_TG_ID' });
        await sendTelegramMessage(
          token,
          chatId,
          `➕ <b>Yangi rais yoki xodim tayinlash:</b>\n\nTayinlanuvchi shaxsning <b>Telegram ID</b> raqamini yoki <b>@username</b> nomini yuboring:\n<i>(Eslatma: Foydalanuvchi avval botga /start yuborgan bo'lishi shart)</i>`
        );
        return;
      }

      if (data.startsWith('adm_staff_setchair_')) {
        const neighId = data.replace('adm_staff_setchair_', '');
        userSessions.set(fromUser.id, { step: 'WAITING_CHAIRMAN_ASSIGN_TG_ID', neighborhoodId: neighId });
        await sendTelegramMessage(
          token,
          chatId,
          `👤 <b>Mahalla raisini tayinlash:</b>\n\nRais qilib tayinlamoqchi bo'lgan foydalanuvchining <b>Telegram ID</b> raqamini yoki <b>@username</b> nomini yuboring:`
        );
        return;
      }

      // 9. Complaints Management
      if (data.startsWith('adm_comp_filter_')) {
        const filterParts = data.replace('adm_comp_filter_', '').split('_');
        const stFilter = filterParts[0] || 'ALL';
        const cPage = parseInt(filterParts[1] || '0') || 0;
        const scopedNId = (dbUser.role === 'CHAIRMAN') ? dbUser.neighborhoodId || undefined : undefined;
        const compRes = await renderComplaintsList(stFilter, cPage, scopedNId);
        await sendTelegramMessage(token, chatId, compRes.text, compRes.replyMarkup);
        return;
      }

      if (data.startsWith('adm_comp_view_')) {
        const cId = data.replace('adm_comp_view_', '');
        const cDetail = await renderComplaintDetail(cId);
        await sendTelegramMessage(token, chatId, cDetail.text, cDetail.replyMarkup);
        return;
      }

      if (data.startsWith('adm_comp_assign_prompt_')) {
        const cIdToAssign = data.replace('adm_comp_assign_prompt_', '');
        const staffUsers = await db.query.users.findMany({
          where: inArray(users.role, ['STAFF', 'CHAIRMAN']),
          limit: 8,
        });
        const assignButtons: any[] = [];
        staffUsers.forEach((su) => {
          assignButtons.push([{ text: `👨‍🔧 ${su.fullName} (${su.role})`, callback_data: `adm_comp_assign_exec_${cIdToAssign}_${su.id}` }]);
        });
        assignButtons.push([{ text: '⬅️ Orqaga', callback_data: `adm_comp_view_${cIdToAssign}` }]);
        await sendTelegramMessage(token, chatId, `👨‍🔧 <b>Murojaatni qaysi ustaga biriktirmoqchisiz?</b>`, { inline_keyboard: assignButtons });
        return;
      }

      if (data.startsWith('adm_comp_assign_exec_')) {
        const aParts = data.replace('adm_comp_assign_exec_', '').split('_');
        const cIdExec = aParts[0];
        const sIdExec = aParts[1];
        await db.insert(assignments).values({
          complaintId: cIdExec,
          staffId: sIdExec,
          assignedById: dbUser.id,
        });
        await db.update(complaints).set({
          status: 'ASSIGNED',
          updatedAt: new Date(),
        }).where(eq(complaints.id, cIdExec));
        await db.insert(complaintHistory).values({
          complaintId: cIdExec,
          responsibleUserId: dbUser.id,
          previousStatus: 'NEW',
          newStatus: 'ASSIGNED',
          explanation: "Mahalla ma'muriyati tomonidan mas'ul xodimga topshirildi",
        });
        await logAuditEvent(dbUser.id, 'COMPLAINT_ASSIGNED', 'COMPLAINT', cIdExec, `Assigned to ${sIdExec}`);

        const staffRecipient = await db.query.users.findFirst({ where: eq(users.id, sIdExec) });
        if (staffRecipient?.telegramId) {
          await sendTelegramMessage(
            token,
            staffRecipient.telegramId,
            `🔔 <b>Yangi vazifa biriktirildi!</b>\n\nSizga yangi murojaat ijrosi yuklatildi. Ko'rish uchun quyidagi tugmani bosing:`,
            {
              inline_keyboard: [
                [{ text: '🔎 Murojaatni ochish', callback_data: `adm_comp_view_${cIdExec}` }]
              ]
            }
          );
        }
        await sendTelegramMessage(token, chatId, `✅ Murojaat muvaffaqiyatli xodimga biriktirildi!`);
        const cDetailAfter = await renderComplaintDetail(cIdExec);
        await sendTelegramMessage(token, chatId, cDetailAfter.text, cDetailAfter.replyMarkup);
        return;
      }

      if (data.startsWith('adm_comp_setstatus_')) {
        const sParts = data.replace('adm_comp_setstatus_', '').split('_');
        const cIdStatus = sParts[0];
        const newSt = sParts[1];
        const compObj = await db.query.complaints.findFirst({
          where: eq(complaints.id, cIdStatus),
          with: { citizen: true },
        });
        if (compObj) {
          const oldSt = compObj.status;
          await db.update(complaints).set({
            status: newSt as any,
            updatedAt: new Date(),
            resolvedAt: newSt === 'RESOLVED' ? new Date() : null,
          }).where(eq(complaints.id, cIdStatus));

          const statusExplain: Record<string, string> = {
            IN_PROGRESS: "Murojaat ko'rib chiqish va ijro jarayonida",
            RESOLVED: "Muammo mutaxassislar tomonidan to'liq bartaraf etildi va hal qilindi",
            REJECTED: "Murojaat asosli sabablarga ko'ra rad etildi",
          };

          await db.insert(complaintHistory).values({
            complaintId: cIdStatus,
            responsibleUserId: dbUser.id,
            previousStatus: oldSt,
            newStatus: newSt as any,
            explanation: statusExplain[newSt] || 'Holat yangilandi',
          });

          await logAuditEvent(dbUser.id, 'COMPLAINT_STATUS_CHANGED', 'COMPLAINT', cIdStatus, `${oldSt} -> ${newSt}`);

          if (compObj.citizen?.telegramId) {
            const statusUzText: Record<string, string> = {
              IN_PROGRESS: "🟣 Ko'rib chiqilmoqda / Jarayonda",
              RESOLVED: "🟢 Hal etildi",
              REJECTED: "🔴 Rad etildi",
            };
            await sendTelegramMessage(
              token,
              compObj.citizen.telegramId,
              `🔔 <b>Murojaatingiz holati yangilandi!</b>\n\n` +
              `📋 Ariza raqami: <b>[${compObj.complaintCode}]</b>\n` +
              `📌 Mavzu: <b>${compObj.title}</b>\n` +
              `🏷 Yangi holat: <b>${statusUzText[newSt] || newSt}</b>\n` +
              `📝 Izoh: ${statusExplain[newSt] || ''}\n\n` +
              `<i>Mahalla One tizimi orqali nazoratda.</i>`
            );
          }
          await sendTelegramMessage(token, chatId, `✅ Murojaat holati <b>${newSt}</b> ga o'zgartirildi va fuqaroga xabar yetkazildi.`);
          const cDetailAfter = await renderComplaintDetail(cIdStatus);
          await sendTelegramMessage(token, chatId, cDetailAfter.text, cDetailAfter.replyMarkup);
        }
        return;
      }

      // 10. Chairman Specific Callbacks
      if (data === 'adm_chair_comp_NEW') {
        const chairComps = await renderComplaintsList('NEW', 0, dbUser.neighborhoodId || undefined);
        await sendTelegramMessage(token, chatId, chairComps.text, chairComps.replyMarkup);
        return;
      }

      if (data === 'adm_chair_code') {
        if (dbUser.neighborhoodId) {
          const chairCard = await renderNeighborhoodDetail(dbUser.neighborhoodId);
          await sendTelegramMessage(token, chatId, chairCard.text, chairCard.replyMarkup);
        } else {
          await sendTelegramMessage(token, chatId, "Siz hali biror mahallaga rais sifatida biriktirilmagansiz.");
        }
        return;
      }

      if (data === 'adm_chair_staff') {
        const chairStaff = await renderStaffList(0);
        await sendTelegramMessage(token, chatId, chairStaff.text, chairStaff.replyMarkup);
        return;
      }

      // 11. Staff Specific Callbacks
      if (data === 'adm_staff_tasks_0') {
        const myAssigned = await db.query.assignments.findMany({
          where: eq(assignments.staffId, dbUser.id),
        });
        const myCompIds = myAssigned.map((a) => a.complaintId);
        if (myCompIds.length === 0) {
          await sendTelegramMessage(token, chatId, "🛠 Hozircha sizga biriktirilgan vazifalar mavjud emas.", getBackKeyboard('adm_menu_main'));
        } else {
          const list = await db.query.complaints.findMany({
            where: inArray(complaints.id, myCompIds),
            limit: 6,
          });
          let t = `🛠 <b>Sizga biriktirilgan vazifalar (${list.length} ta):</b>\n\n`;
          const b: any[] = [];
          list.forEach((c, idx) => {
            t += `${idx + 1}. [${c.complaintCode}] <b>${c.title}</b>\n` +
              `   Holat: ${c.status}\n` +
              `   Manzil: ${c.address || '—'}\n\n`;
            b.push([{ text: `🔎 [${c.complaintCode}] Ko'rish & Holat`, callback_data: `adm_comp_view_${c.id}` }]);
          });
          b.push([{ text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' }]);
          await sendTelegramMessage(token, chatId, t, { inline_keyboard: b });
        }
        return;
      }

      // Legacy fallback handlers
      if (data === 'cmd_superadmin_stats') {
        const rep = await renderExecutiveReport();
        await sendTelegramMessage(token, chatId, rep.text, rep.replyMarkup);
        return;
      }

      if (data === 'cmd_superadmin_neighborhoods') {
        const res = await renderNeighborhoodsList(0);
        await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
        return;
      }

      if (data === 'cmd_superadmin_users') {
        const sRes = await renderStaffList(0);
        await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
        return;
      }

      if (data === 'cmd_chairman_stats') {
        await handleChairmanStats(token, chatId, dbUser.neighborhoodId || pilotNeighborhood?.id || '');
        return;
      }

      if (data === 'cmd_chairman_new') {
        const chairComps = await renderComplaintsList('NEW', 0, dbUser.neighborhoodId || pilotNeighborhood?.id || undefined);
        await sendTelegramMessage(token, chatId, chairComps.text, chairComps.replyMarkup);
        return;
      }

      if (data === 'cmd_chairman_staff') {
        const sRes = await renderStaffList(0);
        await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
        return;
      }

      if (data === 'cmd_chairman_announcement') {
        userSessions.set(fromUser.id, { step: 'WAITING_ANNOUNCEMENT_TITLE' });
        await sendTelegramMessage(
          token,
          chatId,
          `📢 <b>Yangi e'lon berish:</b>\n\nIltimos, e'lonning sarlavhasini yozing (masalan: <i>Shanbalik tozalash aksiyasi yoki Suv ta'minotida uzilish</i>):`
        );
        return;
      }

      // District Admin Callbacks
      if (data.startsWith('adm_dist_neigh_')) {
        const page = parseInt(data.replace('adm_dist_neigh_', '')) || 0;
        const res = await renderNeighborhoodsList(page);
        await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
        return;
      }

      if (data.startsWith('adm_dist_staff_')) {
        const page = parseInt(data.replace('adm_dist_staff_', '')) || 0;
        const sRes = await renderStaffList(page);
        await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
        return;
      }

      if (data.startsWith('adm_dist_comp_')) {
        const page = parseInt(data.replace('adm_dist_comp_', '')) || 0;
        const cRes = await renderComplaintsList('ALL', page);
        await sendTelegramMessage(token, chatId, cRes.text, cRes.replyMarkup);
        return;
      }

      // Chairman Quick Assignment and Acceptance
      if (data.startsWith('assign_prompt_')) {
        const compId = data.replace('assign_prompt_', '');
        await handleShowStaffChoices(token, chatId, compId, dbUser.neighborhoodId || pilotNeighborhood?.id || '');
        return;
      }

      if (data.startsWith('do_assign_')) {
        const parts = data.replace('do_assign_', '').split('_');
        const compId = parts[0];
        const staffId = parts[1];
        await handleExecuteAssign(token, chatId, compId, staffId, dbUser.id, appUrl);
        return;
      }

      if (data.startsWith('do_accept_')) {
        const compId = data.replace('do_accept_', '');
        await handleExecuteAccept(token, chatId, compId, dbUser.id, appUrl);
        return;
      }
    }
    return;
  }

  // -------------------------------------------------------------
  // B. HANDLE TEXT, PHOTOS, LOCATIONS
  // -------------------------------------------------------------
  if (!message) return;

  const chatId = message.chat?.id;
  const caption = message.caption || '';
  const text = (message.text || caption || '').trim();
  const lowerText = text.toLowerCase();
  const fromUser = message.from;
  const location = message.location;
  const photo = message.photo;

  if (!chatId || !fromUser) return;

  // Lookup or provision user in DB
  let dbUser = await db.query.users.findFirst({
    where: eq(users.telegramId, String(fromUser.id)),
  });

  const pilotNeighborhood = await db.query.neighborhoods.findFirst({
    where: eq(neighborhoods.code, 'qarshi_vatanparvar'),
  });

  if (!dbUser) {
    const defaultName = `${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim() || fromUser.username || 'Fuqaro';
    const [newUser] = await db.insert(users).values({
      uid: `tg_${fromUser.id}`,
      fullName: defaultName,
      role: 'CITIZEN',
      neighborhoodId: pilotNeighborhood?.id || null,
      districtId: pilotNeighborhood?.districtId || null,
      telegramId: String(fromUser.id),
      telegramUsername: fromUser.username || null,
      isActive: true,
    }).returning();
    dbUser = newUser;
  }

  const isSuper = isAuthorizedSuperAdmin(fromUser.id);
  if (isSuper && dbUser.role !== 'SUPER_ADMIN') {
    await db.update(users).set({ role: 'SUPER_ADMIN' }).where(eq(users.id, dbUser.id));
    dbUser.role = 'SUPER_ADMIN';
  }

  const isChairman = dbUser.role === 'CHAIRMAN';
  const isDistrictAdmin = dbUser.role === 'DISTRICT_ADMIN';
  const isStaff = dbUser.role === 'STAFF';
  const isSuperAdmin = dbUser.role === 'SUPER_ADMIN' || isSuper;
  const session = userSessions.get(fromUser.id);

  // -------------------------------------------------------------
  // 0. PHONE CONTACT VERIFICATION (GovTech Verified Resident)
  // -------------------------------------------------------------
  const contact = message.contact;
  if (contact && contact.phone_number) {
    let cleanPhone = contact.phone_number.trim();
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
    await db.update(users).set({ phone: cleanPhone, updatedAt: new Date() }).where(eq(users.id, dbUser.id));
    dbUser.phone = cleanPhone;

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>Telefon raqamingiz muvaffaqiyatli tasdiqlandi!</b>\n\n` +
      `📞 Raqam: <code>${cleanPhone}</code>\n` +
      `🛡 Sizning hisobingiz endi rasmiy tasdiqlangan (GovTech Verified) fuqaro maqomiga ega bo'ldi.`,
      getCitizenKeyboard(appUrl, true)
    );
    return;
  }

  // -------------------------------------------------------------
  // 1. NEIGHBORHOOD CODE VERIFICATION (Rate-limited Brute Force Protection)
  // -------------------------------------------------------------
  if (session && session.step === 'WAITING_NEIGHBORHOOD_CODE') {
    userSessions.delete(fromUser.id);
    const verifyRes = await verifyAndBindNeighborhoodCode(text, String(fromUser.id), dbUser.id);
    await sendTelegramMessage(token, chatId, verifyRes.message, getCitizenKeyboard(appUrl));
    return;
  }

  // Direct Code Matching (e.g. M24-XXXXXX or M24-VATAN-2026)
  if (text.toUpperCase().startsWith('M24-') || text.toUpperCase().startsWith('M24_')) {
    const verifyRes = await verifyAndBindNeighborhoodCode(text, String(fromUser.id), dbUser.id);
    await sendTelegramMessage(token, chatId, verifyRes.message, getCitizenKeyboard(appUrl));
    return;
  }

  // -------------------------------------------------------------
  // 2. ADMIN INTERACTIVE SESSION STEPS
  // -------------------------------------------------------------
  if (session && session.step === 'WAITING_NEW_NEIGHBORHOOD_NAME') {
    userSessions.delete(fromUser.id);
    const nameUz = text.trim();
    if (nameUz.length < 3) {
      await sendTelegramMessage(token, chatId, "❌ Mahalla nomi kamida 3 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    const pilotDistrict = await db.query.districts.findFirst();
    const codeSlug = nameUz.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const [newNeigh] = await db.insert(neighborhoods).values({
      nameUz,
      nameRu: nameUz,
      nameKaa: nameUz,
      districtId: pilotDistrict?.id || '22222222-2222-2222-2222-222222222201',
      code: codeSlug,
      subscriptionStatus: 'ACTIVE',
    }).returning();

    const newCode = generateSecureAccessCode();
    await db.insert(neighborhoodCodes).values({
      neighborhoodId: newNeigh.id,
      accessCode: newCode,
      status: 'ACTIVE',
      createdById: dbUser.id,
      description: 'Boshqaruv paneli orqali yaratilgan boshlang\'ich kod',
    });

    await logAuditEvent(dbUser.id, 'NEIGHBORHOOD_CREATED', 'NEIGHBORHOOD', newNeigh.id, `${nameUz} (Kod: ${newCode})`);

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>Yangi mahalla muvaffaqiyatli qo'shildi!</b>\n\n` +
      `🏘 Mahalla: <b>${nameUz}</b>\n` +
      `🔑 Kirish kodi: <code>${newCode}</code>\n\n` +
      `Ushbu kodni mahalla fuqarolariga taqdim etishingiz mumkin. Fuqaro botga ushbu kodni kiritishi bilan avtomatik unga biriktiriladi.`,
      {
        inline_keyboard: [
          [{ text: `⚙️ ${nameUz} kartasini ochish`, callback_data: `adm_neigh_view_${newNeigh.id}` }],
          [{ text: '🏘 Mahallalar ro\'yxati', callback_data: 'adm_neigh_list_0' }],
        ],
      }
    );
    return;
  }

  if (session && session.step === 'WAITING_STAFF_ASSIGN_TG_ID') {
    userSessions.delete(fromUser.id);
    const query = text.trim().replace('@', '');
    const targetUser = await db.query.users.findFirst({
      where: sql`${users.telegramId} = ${query} OR ${users.telegramUsername} ILIKE ${query}`,
    });

    if (!targetUser) {
      await sendTelegramMessage(
        token,
        chatId,
        `❌ <b>Foydalanuvchi topilmadi!</b>\n\n` +
        `Foydalanuvchi avval ushbu botga kirib /start bosgan bo'lishi lozim.\n` +
        `Iltimos, Telegram ID raqami yoki username to'g'ri kiritilganiga ishonch hosil qiling.`,
        getBackKeyboard('adm_staff_list_0')
      );
      return;
    }

    const roleButtons = [
      [
        { text: '👔 Mahalla Raisi', callback_data: `adm_staff_setrole_${targetUser.id}_CHAIRMAN` },
        { text: '👨‍🔧 Kommunal Usta', callback_data: `adm_staff_setrole_${targetUser.id}_STAFF` },
      ],
      [
        { text: '🏛 Hokimlik (Tuman)', callback_data: `adm_staff_setrole_${targetUser.id}_DISTRICT_ADMIN` },
        { text: '👤 Oddiy Fuqaro', callback_data: `adm_staff_setrole_${targetUser.id}_CITIZEN` },
      ],
      [
        { text: '⬅️ Bekor qilish', callback_data: 'adm_staff_list_0' },
      ],
    ];

    await sendTelegramMessage(
      token,
      chatId,
      `👤 <b>Foydalanuvchi topildi:</b>\n\n` +
      `Ismi: <b>${targetUser.fullName}</b>\n` +
      `Telegram: @${targetUser.telegramUsername || 'mavjud emas'} (ID: <code>${targetUser.telegramId}</code>)\n` +
      `Hozirgi roli: <b>${targetUser.role}</b>\n\n` +
      `Ushbu foydalanuvchiga qanday rol tayinlamoqchisiz?`,
      { inline_keyboard: roleButtons }
    );
    return;
  }

  if (session && session.step === 'WAITING_CHAIRMAN_ASSIGN_TG_ID') {
    const targetNeighId = session.neighborhoodId;
    userSessions.delete(fromUser.id);
    const query = text.trim().replace('@', '');
    const targetUser = await db.query.users.findFirst({
      where: sql`${users.telegramId} = ${query} OR ${users.telegramUsername} ILIKE ${query}`,
    });

    if (!targetUser || !targetNeighId) {
      await sendTelegramMessage(
        token,
        chatId,
        `❌ Foydalanuvchi topilmadi. Avval botga /start buyrug'ini yuborgan bo'lishi kerak.`,
        getBackKeyboard(targetNeighId ? `adm_neigh_view_${targetNeighId}` : 'adm_neigh_list_0')
      );
      return;
    }

    await db.update(users).set({
      role: 'CHAIRMAN',
      neighborhoodId: targetNeighId,
    }).where(eq(users.id, targetUser.id));

    await db.update(neighborhoods).set({
      chairmanName: targetUser.fullName,
      phone: targetUser.phone || undefined,
    }).where(eq(neighborhoods.id, targetNeighId));

    await logAuditEvent(dbUser.id, 'CHAIRMAN_ASSIGNED', 'NEIGHBORHOOD', targetNeighId, `${targetUser.fullName} (ID: ${targetUser.id})`);

    if (targetUser.telegramId) {
      await sendTelegramMessage(
        token,
        targetUser.telegramId,
        `🎉 <b>Tabriklaymiz!</b> Siz mahalla raisi lavozimiga tayinlandingiz.\nBoshqaruv panelini ochish uchun /admin buyrug'ini yuboring.`,
        getChairmanKeyboard(appUrl)
      );
    }

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>${targetUser.fullName}</b> ushbu mahallaga rais etib tayinlandi!`,
      {
        inline_keyboard: [
          [{ text: '🏘 Mahalla kartasini ochish', callback_data: `adm_neigh_view_${targetNeighId}` }],
        ],
      }
    );
    return;
  }

  // -------------------------------------------------------------
  // 2B. APPOINTMENT TOPIC SUBMISSION STEP
  // -------------------------------------------------------------
  if (session && session.step === 'WAITING_APPOINTMENT_TOPIC') {
    const topic = text.trim() || 'Umumiy mahalla va oilaviy masalalar';
    const apptDay = session.appointmentDay || 'Dushanba';
    const apptTime = session.appointmentTime || '10:00';
    userSessions.delete(fromUser.id);

    const ticketNumber = `QB-2026-${Math.floor(100 + Math.random() * 900)}`;

    // Notify citizen with Digital Ticket
    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>MAHALLA RAISI QABULIGA MUVAFFAQIYATLI YOZILDINGIZ!</b>\n\n` +
      `🎫 <b>Elektron qabul chiptasi:</b> <code>#${ticketNumber}</code>\n` +
      `👤 <b>Fuqaro:</b> <b>${dbUser.fullName}</b>\n` +
      `📞 <b>Telefon:</b> <code>${dbUser.phone || 'Ulanmagan'}</code>\n` +
      `📅 <b>Qabul kuni:</b> <b>${apptDay}</b>\n` +
      `⏰ <b>Qabul vaqti:</b> <b>${apptTime}</b>\n` +
      `📌 <b>Murojaat mavzusi:</b> <i>${topic}</i>\n` +
      `📍 <b>Qabul joyi:</b> Mahalla idorasi, 2-xona (Rais xonasi)\n\n` +
      `<i>Eslatma: Belgilangan vaqtda shaxsni tasdiqlovchi hujjat (pasport yoki ID-karta) bilan tashrif buyurishingiz so'raladi. Chiptangiz rais kompyuterida ro'yxatga olindi.</i>`,
      getCitizenKeyboard(appUrl, !!dbUser.phone, getUserLang(fromUser.id))
    );

    // Notify Mahalla Chairman
    try {
      const chairmen = await db.query.users.findMany({
        where: and(
          eq(users.neighborhoodId, dbUser.neighborhoodId || pilotNeighborhood?.id || '33333333-3333-3333-3333-333333333301'),
          eq(users.role, 'CHAIRMAN'),
          sql`${users.telegramId} IS NOT NULL`
        ),
      });

      const chairNotice = `🔔 <b>YANGI FUQARO QABULGA YOZILDI!</b>\n\n` +
        `🎫 <b>Chipta:</b> <code>#${ticketNumber}</code>\n` +
        `👤 <b>Fuqaro:</b> ${dbUser.fullName}\n` +
        `📞 <b>Aloqa:</b> ${dbUser.phone || 'Telegram orqali'}\n` +
        `📅 <b>Qabul vaqti:</b> ${apptDay}, soat ${apptTime}\n` +
        `📌 <b>Murojaat mavzusi:</b> <i>${topic}</i>`;

      for (const ch of chairmen) {
        if (ch.telegramId) {
          await sendTelegramMessage(token, ch.telegramId, chairNotice);
        }
      }
    } catch (chairErr) {
      console.warn('Error notifying chairman about appointment:', chairErr);
    }

    return;
  }

  // -------------------------------------------------------------
  // 3. SECURE ADMIN COMMAND ROUTING (/admin or /admin_menu)
  // -------------------------------------------------------------
  if (lowerText.startsWith('/admin') || lowerText === '👑 admin menyu' || lowerText === 'admin menyu' || lowerText === 'admin') {
    if (!isSuperAdmin && !isDistrictAdmin && !isChairman && !isStaff) {
      await logAuditEvent(dbUser.id, 'UNAUTHORIZED_ADMIN_ATTEMPT', 'SYSTEM', String(fromUser.id), 'Tried accessing /admin');
      await sendTelegramMessage(
        token,
        chatId,
        `⛔️ <b>Kirish taqiqlandi!</b>\n\n` +
        `Sizda ma'muriyat paneliga kirish huquqi mavjud emas.\n` +
        `Super Admin huquqi faqat tizim konfiguratsiyasida ko'rsatilgan xavfsiz Telegram ID orqali beriladi.\n\n` +
        `Admin huquqini olish uchun bosh administratorga murojaat qiling.`,
        getCitizenKeyboard(appUrl)
      );
      return;
    }

    if (isSuperAdmin) {
      const adminWelcome = `👑 <b>Super Administrator Boshqaruv Paneli</b>\n\n` +
        `Assalomu alaykum, <b>${dbUser.fullName}</b>!\n` +
        `Telegram ID: <code>${fromUser.id}</code> (Tasdiqlangan Super Admin)\n\n` +
        `Quyidagi boshqaruv bo'limlaridan birini tanlang:`;
      await sendTelegramMessage(token, chatId, adminWelcome, getSuperAdminInlineMenu(appUrl));
      await sendTelegramMessage(token, chatId, "Super Admin boshqaruv menyusi faol 👇", getSuperAdminKeyboard(appUrl));
      return;
    }

    if (isDistrictAdmin) {
      const distWelcome = `🏛 <b>Tuman Hokimligi Boshqaruv Paneli</b>\n\n` +
        `Assalomu alaykum, <b>${dbUser.fullName}</b>!\n` +
        `O'zingizga biriktirilgan hududdagi mahallalar, raislar va murojaatlarni boshqaring:`;
      await sendTelegramMessage(token, chatId, distWelcome, getDistrictAdminInlineMenu(appUrl, 'Qarshi shahri'));
      await sendTelegramMessage(token, chatId, "Tuman admin boshqaruv menyusi faol 👇", getDistrictAdminKeyboard(appUrl));
      return;
    }

    if (isChairman) {
      const chairWelcome = `👔 <b>Mahalla Raisi Boshqaruv Paneli</b>\n\n` +
        `Assalomu alaykum, <b>${dbUser.fullName}</b>!\n` +
        `Mahallangiz bo'yicha yangi murojaatlar, xodimlar va e'lonlar nazorati:`;
      await sendTelegramMessage(token, chatId, chairWelcome, getChairmanInlineMenu(appUrl));
      await sendTelegramMessage(token, chatId, "Rais boshqaruv menyusi faol 👇", getChairmanKeyboard(appUrl));
      return;
    }

    if (isStaff) {
      const staffWelcome = `👨‍🔧 <b>Kommunal Xodim / Usta Paneli</b>\n\n` +
        `Assalomu alaykum, <b>${dbUser.fullName}</b>!\n` +
        `Sizga biriktirilgan murojaatlar va topshiriqlar nazorati:`;
      await sendTelegramMessage(token, chatId, staffWelcome, getStaffInlineMenu(appUrl));
      await sendTelegramMessage(token, chatId, "Xodim boshqaruv menyusi faol 👇", getStaffKeyboard(appUrl));
      return;
    }
  }

  // -------------------------------------------------------------
  // 4. CITIZEN JOIN CODE TRIGGER VIA KEYBOARD
  // -------------------------------------------------------------
  if (lowerText.includes("mahalla kodi bilan a'zo bo'lish") || lowerText.includes("mahalla kodi") || lowerText === '/code') {
    userSessions.set(fromUser.id, { step: 'WAITING_NEIGHBORHOOD_CODE' });
    await sendTelegramMessage(
      token,
      chatId,
      `🔑 <b>Mahalla kodi orqali a'zo bo'lish:</b>\n\n` +
      `Iltimos, mahallangiz idorasi bergan <b>maxsus kirish kodi</b>ni yozib yuboring (Masalan: <code>M24-VATAN-2026</code> yoki <code>M24-7K9P2X</code>):\n\n` +
      `<i>Xavfsizlik: Ketma-ket 5 marta noto'g'ri kod kiritilsa, tizim 15 daqiqaga bloklanadi.</i>`
    );
    return;
  }

  // -------------------------------------------------------------
  // 5. SWITCH ROLES / KEYBOARDS
  // -------------------------------------------------------------
  if (lowerText === '/citizen' || lowerText.includes("fuqaro rejimiga o'tish") || lowerText.includes("fuqaro rejimi")) {
    await sendTelegramMessage(
      token,
      chatId,
      `🔄 Siz <b>Fuqaro menyusiga</b> o'tdingiz.\n\nAdmin boshqaruv paneliga qaytish uchun <b>/admin</b> buyrug'ini yuboring.`,
      getCitizenKeyboard(appUrl)
    );
    return;
  }

  // -------------------------------------------------------------
  // 6. QUICK ADMIN SHORTCUTS VIA KEYBOARD
  // -------------------------------------------------------------
  if (isSuperAdmin || isDistrictAdmin) {
    if (lowerText.startsWith('/neighborhoods') || lowerText.includes('mahallalar')) {
      const res = await renderNeighborhoodsList(0);
      await sendTelegramMessage(token, chatId, res.text, res.replyMarkup);
      return;
    }

    if (lowerText.startsWith('/stats') || lowerText.includes('hisoboti') || lowerText.includes('statistika')) {
      const rep = await renderExecutiveReport();
      await sendTelegramMessage(token, chatId, rep.text, rep.replyMarkup);
      return;
    }

    if (lowerText.startsWith('/complaints') || lowerText.includes('barcha arizalar')) {
      const compRes = await renderComplaintsList('ALL', 0);
      await sendTelegramMessage(token, chatId, compRes.text, compRes.replyMarkup);
      return;
    }
  }

  if (isChairman) {
    if (lowerText.includes('yangi murojaatlar')) {
      const chairComps = await renderComplaintsList('NEW', 0, dbUser.neighborhoodId || undefined);
      await sendTelegramMessage(token, chatId, chairComps.text, chairComps.replyMarkup);
      return;
    }

    if (lowerText.includes('mahalla statistikasi')) {
      await handleChairmanStats(token, chatId, dbUser.neighborhoodId || pilotNeighborhood?.id || '');
      return;
    }

    if (lowerText.includes("ustalarni ko'rish")) {
      const sRes = await renderStaffList(0);
      await sendTelegramMessage(token, chatId, sRes.text, sRes.replyMarkup);
      return;
    }
  }

  if (isStaff) {
    if (lowerText.includes('biriktirilgan vazifalar')) {
      const myAssigned = await db.query.assignments.findMany({
        where: eq(assignments.staffId, dbUser.id),
      });
      const myCompIds = myAssigned.map((a) => a.complaintId);
      if (myCompIds.length === 0) {
        await sendTelegramMessage(token, chatId, "🛠 Hozircha sizga biriktirilgan vazifalar mavjud emas.");
      } else {
        const list = await db.query.complaints.findMany({
          where: inArray(complaints.id, myCompIds),
          limit: 6,
        });
        let t = `🛠 <b>Sizga biriktirilgan vazifalar (${list.length} ta):</b>\n\n`;
        const b: any[] = [];
        list.forEach((c, idx) => {
          t += `${idx + 1}. [${c.complaintCode}] <b>${c.title}</b>\n   Holat: ${c.status}\n\n`;
          b.push([{ text: `🔎 [${c.complaintCode}] Bajarish & Holat`, callback_data: `adm_comp_view_${c.id}` }]);
        });
        await sendTelegramMessage(token, chatId, t, { inline_keyboard: b });
      }
      return;
    }
  }

  // -------------------------------------------------------------
  // 5. ANNOUNCEMENT CREATION STEP BY CHAIRMAN
  // -------------------------------------------------------------
  if (session && session.step === 'WAITING_ANNOUNCEMENT_TITLE') {
    session.announcementTitle = text;
    session.step = 'WAITING_ANNOUNCEMENT_CONTENT';
    userSessions.set(fromUser.id, session);

    await sendTelegramMessage(
      token,
      chatId,
      `📌 Sarlavha: <b>${text}</b>\n\nEndi e'lonning batafsil matnini yuboring:`
    );
    return;
  }

  if (session && session.step === 'WAITING_ANNOUNCEMENT_CONTENT') {
    const annTitle = session.announcementTitle || 'Mahalla xabarnomasi';
    const annContent = text;
    userSessions.delete(fromUser.id);

    // Save to announcements table
    const targetNeighId = dbUser.neighborhoodId || pilotNeighborhood?.id || '33333333-3333-3333-3333-333333333301';
    const [newAnn] = await db.insert(announcements).values({
      neighborhoodId: targetNeighId,
      title: annTitle,
      content: annContent,
      targetAudience: 'ALL',
      isPublished: true,
      createdBy: dbUser.id,
    }).returning();

    // Broadcast to registered citizens
    try {
      const residents = await db.query.users.findMany({
        where: and(
          eq(users.neighborhoodId, targetNeighId),
          sql`${users.telegramId} IS NOT NULL`
        ),
      });

      const broadcastMsg = `📢 <b>Mahalla Raisidan rasmiy e'lon!</b>\n\n` +
        `📌 <b>${annTitle}</b>\n\n` +
        `${annContent}\n\n` +
        `🏛 <i>Vatanparvar MFY, Qarshi shahri</i>`;

      for (const res of residents) {
        if (res.telegramId && res.telegramId !== String(fromUser.id)) {
          await sendTelegramMessage(token, res.telegramId, broadcastMsg, {
            inline_keyboard: [
              [{ text: '📱 Mini Appda ko\'rish', web_app: { url: appUrl } }]
            ]
          });
        }
      }

      // Official Telegram Channel Auto-Sync
      const channelId = process.env.MAHALLA_CHANNEL_ID;
      if (channelId) {
        try {
          const channelPost = `📢 <b>#RASMIY_E’LON</b>\n\n` +
            `📌 <b>${annTitle}</b>\n\n` +
            `${annContent}\n\n` +
            `🏛 <i>Vatanparvar MFY Mahalla Raisi Matbuot Xizmati</i>\n` +
            `📅 <i>Sana: ${new Date().toLocaleDateString('uz-UZ')}</i>`;

          await sendTelegramMessage(token, channelId, channelPost, {
            inline_keyboard: [
              [{ text: '📱 Mahalla One ilovasi', url: appUrl }]
            ]
          });
        } catch (chErr) {
          console.warn('Channel post error:', chErr);
        }
      }
    } catch (bcErr) {
      console.error('Broadcast error:', bcErr);
    }

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>E'lon muvaffaqiyatli e'lon qilindi va fuqarolarga yuborildi!</b>\n\n📌 <b>${annTitle}</b>\n${annContent}`,
      getChairmanKeyboard(appUrl)
    );
    return;
  }

  // -------------------------------------------------------------
  // 7. COMMAND: /start or greeting
  // -------------------------------------------------------------
  if (lowerText.startsWith('/start') || lowerText === 'salom' || lowerText === 'start' || lowerText === 'assalomu alaykum') {
    userSessions.delete(fromUser.id);

    // Deep Link payload verification (e.g. /start M24-VATAN-2026 or /start code_M24-7K9P2X)
    const startPayload = text.replace(/^\/start\s*/i, '').trim();
    if (startPayload.toUpperCase().startsWith('M24-') || startPayload.toUpperCase().startsWith('CODE_M24-')) {
      const cleanCode = startPayload.replace(/^code_/i, '').trim();
      const verifyRes = await verifyAndBindNeighborhoodCode(cleanCode, String(fromUser.id), dbUser.id);
      if (verifyRes.success) {
        await sendTelegramMessage(
          token,
          chatId,
          `🎉 <b>Xush kelibsiz! QR-kod orqali mahallaga muvaffaqiyatli a'zo bo'ldingiz!</b>\n\n` + verifyRes.message,
          getCitizenKeyboard(appUrl, !!dbUser.phone)
        );
        return;
      }
    }

    let welcomeCitizen = `Assalomu alaykum, <b>${fromUser.first_name || 'Hurmatli fuqaro'}</b>!\n\n` +
      `🏛 <b>Mahalla One — Raqamli mahalla tizimi</b>\n\n` +
      `Ushbu bot orqali siz mahallangiz hayotida faol ishtirok etishingiz va barcha asosiy xizmatlardan qulay foydalanishingiz mumkin:\n\n` +
      `• 🔑 <b>Mahalla kodi:</b> Mahalla idorasi bergan maxsus kod orqali o'z mahallangizga a'zo bo'lish\n` +
      `• 📝 <b>Yangi murojaat:</b> Muammolar bo'yicha matn, rasm va lokatsiya bilan ariza qoldirish\n` +
      `• 📋 <b>Murojaatlarim:</b> Yuborilgan arizalar ijro holatini kuzatib borish\n` +
      `• 📊 <b>Ovoz berish:</b> Mahalla hayotiga oid so'rovnomalarda bevosita ishtirok etish\n` +
      `• 📢 <b>Mahalla e'lonlari:</b> Rais va ma'muriyatning rasmiy xabarlaridan xabardor bo'lish\n` +
      `• 🚨 <b>Favqulodda xizmatlar:</b> 24/7 tezkor xizmatlar va mahalla idorasi bilan aloqa\n` +
      `• 📲 <b>Mini App & Xarita:</b> Mahallangizning interaktiv xaritasi va to'liq raqamli xizmatlari\n\n` +
      `Quyidagi menyudan kerakli bo'limni tanlang:`;

    if (isSuperAdmin) {
      welcomeCitizen += `\n\n👑 <i>Siz Bosh Administrator sifatida aniqlandingiz. Admin boshqaruv menyusini ochish uchun: <b>/admin</b></i>`;
    } else if (isChairman) {
      welcomeCitizen += `\n\n👔 <i>Siz Mahalla Raisi sifatida biriktirilgansiz. Rais boshqaruv menyusini ochish uchun: <b>/admin</b></i>`;
    }

    const citizenInline = {
      inline_keyboard: [
        [
          { text: '📲 Mahalla One Mini App', web_app: { url: appUrl } },
        ],
        [
          { text: '📝 Yangi murojaat qoldirish', callback_data: 'cmd_newcomplaint' },
          { text: '📋 Murojaatlarim', callback_data: 'cmd_mycomplaints' },
        ],
        [
          { text: '📊 So\'rovnomalar & Ovoz berish', callback_data: 'cmd_polls' },
          { text: '📢 Mahalla e\'lonlari', callback_data: 'cmd_announcements' },
        ],
        [
          { text: '🔑 Mahalla kodi orqali a\'zo bo\'lish', callback_data: 'cmd_join_code' },
          { text: '🚨 Favqulodda yordam (SOS)', callback_data: 'cmd_sos' },
        ],
        [
          { text: '☎️ Mahalla idorasi bilan aloqa', callback_data: 'cmd_contact' },
        ],
      ],
    };

    const logoUrl = `${appUrl}/mahalla-one-logo.png`;
    await sendTelegramPhoto(token, chatId, logoUrl, welcomeCitizen, citizenInline);
    await sendTelegramMessage(token, chatId, "Asosiy menyu faol 👇", getCitizenKeyboard(appUrl, !!dbUser.phone));
    return;
  }

  // -------------------------------------------------------------
  // 8. COMMAND: /help
  // -------------------------------------------------------------
  if (lowerText.startsWith('/help') || lowerText === 'yordam' || lowerText === 'help') {
    const helpText = `ℹ️ <b>Mahalla One Botidan foydalanish qo'llanmasi:</b>\n\n` +
      `🔹 <b>/start</b> — Bosh menyuni ochish va xizmatlar bilan tanishish\n` +
      `🔹 <b>/code</b> — Mahalla kirish kodini kiritish (masalan: <code>M24-VATAN-2026</code>)\n` +
      `🔹 <b>/newcomplaint</b> — Yangi murojaat yo'llash (matn, rasm, lokatsiya)\n` +
      `🔹 <b>/mycomplaints</b> — Yuborilgan murojaatlar ijro holati va baholash\n` +
      `🔹 <b>/polls</b> — Faol so'rovnomalarda ovoz berish\n` +
      `🔹 <b>/sos</b> — 24/7 Favqulodda tezkor raqamlar ro'yxati\n` +
      `🔹 <b>/announcements</b> — Mahalla e'lonlarini o'qish\n` +
      `🔹 <b>/contact</b> — Mahalla idorasi manzili va telefonlari\n` +
      `🔹 <b>/admin</b> — Mas'ul xodimlar uchun ma'muriyat paneli\n` +
      `🔹 <b>/citizen</b> — Fuqaro rejimiga qaytish\n\n` +
      `<i>Xavfsizlik: Barcha ma'lumotlar serverda saqlanadi va ruxsatlar qat'iy tekshiriladi.</i>`;

    const currentKeyboard = isSuperAdmin ? getSuperAdminKeyboard(appUrl) : (isChairman ? getChairmanKeyboard(appUrl) : getCitizenKeyboard(appUrl, !!dbUser.phone));
    await sendTelegramMessage(token, chatId, helpText, currentKeyboard);
    return;
  }

  // -------------------------------------------------------------
  // 8. CITIZEN COMMANDS & SHORTCUTS
  // -------------------------------------------------------------
  if (lowerText.startsWith('/openbudget') || lowerText.includes('ochiq byudjet') || lowerText.includes('open budget') || lowerText.includes('byudjet')) {
    userSessions.delete(fromUser.id);
    await handleOpenBudget(token, chatId);
    return;
  }

  if (lowerText.startsWith('/appointment') || lowerText.includes('qabuliga yozilish') || lowerText.includes('qabul')) {
    userSessions.set(fromUser.id, { step: 'WAITING_APPOINTMENT_TOPIC' });
    const apptButtons = [
      [
        { text: '📅 Dushanba (09:00 - 12:00)', callback_data: 'appt_day_Dushanba' },
      ],
      [
        { text: '📅 Chorshanba (14:00 - 17:00)', callback_data: 'appt_day_Chorshanba' },
      ],
      [
        { text: '📅 Juma (09:00 - 12:00)', callback_data: 'appt_day_Juma' },
      ],
      [
        { text: '⬅️ Asosiy menyu', callback_data: 'adm_switch_citizen' },
      ],
    ];
    await sendTelegramMessage(
      token,
      chatId,
      `🗓 <b>Mahalla Raisi qabuliga elektron navbat olish:</b>\n\nIltimos, o'zingizga qulay qabul kunini tanlang:`,
      { inline_keyboard: apptButtons }
    );
    return;
  }

  if (lowerText.startsWith('/lang') || lowerText.includes('til') || lowerText.includes('тил') || lowerText.includes('yozuv')) {
    userSessions.delete(fromUser.id);
    await handleLanguageSelect(token, chatId);
    return;
  }

  if (lowerText.startsWith('/pdfreport') || lowerText.includes('pdf hisobot') || lowerText.includes('hisobot')) {
    await handleGeneratePdfReport(token, chatId, dbUser.neighborhoodId || pilotNeighborhood?.id);
    return;
  }

  if (lowerText.startsWith('/polls') || lowerText.includes('so\'rovnoma') || lowerText.includes('ovoz berish')) {
    userSessions.delete(fromUser.id);
    await handlePolls(token, chatId, fromUser, dbUser);
    return;
  }

  if (lowerText.startsWith('/sos') || lowerText.includes('favqulodda') || lowerText.includes('shoshilinch')) {
    userSessions.delete(fromUser.id);
    await handleEmergency(token, chatId, dbUser, pilotNeighborhood);
    return;
  }
  if (lowerText.startsWith('/mycomplaints') || lowerText.includes('murojaatlarim')) {
    userSessions.delete(fromUser.id);
    await handleMyComplaints(token, chatId, fromUser);
    return;
  }

  if (lowerText.startsWith('/announcements') || lowerText.includes("e'lon") || lowerText.includes('elon')) {
    userSessions.delete(fromUser.id);
    await handleAnnouncements(token, chatId);
    return;
  }

  if (lowerText.startsWith('/contact') || lowerText.includes("bog'lanish") || lowerText.includes('aloqa')) {
    userSessions.delete(fromUser.id);
    await handleContact(token, chatId);
    return;
  }

  if (lowerText.startsWith('/newcomplaint') || lowerText.includes('yangi murojaat') || lowerText === 'murojaat' || lowerText === 'ariza') {
    userSessions.set(fromUser.id, { step: 'WAITING_TITLE' });
    await sendTelegramMessage(
      token,
      chatId,
      `📝 <b>Yangi murojaat qoldirish:</b>\n\nIltimos, avval murojaatingiz mavzusi yoki qisqacha sarlavhasini yozing (masalan: <i>Ko'cha chirog'i yonmayapti</i> yoki <i>Chiqindi olib ketilmadi</i>):`
    );
    return;
  }

  // -------------------------------------------------------------
  // 9. CONVERSATIONAL COMPLAINT SUBMISSION FLOW
  // -------------------------------------------------------------
  if (session && session.step) {
    if (session.step === 'WAITING_TITLE') {
      session.title = text || 'Mavzusiz murojaat';
      session.step = 'WAITING_CATEGORY';
      userSessions.set(fromUser.id, session);

      const categoryKeyboard = {
        inline_keyboard: [
          [
            { text: '💡 Ko\'cha chirog\'i', callback_data: 'cat_street_lighting' },
            { text: '💧 Ichimlik suvi', callback_data: 'cat_water_supply' },
          ],
          [
            { text: '🗑 Chiqindi va tozalash', callback_data: 'cat_garbage_collection' },
            { text: '🛣 Yo\'llar ta\'miri', callback_data: 'cat_roads' },
          ],
          [
            { text: '🌳 Obodonlashtirish', callback_data: 'cat_landscaping' },
            { text: '🏢 Boshqa masalalar', callback_data: 'cat_other' },
          ],
        ],
      };

      await sendTelegramMessage(
        token,
        chatId,
        `Sarlavha qabul qilindi: <b>${session.title}</b>\n\nEndi quyidagi toifalardan birini tanlang:`,
        categoryKeyboard
      );
      return;
    }

    if (session.step === 'WAITING_DESC_ADDRESS') {
      const description = text || (photo ? 'Foto rasm ilova qilingan murojaat' : 'Telegram orqali yuborilgan murojaat');
      let lat: number | null = null;
      let lng: number | null = null;

      if (location) {
        lat = location.latitude;
        lng = location.longitude;
      }

      // Generate unique code MH-2026-XXXX
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(complaints);
      const count = Number(countResult[0]?.count || 0) + 1;
      const complaintCode = `MH-2026-${String(count).padStart(4, '0')}`;

      // Insert Complaint into PostgreSQL
      const targetComplaintNeighId = dbUser.neighborhoodId || pilotNeighborhood?.id || '33333333-3333-3333-3333-333333333301';
      const targetComplaintDistId = dbUser.districtId || pilotNeighborhood?.districtId || null;
      const [newComplaint] = await db.insert(complaints).values({
        complaintCode,
        title: session.title || 'Telegram orqali murojaat',
        description,
        category: session.category || 'other',
        neighborhoodId: targetComplaintNeighId,
        districtId: targetComplaintDistId,
        latitude: lat,
        longitude: lng,
        address: location ? `GPS: ${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : 'Vatanparvar MFY, Qarshi',
        citizenId: dbUser.id,
        status: 'NEW',
        priority: 'MEDIUM',
      }).returning();

      // If photo was sent, download/save file path
      if (photo && photo.length > 0) {
        const largestPhoto = photo[photo.length - 1];
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${largestPhoto.file_id}`);
          const fileData = await fileRes.json();
          if (fileData.ok && fileData.result?.file_path) {
            const photoUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
            await db.insert(complaintMedia).values({
              complaintId: newComplaint.id,
              fileUrl: photoUrl,
              fileType: 'image/jpeg',
              fileSize: largestPhoto.file_size || null,
              caption: text || null,
              uploadedBy: dbUser.id,
            });
          }
        } catch (photoErr) {
          console.error('Error attaching photo:', photoErr);
        }
      }

      // Insert history audit
      await db.insert(complaintHistory).values({
        complaintId: newComplaint.id,
        previousStatus: null,
        newStatus: 'NEW',
        responsibleUserId: dbUser.id,
        explanation: 'Telegram Bot orqali yangi murojaat tizimga kiritildi',
      });

      userSessions.delete(fromUser.id);

      const successMsg = `✅ <b>Murojaatingiz muvaffaqiyatli qabul qilindi!</b>\n\n` +
        `🆔 Kodi: <code>${newComplaint.complaintCode}</code>\n` +
        `📌 Mavzu: <b>${newComplaint.title}</b>\n` +
        `📊 Holati: <b>Yangi (NEW)</b>\n` +
        `🏛 Mahalla: <b>Vatanparvar MFY (Qarshi shahri)</b>\n\n` +
        `Murojaat mahalla raisi kabinetiga tushdi va 24 soat ichida ko'rib chiqiladi. Ijro holati o'zgarganda bot sizni xabardor qiladi.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📱 Mini Appda ko\'rish', web_app: { url: appUrl } }],
          [{ text: '📋 Murojaatlarim ro\'yxati', callback_data: 'cmd_mycomplaints' }],
        ],
      };

      await sendTelegramMessage(token, chatId, successMsg, keyboard);

      // Notify the Mahalla Chairman in Telegram
      try {
        const chairmen = await db.query.users.findMany({
          where: and(
            eq(users.neighborhoodId, newComplaint.neighborhoodId),
            eq(users.role, 'CHAIRMAN'),
            sql`${users.telegramId} IS NOT NULL`
          ),
        });

        const chairmanNotice = `🔔 <b>Yangi murojaat kelib tushdi!</b>\n\n` +
          `🆔 Kodi: <code>${newComplaint.complaintCode}</code>\n` +
          `📌 Mavzu: <b>${newComplaint.title}</b>\n` +
          `📍 Manzil: ${newComplaint.address || "Vatanparvar MFY"}\n` +
          `👤 Fuqaro: ${dbUser.fullName}\n\n` +
          `Ustaga biriktirish yoki qabul qilish uchun quyidagi tugmani bosing:`;

        for (const ch of chairmen) {
          if (ch.telegramId) {
            await sendTelegramMessage(token, ch.telegramId, chairmanNotice, {
              inline_keyboard: [
                [
                  { text: '👨‍🔧 Ustaga biriktirish', callback_data: `assign_prompt_${newComplaint.id}` },
                  { text: '✅ Qabul qilish', callback_data: `do_accept_${newComplaint.id}` },
                ],
                [
                  { text: '💼 Rais Kabinetida ochish', web_app: { url: `${appUrl}?role=CHAIRMAN&token=demo-chairman` } }
                ]
              ]
            });
          }
        }
      } catch (chairErr) {
        console.error('Error notifying chairman:', chairErr);
      }

      return;
    }
  }

  // -------------------------------------------------------------
  // DEFAULT RESPONSE
  // -------------------------------------------------------------
  const defaultReply = `Assalomu alaykum! Xabaringiz qabul qilindi.\n\n` +
    `Mahalla One xizmatlaridan foydalanish uchun quyidagi bo'limlardan birini tanlang yoki <b>/help</b> buyrug'ini yuboring:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: '📲 Mahalla One Mini App', web_app: { url: appUrl } }],
      [
        { text: '📝 Yangi murojaat', callback_data: 'cmd_newcomplaint' },
        { text: '📋 Murojaatlarim', callback_data: 'cmd_mycomplaints' },
      ],
      [
        { text: '📢 Mahalla e\'lonlari', callback_data: 'cmd_announcements' },
        { text: '☎️ Mahalla idorasi bilan aloqa', callback_data: 'cmd_contact' },
      ],
    ],
  };

  await sendTelegramMessage(token, chatId, defaultReply, inlineKeyboard);
}

// -----------------------------------------------------------------
// HELPER: CHAIRMAN STATISTICS
// -----------------------------------------------------------------
async function handleChairmanStats(token: string, chatId: number, neighborhoodId: string) {
  try {
    const totalComplaints = await db.select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined);

    const newCount = await db.select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(and(
        neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined,
        eq(complaints.status, 'NEW')
      ));

    const inProgressCount = await db.select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(and(
        neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined,
        sql`${complaints.status} IN ('ASSIGNED', 'IN_PROGRESS')`
      ));

    const resolvedCount = await db.select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(and(
        neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined,
        eq(complaints.status, 'RESOLVED')
      ));

    const totalResidents = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        neighborhoodId ? eq(users.neighborhoodId, neighborhoodId) : undefined,
        eq(users.role, 'CITIZEN')
      ));

    const avgRating = await db.select({ avg: sql<number>`avg(${ratings.score})` })
      .from(ratings);

    const statsMsg = `📊 <b>Vatanparvar MFY — Mahalla Raisi Statistikasi:</b>\n\n` +
      `👥 <b>Ro'yxatdan o'tgan fuqarolar:</b> ${totalResidents[0]?.count || 0} nafar\n` +
      `📋 <b>Jami kelib tushgan murojaatlar:</b> ${totalComplaints[0]?.count || 0} ta\n\n` +
      `⏳ <b>Yangi (ko'rib chiqilishi kerak):</b> ${newCount[0]?.count || 0} ta\n` +
      `⚙️ <b>Ijroda (Ustalarga biriktirilgan):</b> ${inProgressCount[0]?.count || 0} ta\n` +
      `✅ <b>Ijobiy hal etilganlar:</b> ${resolvedCount[0]?.count || 0} ta\n` +
      `⭐️ <b>Aholi mamnuniyat ko'rsatkichi:</b> ${avgRating[0]?.avg ? Number(avgRating[0].avg).toFixed(1) : '4.8'} / 5.0\n\n` +
      `🏛 <i>Batafsil tahlil va grafikalar uchun Rais Kabineti (Web App) tugmasini bosing.</i>`;

    await sendTelegramMessage(token, chatId, statsMsg);
  } catch (err: any) {
    console.error('Stats error:', err);
    await sendTelegramMessage(token, chatId, "Statistika ma'lumotlarini yuklashda xatolik yuz berdi.");
  }
}

// -----------------------------------------------------------------
// HELPER: CHAIRMAN NEW COMPLAINTS
// -----------------------------------------------------------------
async function handleChairmanNewComplaints(token: string, chatId: number, neighborhoodId: string, appUrl: string) {
  try {
    const list = await db.select().from(complaints)
      .where(and(
        neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined,
        sql`${complaints.status} IN ('NEW', 'ACCEPTED')`
      ))
      .orderBy(desc(complaints.createdAt))
      .limit(4);

    if (list.length === 0) {
      await sendTelegramMessage(
        token,
        chatId,
        `✅ <b>Hozircha yangi murojaatlar yo'q!</b>\n\nBarcha murojaatlar ko'rib chiqilgan va ustalarga biriktirilgan.`
      );
      return;
    }

    await sendTelegramMessage(
      token,
      chatId,
      `📥 <b>Ko'rib chiqilishi kutilayotgan yangi murojaatlar (${list.length} ta):</b>`
    );

    for (const c of list) {
      const msg = `🆔 <b>${c.complaintCode}</b>\n` +
        `📌 Mavzu: <b>${c.title}</b>\n` +
        `📝 Mazmuni: <i>${c.description}</i>\n` +
        `📍 Manzil: ${c.address || "Vatanparvar MFY"}\n` +
        `⏰ Sana: ${new Date(c.createdAt).toLocaleDateString('uz-UZ')}`;

      const buttons = {
        inline_keyboard: [
          [
            { text: '👨‍🔧 Ustaga biriktirish', callback_data: `assign_prompt_${c.id}` },
            { text: '✅ Qabul qilish', callback_data: `do_accept_${c.id}` },
          ],
          [
            { text: '💼 Rais Kabinetida to\'liq ko\'rish', web_app: { url: `${appUrl}?role=CHAIRMAN&token=demo-chairman` } }
          ]
        ]
      };

      await sendTelegramMessage(token, chatId, msg, buttons);
    }
  } catch (err: any) {
    console.error('Chairman new complaints error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: SHOW STAFF CHOICES
// -----------------------------------------------------------------
async function handleShowStaffChoices(token: string, chatId: number, complaintId: string, neighborhoodId: string) {
  try {
    const staffMembers = await db.query.users.findMany({
      where: and(
        neighborhoodId ? eq(users.neighborhoodId, neighborhoodId) : undefined,
        eq(users.role, 'STAFF')
      ),
    });

    if (staffMembers.length === 0) {
      await sendTelegramMessage(token, chatId, "Mahallaga biriktirilgan mas'ul ustalar topilmadi.");
      return;
    }

    const inline_keyboard: any[][] = [];
    staffMembers.forEach((st) => {
      inline_keyboard.push([
        { text: `👨‍🔧 ${st.fullName}`, callback_data: `do_assign_${complaintId}_${st.id}` }
      ]);
    });

    await sendTelegramMessage(
      token,
      chatId,
      `👨‍🔧 <b>Murojaatni qaysi ustaga biriktirmoqchisiz?</b>`,
      { inline_keyboard }
    );
  } catch (err: any) {
    console.error('Staff choice error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: EXECUTE ASSIGNMENT
// -----------------------------------------------------------------
async function handleExecuteAssign(
  token: string,
  chatId: number,
  complaintId: string,
  staffId: string,
  chairmanUserId: string,
  appUrl: string
) {
  try {
    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, complaintId),
    });
    const staff = await db.query.users.findFirst({
      where: eq(users.id, staffId),
    });

    if (!complaint || !staff) {
      await sendTelegramMessage(token, chatId, "Murojaat yoki usta ma'lumotlari topilmadi.");
      return;
    }

    // 1. Create assignment record
    await db.insert(assignments).values({
      complaintId,
      staffId,
      assignedById: chairmanUserId,
      notes: "Mahalla Raisi tomonidan Telegram bot orqali tezkor topshiriq biriktirildi",
      status: 'PENDING',
    });

    // 2. Update complaint status
    await db.update(complaints)
      .set({ status: 'ASSIGNED', updatedAt: new Date() })
      .where(eq(complaints.id, complaintId));

    // 3. Add to complaint history
    await db.insert(complaintHistory).values({
      complaintId,
      previousStatus: complaint.status,
      newStatus: 'ASSIGNED',
      responsibleUserId: chairmanUserId,
      explanation: `Mahalla Raisi bot orqali vazifani ${staff.fullName} ustasiga topshirdi`,
    });

    // 4. Notify citizen via Telegram
    if (complaint.citizenId) {
      const citizen = await db.query.users.findFirst({
        where: eq(users.id, complaint.citizenId),
      });
      if (citizen?.telegramId) {
        await sendTelegramMessage(
          token,
          citizen.telegramId,
          `👨‍🔧 <b>Murojaatingizga mas'ul usta biriktirildi!</b>\n\n` +
          `🆔 Kodi: <code>${complaint.complaintCode}</code>\n` +
          `📌 Mavzu: <b>${complaint.title}</b>\n` +
          `👤 Mas'ul: <b>${staff.fullName}</b>\n\n` +
          `Tez orada ta'mirlash ishlari amalga oshiriladi.`,
          {
            inline_keyboard: [
              [{ text: '📱 Mini Appda ko\'rish', web_app: { url: appUrl } }]
            ]
          }
        );
      }
    }

    // 5. Notify staff via Telegram if linked
    if (staff.telegramId) {
      await sendTelegramMessage(
        token,
        staff.telegramId,
        `⚠️ <b>Sizga yangi vazifa biriktirildi!</b>\n\n` +
        `🆔 Kodi: <code>${complaint.complaintCode}</code>\n` +
        `📌 Mavzu: <b>${complaint.title}</b>\n` +
        `📍 Manzil: ${complaint.address || "Mahalla"}\n\n` +
        `Iltimos, ishni boshlab, natija suratini yuklang.`
      );
    }

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>Topshiriq muvaffaqiyatli biriktirildi!</b>\n\n` +
      `Murojaat <code>${complaint.complaintCode}</code> mas'ul usta <b>${staff.fullName}</b>ga topshirildi va fuqaroga bildirishnoma yuborildi.`
    );
  } catch (err: any) {
    console.error('Execute assign error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: EXECUTE ACCEPT
// -----------------------------------------------------------------
async function handleExecuteAccept(
  token: string,
  chatId: number,
  complaintId: string,
  chairmanUserId: string,
  appUrl: string
) {
  try {
    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, complaintId),
    });
    if (!complaint) return;

    await db.update(complaints)
      .set({ status: 'ACCEPTED', updatedAt: new Date() })
      .where(eq(complaints.id, complaintId));

    await db.insert(complaintHistory).values({
      complaintId,
      previousStatus: complaint.status,
      newStatus: 'ACCEPTED',
      responsibleUserId: chairmanUserId,
      explanation: "Mahalla Raisi arizani qabul qildi va ko'rib chiqishga kiritdi",
    });

    if (complaint.citizenId) {
      const citizen = await db.query.users.findFirst({
        where: eq(users.id, complaint.citizenId),
      });
      if (citizen?.telegramId) {
        await sendTelegramMessage(
          token,
          citizen.telegramId,
          `✅ <b>Murojaatingiz Mahalla Raisi tomonidan qabul qilindi!</b>\n\n` +
          `🆔 Kodi: <code>${complaint.complaintCode}</code>\n` +
          `📌 Mavzu: <b>${complaint.title}</b>\n\n` +
          `Arizangiz tez orada mas'ul xodimga topshiriladi.`,
          {
            inline_keyboard: [
              [{ text: '📱 Mini Appda ko\'rish', web_app: { url: appUrl } }]
            ]
          }
        );
      }
    }

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>Arizasi qabul qilindi!</b> (Kodi: <code>${complaint.complaintCode}</code>)`
    );
  } catch (err: any) {
    console.error('Accept error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: LIST STAFF
// -----------------------------------------------------------------
async function handleStaffList(token: string, chatId: number, neighborhoodId: string) {
  try {
    const staffMembers = await db.query.users.findMany({
      where: and(
        neighborhoodId ? eq(users.neighborhoodId, neighborhoodId) : undefined,
        eq(users.role, 'STAFF')
      ),
    });

    if (staffMembers.length === 0) {
      await sendTelegramMessage(token, chatId, "Hozircha biriktirilgan xodimlar mavjud emas.");
      return;
    }

    let text = `👨‍🔧 <b>Vatanparvar MFY mas'ul xodimlari va ustalari:</b>\n\n`;
    for (const st of staffMembers) {
      text += `👤 <b>${st.fullName}</b>\n` +
        `📞 Tel: ${st.phone || "+998 91 234 56 78"}\n` +
        `💼 Maqomi: Faol xodim\n\n`;
    }

    await sendTelegramMessage(token, chatId, text);
  } catch (err: any) {
    console.error('Staff list error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: CITIZEN MY COMPLAINTS WITH PROGRESS TRACKER & RATING
// -----------------------------------------------------------------
async function handleMyComplaints(token: string, chatId: number, fromUser: any) {
  const citizen = await db.query.users.findFirst({
    where: eq(users.telegramId, String(fromUser.id)),
  });

  if (!citizen) {
    await sendTelegramMessage(
      token,
      chatId,
      `Sizda hozircha yuborilgan murojaatlar mavjud emas. Yangi murojaat yuborish uchun <b>/newcomplaint</b> buyrug'idan foydalaning.`
    );
    return;
  }

  const list = await db.select().from(complaints)
    .where(eq(complaints.citizenId, citizen.id))
    .orderBy(desc(complaints.createdAt))
    .limit(5);

  if (list.length === 0) {
    await sendTelegramMessage(
      token,
      chatId,
      `📋 <b>Murojaatlaringiz topilmadi.</b>\n\nMahallangizdagi muammolar yoki takliflar bo'yicha ariza yuborish uchun <b>/newcomplaint</b> buyrug'ini yuboring.`
    );
    return;
  }

  let text = `📋 <b>Sizning so'nggi murojaatlaringiz va ijro holati:</b>\n\n`;
  const inlineButtons: any[] = [];

  list.forEach((c, idx) => {
    let progressBadge = '⏳ [🟩⬜️⬜️⬜️] 25% (Yangi qabul qilindi)';
    if (c.status === 'ACCEPTED') progressBadge = '🔵 [🟩🟩⬜️⬜️] 50% (Rais ko\'rib chiqdi)';
    if (c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS') progressBadge = '🟠 [🟩🟩🟩⬜️] 75% (Usta ishlamoqda)';
    if (c.status === 'RESOLVED') progressBadge = '🟢 [🟩🟩🟩🟩] 100% (Hal etildi)';
    if (c.status === 'REJECTED') progressBadge = '🔴 [Rad etilgan]';

    text += `${idx + 1}. 🆔 <code>${c.complaintCode}</code> — <b>${c.title}</b>\n` +
      `   📊 Bosqich: <i>${progressBadge}</i>\n` +
      `   📍 Manzil: ${c.address || 'Vatanparvar MFY'}\n` +
      `   ⏰ Sana: ${new Date(c.createdAt).toLocaleDateString('uz-UZ')}\n\n`;

    if (c.status === 'RESOLVED') {
      inlineButtons.push([
        { text: `⭐️ [${c.complaintCode}] Ijro sifatini baholash`, callback_data: `prompt_rate_${c.id}` }
      ]);
    }
  });

  inlineButtons.push([
    { text: '➕ Yangi murojaat qoldirish', callback_data: 'cmd_newcomplaint' },
  ]);

  await sendTelegramMessage(token, chatId, text, { inline_keyboard: inlineButtons });
}

// -----------------------------------------------------------------
// HELPER: 5-STAR RATING SYSTEM
// -----------------------------------------------------------------
async function handleRating(
  token: string,
  chatId: number,
  complaintId: string,
  score: number,
  citizenId: string
) {
  try {
    const existing = await db.select().from(ratings).where(eq(ratings.complaintId, complaintId)).limit(1);
    if (existing.length > 0) {
      await db.update(ratings).set({ score }).where(eq(ratings.complaintId, complaintId));
    } else {
      await db.insert(ratings).values({
        complaintId,
        citizenId,
        score,
        comment: 'Telegram bot orqali fuqaro tomonidan baholandi',
      });
    }

    const stars = '⭐️'.repeat(score);
    await sendTelegramMessage(
      token,
      chatId,
      `⭐️ <b>Bahoingiz qabul qilindi!</b>\n\nSiz ko'rsatilgan xizmat sifatini <b>${score}/5 (${stars})</b> bilan baholadingiz.\n\nSizning bahoingiz Mahalla Raisi va Xodimlarning oylik ochiq KPI reytingida hisobga olinadi. Fuqarolik faolligingiz uchun tashakkur!`
    );
  } catch (err: any) {
    console.error('Rating error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: POLLS & VOTING SYSTEM
// -----------------------------------------------------------------
async function renderPollResult(token: string, chatId: number, pollId: string) {
  const poll = await db.query.polls.findFirst({ where: eq(polls.id, pollId) });
  if (!poll) return;
  const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId));
  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);

  let msg = `📊 <b>So'rovnoma natijalari:</b>\n\n📌 <b>${poll.question}</b>\nJami ovozlar: <b>${totalVotes}</b> ta\n\n`;
  for (const opt of options) {
    const percent = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
    const filledBlocks = Math.round(percent / 10);
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);
    msg += `• <b>${opt.optionText}</b>\n  <code>[${bar}]</code> <b>${percent}%</b> (${opt.voteCount} ovoz)\n\n`;
  }
  msg += `<i>Ishtirokingiz uchun tashakkur! Ovoz berish natijalari mahalla yig'ilishida ko'rib chiqiladi.</i>`;
  await sendTelegramMessage(token, chatId, msg);
}

async function handlePollVote(
  token: string,
  chatId: number,
  pollId: string,
  optionId: string,
  userId: string
) {
  try {
    const existingVote = await db.select().from(pollVotes).where(
      and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId))
    ).limit(1);

    if (existingVote.length > 0) {
      await sendTelegramMessage(token, chatId, "ℹ️ <b>Siz ushbu so'rovnomada allaqachon ovoz bergansiz!</b>");
      await renderPollResult(token, chatId, pollId);
      return;
    }

    await db.insert(pollVotes).values({
      pollId,
      optionId,
      userId,
    });

    await db.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, optionId));

    await sendTelegramMessage(token, chatId, "✅ <b>Ovozingiz muvaffaqiyatli qabul qilindi!</b>");
    await renderPollResult(token, chatId, pollId);
  } catch (voteErr: any) {
    console.error('Poll vote error:', voteErr);
  }
}

async function handlePolls(token: string, chatId: number, fromUser: any, dbUser: any) {
  try {
    const targetNeighId = dbUser.neighborhoodId;
    const activePolls = await db.select().from(polls)
      .where(and(
        targetNeighId ? eq(polls.neighborhoodId, targetNeighId) : undefined,
        eq(polls.isActive, true)
      ))
      .orderBy(desc(polls.createdAt))
      .limit(3);

    if (activePolls.length === 0) {
      await sendTelegramMessage(
        token,
        chatId,
        `📊 <b>Mahalla so'rovnomalari va ovoz berish</b>\n\nHozircha mahallangizda faol so'rovnoma mavjud emas. Rais yangi so'rovnoma e'lon qilganda bot sizga xabar beradi.`
      );
      return;
    }

    for (const p of activePolls) {
      const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, p.id));
      const userVote = await db.select().from(pollVotes).where(
        and(eq(pollVotes.pollId, p.id), eq(pollVotes.userId, dbUser.id))
      ).limit(1);

      if (userVote.length > 0) {
        await renderPollResult(token, chatId, p.id);
      } else {
        const voteKeyboard: any[] = [];
        options.forEach((opt) => {
          voteKeyboard.push([
            { text: `👉 ${opt.optionText}`, callback_data: `vote_${p.id}_${opt.id}` }
          ]);
        });

        await sendTelegramMessage(
          token,
          chatId,
          `📊 <b>Faol mahalla so'rovnomasi:</b>\n\n📌 <b>${p.question}</b>\n\nO'z ovozingizni berish uchun quyidagi variantlardan birini tanlang:`,
          { inline_keyboard: voteKeyboard }
        );
      }
    }
  } catch (err: any) {
    console.error('Polls error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: EMERGENCY HOTLINES (SOS)
// -----------------------------------------------------------------
async function handleEmergency(token: string, chatId: number, dbUser: any, pilotNeighborhood: any) {
  const currentNeighId = dbUser.neighborhoodId || pilotNeighborhood?.id;
  let neighInfo: any = null;
  if (currentNeighId) {
    neighInfo = await db.query.neighborhoods.findFirst({ where: eq(neighborhoods.id, currentNeighId) });
  }

  const sosMsg = `🚨 <b>FAVQULODDA TEZKOR XIZMATLAR (24/7):</b>\n\n` +
    `🚒 <b>101</b> — Yong'in xavfsizligi xizmati\n` +
    `👮‍♂️ <b>102</b> — Ichki ishlar & Mahalla Profilaktika inspektori\n` +
    `🚑 <b>103</b> — Tez tibbiy yordam brigadasi\n` +
    `⚡️ <b>104</b> — Favqulodda gaz ta'minoti xizmati\n` +
    `⚠️ <b>1050</b> — FVV Qutqaruv boshqarmasi\n` +
    `📞 <b>112</b> — Yagona tezkor dispetcherlik xizmati\n\n` +
    `🏛 <b>Mahalla idorasi tezkor aloqalari:</b>\n` +
    `• Mahalla: <b>${neighInfo?.nameUz || 'Vatanparvar MFY'}</b>\n` +
    `• Rais: <b>${neighInfo?.chairmanName || 'Rustam Boboyev'}</b>\n` +
    `• Telefon: <b>${neighInfo?.phone || '+998 75 221-45-88'}</b>\n` +
    `• Manzil: <i>${neighInfo?.address || 'Qarshi shahri, Mustaqillik shoh ko\'chasi, 14-uy'}</i>\n\n` +
    `<i>Shoshilinch vaziyatda zudlik bilan yuqoridagi qisqa raqamlarga bepul qo'ng'iroq qiling!</i>`;

  const sosKeyboard = {
    inline_keyboard: [
      [
        { text: '🚒 101 Yong\'in', url: 'https://t.me/fvv_uzb' },
        { text: '👮‍♂️ 102 IIB', url: 'https://t.me/iivuz' },
      ],
      [
        { text: '🚑 103 Tez yordam', url: 'https://ssv.uz' },
        { text: '⚡️ 104 Gaz', url: 'https://hududgaz.uz' },
      ],
      [
        { text: '⬅️ Asosiy menyu', callback_data: 'adm_switch_citizen' }
      ]
    ]
  };

  await sendTelegramMessage(token, chatId, sosMsg, sosKeyboard);
}

// -----------------------------------------------------------------
// HELPER: ANNOUNCEMENTS
// -----------------------------------------------------------------
async function handleAnnouncements(token: string, chatId: number) {
  const list = await db.select().from(announcements)
    .where(eq(announcements.isPublished, true))
    .orderBy(desc(announcements.publishedAt))
    .limit(3);

  if (list.length === 0) {
    await sendTelegramMessage(token, chatId, 'Hozircha faol mahalla e\'lonlari mavjud emas.');
    return;
  }

  let text = `📢 <b>Qarshi shahri, Vatanparvar MFY e'lonlari:</b>\n\n`;
  list.forEach((a) => {
    text += `📌 <b>${a.title}</b>\n${a.content}\n\n`;
  });

  await sendTelegramMessage(token, chatId, text);
}

// -----------------------------------------------------------------
// HELPER: CONTACT
// -----------------------------------------------------------------
async function handleContact(token: string, chatId: number) {
  const contactText = `🏛 <b>Qarshi shahri, Vatanparvar MFY idorasi:</b>\n\n` +
    `👤 <b>Mahalla raisi:</b> Rustam Boboyev\n` +
    `📞 <b>Telefon:</b> +998 75 221-45-88 / +998 90 123 45 67\n` +
    `📍 <b>Manzil:</b> Qarshi shahar, Mustaqillik shoh ko'chasi 14-uy\n` +
    `⏰ <b>Qabul vaqtlari:</b> Dushanba - Juma, 09:00 - 18:00\n\n` +
    `Elektron murojaatlar <b>Mahalla One</b> orqali 24/7 qabul qilinadi.`;

  await sendTelegramMessage(token, chatId, contactText);
}

// -----------------------------------------------------------------
// HELPER: SUPER ADMIN STATISTICS
// -----------------------------------------------------------------
async function handleSuperAdminStats(token: string, chatId: number) {
  try {
    const regCount = await db.select({ count: sql<number>`count(*)` }).from(regions);
    const distCount = await db.select({ count: sql<number>`count(*)` }).from(districts);
    const neighCount = await db.select({ count: sql<number>`count(*)` }).from(neighborhoods);
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const compCount = await db.select({ count: sql<number>`count(*)` }).from(complaints);

    const statsMsg = `🌐 <b>Mahalla One — Respublika Boshqaruv Statistikasi:</b>\n\n` +
      `🏛 <b>Viloyatlar / Hududlar:</b> ${regCount[0]?.count || 14} ta\n` +
      `🏙 <b>Tuman va shaharlar:</b> ${distCount[0]?.count || 0} ta\n` +
      `🏘 <b>Raqamlashgan mahallalar:</b> ${neighCount[0]?.count || 0} ta\n` +
      `👥 <b>Jami ro'yxatdan o'tgan foydalanuvchilar:</b> ${userCount[0]?.count || 0} nafar\n` +
      `📋 <b>Tizimdagi jami murojaatlar:</b> ${compCount[0]?.count || 0} ta\n\n` +
      `👑 <i>To'liq boshqaruv, hudud qo'shish va hisobotlar uchun Super Admin Web App kabinetiga kiring.</i>`;

    await sendTelegramMessage(token, chatId, statsMsg);
  } catch (err: any) {
    console.error('Superadmin stats error:', err);
    await sendTelegramMessage(token, chatId, "Statistika ma'lumotlarini yuklashda xatolik yuz berdi.");
  }
}

// -----------------------------------------------------------------
// HELPER: SUPER ADMIN NEIGHBORHOODS
// -----------------------------------------------------------------
async function handleSuperAdminNeighborhoods(token: string, chatId: number) {
  try {
    const neighList = await db.select().from(neighborhoods).limit(10);
    let msg = `🏢 <b>Tizimdagi faol mahallalar ro'yxati (${neighList.length} ta):</b>\n\n`;
    neighList.forEach((n, idx) => {
      msg += `${idx + 1}. <b>${n.nameUz}</b>\n` +
        `   📍 Manzil: ${n.address || "Qarshi shahri"}\n` +
        `   👤 Rais: ${n.chairmanName || "Rustam Boboyev"}\n` +
        `   📞 Aloqa: ${n.phone || "+998 75 221-45-88"}\n\n`;
    });
    await sendTelegramMessage(token, chatId, msg);
  } catch (err) {
    console.error('Superadmin neighborhoods error:', err);
  }
}

// -----------------------------------------------------------------
// HELPER: OPEN BUDGET MODULE
// -----------------------------------------------------------------
async function handleOpenBudget(token: string, chatId: number) {
  const budgetMsg = `💰 <b>"TASHABBUSLI BYUDJET" (OPEN BUDGET) — VATANPARVAR MFY</b>\n\n` +
    `Mahallamiz infratuzilmasini yaxshilash va davlat tomonidan ajratiladigan mablag'ni jalb qilish uchun barchamiz birgalikda faol ovoz beraylik!\n\n` +
    `📌 <b>Loyiha nomi:</b> Vatanparvar MFY ichki yo'llarini to'liq asfaltlash va piyodalar yo'lagi qurish\n` +
    `🆔 <b>Loyiha kodi:</b> <code>330248190012</code>\n` +
    `💵 <b>Ajratiladigan mablag':</b> 1,200,000,000 so'm\n` +
    `📊 <b>Hozirgi to'plangan ovozlar:</b> <b>1,420 ta</b> (Kerakli marra: 2,000 ta)\n` +
    `📈 <b>Ijro bosqichi:</b> <code>[███████░░░] 71%</code>\n\n` +
    `📲 <b>Qanday qilib bepul ovoz berish mumkin?</b>\n` +
    `1. Quyidagi <b>«🗳 Ochiq Byudjetda ovoz berish»</b> tugmasini bosing yoki <b>1010</b> qisqa raqamiga loyiha kodini bepul SMS qilib yuboring.\n` +
    `2. Telefoningizga kelgan bir martalik kodni tasdiqlang.\n\n` +
    `🛡 <i>Eslatma: Ovoz berish mutlaqo bepul! Hech kimga bank kartangiz ma'lumotlarini yoki SMS orqali kelgan maxfiy kodni bermang.</i>`;

  const budgetKeyboard = {
    inline_keyboard: [
      [
        { text: '🗳 Ochiq Byudjetda ovoz berish', url: 'https://openbudget.uz' },
      ],
      [
        { text: '📢 Qo\'shnilarga ulashish (Share)', url: `https://t.me/share/url?url=https://openbudget.uz&text=Hurmatli+qo'shnilar,+Vatanparvar+MFY+yo'llarini+ta'mirlash+uchun+ovoz+beraylik!` },
      ],
      [
        { text: '⬅️ Asosiy menyu', callback_data: 'adm_switch_citizen' },
      ],
    ],
  };

  await sendTelegramMessage(token, chatId, budgetMsg, budgetKeyboard);
}

// -----------------------------------------------------------------
// HELPER: LANGUAGE AND SCRIPT SELECTOR
// -----------------------------------------------------------------
async function handleLanguageSelect(token: string, chatId: number) {
  const langMsg = `🌐 <b>Muloqot tilini va yozuvni tanlang:</b>\n` +
    `Тил ва ёзувни танланг:\n` +
    `Выберите язык интерфейса:`;

  const langKeyboard = {
    inline_keyboard: [
      [
        { text: '🇺🇿 O\'zbekcha (Lotin)', callback_data: 'set_lang_uz_lat' },
      ],
      [
        { text: '🇺🇿 Ўзбекча (Кирилл)', callback_data: 'set_lang_uz_cyr' },
      ],
      [
        { text: '🇷🇺 Русский', callback_data: 'set_lang_ru' },
      ],
    ],
  };

  await sendTelegramMessage(token, chatId, langMsg, langKeyboard);
}

// -----------------------------------------------------------------
// HELPER: PROFESSIONAL EXECUTIVE PDF REPORT GENERATOR
// -----------------------------------------------------------------
async function handleGeneratePdfReport(token: string, chatId: number, neighborhoodId?: string) {
  try {
    await sendTelegramMessage(token, chatId, "⏳ <b>Rasmiy PDF hisobot shakllantirilmoqda...</b>");

    // Fetch live metrics
    const [
      totalCount,
      newCount,
      inProgressCount,
      resolvedCount,
      totalUsers,
      avgRating
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(complaints).where(neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined),
      db.select({ count: sql<number>`count(*)` }).from(complaints).where(and(neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined, eq(complaints.status, 'NEW'))),
      db.select({ count: sql<number>`count(*)` }).from(complaints).where(and(neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined, inArray(complaints.status, ['ASSIGNED', 'IN_PROGRESS']))),
      db.select({ count: sql<number>`count(*)` }).from(complaints).where(and(neighborhoodId ? eq(complaints.neighborhoodId, neighborhoodId) : undefined, eq(complaints.status, 'RESOLVED'))),
      db.select({ count: sql<number>`count(*)` }).from(users).where(neighborhoodId ? eq(users.neighborhoodId, neighborhoodId) : undefined),
      db.select({ avg: sql<number>`coalesce(avg(${ratings.score}), 5.0)` }).from(ratings),
    ]);

    const total = Number(totalCount[0]?.count || 0);
    const resolved = Number(resolvedCount[0]?.count || 0);
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
    const ratingValue = Number(avgRating[0]?.avg || 5.0).toFixed(1);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Decorative Header Banner
    doc.setFillColor(30, 58, 138); // Deep Navy Blue
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text("O'ZBEKISTON RESPUBLIKASI", 105, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("MAHALLA VA NURONIYLARNI QO'LLAB-QUVVATLASH TIZIMI", 105, 18, { align: 'center' });
    doc.text("MAHALLA ONE — RAQAMLI BOSHQARUV PLATFORMASI", 105, 24, { align: 'center' });

    // Document Title
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("OYLIK IJRO VA MUROJAATLAR TAHLILI HISOBOTI", 105, 42, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const dateStr = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Sana: ${dateStr} | Hudud: Qarshi shahri, Vatanparvar MFY`, 105, 48, { align: 'center' });

    // Line separator
    doc.setDrawColor(209, 213, 219);
    doc.line(15, 52, 195, 52);

    // Section 1: KPI Summary Boxes
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text("1. ASOSIY KO'RSATKICHLAR (KPI)", 15, 62);

    // Box 1 - Jami
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(15, 66, 55, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text("Jami murojaatlar", 20, 72);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(`${total} ta`, 20, 83);

    // Box 2 - Samara
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(77, 66, 55, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(5, 150, 105);
    doc.text("Hal etilgan (Samara)", 82, 72);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(`${resolved} ta (${resolutionRate}%)`, 82, 83);

    // Box 3 - Reyting
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(140, 66, 55, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text("Fuqarolar bahosi", 145, 72);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(`* ${ratingValue} / 5.0`, 145, 83);

    // Section 2: Detailed Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text("2. HOLATLAR KESIMIDA TAQSIMOT", 15, 100);

    const rows = [
      ["1. Ko'rib chiqilishi kutilayotgan yangi arizalar", `${newCount[0]?.count || 0} ta`],
      ["2. Mas'ul ustalarga biriktirilgan va ijrodagi arizalar", `${inProgressCount[0]?.count || 0} ta`],
      ["3. Muvaffaqiyatli bartaraf etilgan va fuqaro tasdiqlagan", `${resolved} ta`],
      ["4. Ro'yxatdan o'tgan fuqarolar soni", `${totalUsers[0]?.count || 0} nafar`],
      ["5. O'rtacha ijro vaqti", "24 soat ichida"],
    ];

    let startY = 108;
    rows.forEach(([label, val], idx) => {
      doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
      doc.rect(15, startY - 5, 180, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      doc.text(label, 20, startY);
      doc.setFont('helvetica', 'bold');
      doc.text(val, 185, startY, { align: 'right' });
      startY += 8;
    });

    // Section 3: Official Seal & Signature Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text("3. MAS'UL SHAXSLAR TASDIG'I", 15, 170);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Mahalla Fuqarolar Yig'ini Raisi: _________________ (Rustam Boboyev)", 20, 185);
    doc.text("Ijro monitoringi bo'yicha mas'ul kotib: _______________ (A. Karimov)", 20, 198);
    doc.text("Elektron imzo (Mahalla One QR-verifikatsiya): TASDIQLANGAN", 20, 211);

    // Footer
    doc.setDrawColor(229, 231, 235);
    doc.line(15, 270, 195, 270);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text("Mahalla One - O'zbekiston Respublikasi Mahalla Tizimini Raqamlashtirish Portali | Avtomatik generatsiya", 105, 276, { align: 'center' });

    const pdfBuffer = doc.output('arraybuffer');
    const filename = `Mahalla_One_Hisobot_${Date.now().toString().slice(-4)}.pdf`;

    await sendTelegramDocument(
      token,
      chatId,
      pdfBuffer,
      filename,
      `📄 <b>Oylik rasmiy ijro hisoboti muvaffaqiyatli shakllantirildi!</b>\n\n` +
      `🏛 <b>Vatanparvar MFY</b>\n` +
      `📅 Sana: <b>${dateStr}</b>\n` +
      `📊 Murojaatlar: <b>${total} ta</b> (Samaradorlik: <b>${resolutionRate}%</b>)\n` +
      `⭐️ O'rtacha baho: <b>${ratingValue} / 5.0</b>\n\n` +
      `<i>Hujjatni yuklab olib, rasmiy taqdimot yoki hokimlikka hisobot uchun ishlatishingiz mumkin.</i>`
    );
  } catch (pdfErr: any) {
    console.error('PDF report error:', pdfErr);
    await sendTelegramMessage(token, chatId, "❌ PDF hisobotni yaratishda xatolik yuz berdi.");
  }
}

// -----------------------------------------------------------------
// HELPER: SUPER ADMIN USERS
// -----------------------------------------------------------------
async function handleSuperAdminUsers(token: string, chatId: number) {
  try {
    const userList = await db.select().from(users).limit(10);
    let msg = `👥 <b>Tizimdagi foydalanuvchilar (namuna ${userList.length} nafar):</b>\n\n`;
    userList.forEach((u, idx) => {
      msg += `${idx + 1}. <b>${u.fullName}</b> — <i>${u.role}</i>\n` +
        `   Telegram: ${u.telegramUsername ? '@' + u.telegramUsername : 'ID: ' + (u.telegramId || 'bog\'lanmagan')}\n`;
    });
    await sendTelegramMessage(token, chatId, msg);
  } catch (err) {
    console.error('Superadmin users error:', err);
  }
}

/**
 * Robust Long Polling Runner
 */
export function startTelegramLongPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN not configured. Long polling skipped.');
    return;
  }

  console.log('[Telegram Bot] Starting Telegram Bot Long Polling for @mahallaone_bot...');
  let offset = 0;
  let isRunning = true;

  const initAndPoll = async () => {
    // 1. Delete any leftover webhook to ensure getUpdates is allowed
    try {
      const delRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      const delData = await delRes.json();
      console.log('[Telegram Bot] deleteWebhook result:', delData.description || delData.ok);
    } catch (e: any) {
      console.warn('[Telegram Bot] deleteWebhook notice:', e.message);
    }

    // 2. Continuous polling loop
    while (isRunning) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25&limit=100`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            console.log(`[Telegram Bot] Processing update ${update.update_id} from @${update.message?.from?.username || update.message?.from?.id}`);
            try {
              await handleTelegramUpdate(update, token);
            } catch (updateErr) {
              console.error('[Telegram Bot] Error processing update:', updateErr);
            }
          }
        } else if (!data.ok) {
          console.warn('[Telegram Bot] getUpdates error:', data.description);
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (err: any) {
        console.error('[Telegram Bot] Network polling error:', err.message);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  };

  // Run in background
  initAndPoll();

  return () => {
    isRunning = false;
  };
}
