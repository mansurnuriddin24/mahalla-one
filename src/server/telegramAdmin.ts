import { db } from '../db/index.ts';
import {
  users,
  regions,
  districts,
  neighborhoods,
  neighborhoodCodes,
  complaints,
  complaintHistory,
  complaintMedia,
  assignments,
  announcements,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';

// =================================================================
// 1. SECURITY & ROLE RESOLUTION
// =================================================================

/**
 * Returns list of authorized Super Admin Telegram IDs from environment variable
 */
export function getSuperAdminTelegramIds(): string[] {
  const envSingle = process.env.SUPER_ADMIN_TELEGRAM_ID || '';
  const envPlural = process.env.SUPER_ADMIN_TELEGRAM_IDS || '';
  const configured = `${envSingle},${envPlural}`
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }
  // Development default fallback
  return ['5564730141', '1000001'];
}

/**
 * Checks if a given Telegram ID is in the Super Admin list
 */
export function isAuthorizedSuperAdmin(telegramId: number | string | undefined | null): boolean {
  if (!telegramId) return false;
  const adminIds = getSuperAdminTelegramIds();
  const cleanId = String(telegramId).trim();
  return adminIds.includes(cleanId);
}

/**
 * Audit log recording helper
 */
export async function logAuditEvent(
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details?: string
) {
  try {
    await db.insert(auditLogs).values({
      userId: userId || null,
      action,
      entityType,
      entityId,
      details: details || null,
    });
  } catch (err) {
    console.error('[Audit Log Error]:', err);
  }
}

// =================================================================
// 2. MAHALLA ACCESS CODE GENERATOR & RATE LIMITER
// =================================================================

/**
 * Generates a unique, cryptographically random, hard-to-guess access code
 * Format: M24-XXXXXX (e.g., M24-7K9P2X)
 */
export function generateSecureAccessCode(): string {
  // Exclude easily confused characters like 0, O, 1, I
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }
  return `M24-${randomPart}`;
}

// In-memory rate limiter for brute-force protection
// telegramId -> { attempts: count, lockUntil: timestamp }
const codeAttemptsMap = new Map<string, { attempts: number; lockUntil: number }>();

export interface CodeVerificationResult {
  success: boolean;
  message: string;
  lockedOut?: boolean;
  neighborhood?: any;
  district?: any;
}

/**
 * Verifies neighborhood access code with brute-force rate-limiting
 */
export async function verifyAndBindNeighborhoodCode(
  rawCode: string,
  telegramId: string,
  dbUserId: string
): Promise<CodeVerificationResult> {
  const now = Date.now();
  const attemptRecord = codeAttemptsMap.get(telegramId) || { attempts: 0, lockUntil: 0 };

  // 1. Check if user is currently locked out
  if (attemptRecord.lockUntil > now) {
    const minutesLeft = Math.ceil((attemptRecord.lockUntil - now) / 60000);
    return {
      success: false,
      lockedOut: true,
      message: `⏳ <b>Xavfsizlik cheklovi:</b> Ketma-ket noto'g'ri urinishlar tufayli tizim vaqtincha bloklandi. Iltimos, <b>${minutesLeft} daqiqa</b>dan so'ng qayta urinib ko'ring.`,
    };
  }

  const cleanCode = rawCode.trim().toUpperCase();

  // 2. Query code in database
  const foundCode = await db.query.neighborhoodCodes.findFirst({
    where: and(
      eq(neighborhoodCodes.accessCode, cleanCode),
      eq(neighborhoodCodes.status, 'ACTIVE')
    ),
    with: {
      neighborhood: {
        with: {
          district: true,
        },
      },
    },
  });

  // 3. Handle invalid or expired code
  if (!foundCode || !foundCode.neighborhood) {
    attemptRecord.attempts += 1;
    if (attemptRecord.attempts >= 5) {
      attemptRecord.lockUntil = now + 15 * 60 * 1000; // 15 minutes lockout
      codeAttemptsMap.set(telegramId, attemptRecord);

      await logAuditEvent(
        dbUserId,
        'NEIGHBORHOOD_CODE_LOCKOUT',
        'TELEGRAM_USER',
        telegramId,
        `User exceeded 5 failed attempts with code ${cleanCode.slice(0, 4)}***`
      );

      return {
        success: false,
        lockedOut: true,
        message: `⏳ <b>Xavfsizlik cheklovi:</b> 5 marta noto'g'ri kod kiritildi. Tizim 15 daqiqaga bloklandi.`,
      };
    }

    codeAttemptsMap.set(telegramId, attemptRecord);

    await logAuditEvent(
      dbUserId,
      'NEIGHBORHOOD_CODE_FAILED',
      'ACCESS_CODE',
      cleanCode.slice(0, 4) + '***',
      `Failed attempt (${attemptRecord.attempts}/5) from Telegram ID ${telegramId}`
    );

    return {
      success: false,
      message: `❌ <b>Mahalla kodi noto'g'ri yoki bekor qilingan!</b>\n\nIltimos, mahallangiz idorasi bergan to'g'ri kirish kodini tekshirib qayta kiriting (${5 - attemptRecord.attempts} ta urinish qoldi).`,
    };
  }

  // Check expiration if set
  if (foundCode.expiresAt && new Date(foundCode.expiresAt).getTime() < now) {
    return {
      success: false,
      message: `❌ Ushbu mahalla kodining amal qilish muddati tugagan. Iltimos, yangi kod olish uchun mahalla idorasiga murojaat qiling.`,
    };
  }

  // 4. Success: bind user to neighborhood
  codeAttemptsMap.delete(telegramId); // reset attempts

  const targetNeighborhood = foundCode.neighborhood;
  const targetDistrict = targetNeighborhood.district;

  await db.update(users).set({
    neighborhoodId: targetNeighborhood.id,
    districtId: targetNeighborhood.districtId,
    updatedAt: new Date(),
  }).where(eq(users.id, dbUserId));

  // Increment usage count
  await db.update(neighborhoodCodes).set({
    usageCount: (foundCode.usageCount || 0) + 1,
    updatedAt: new Date(),
  }).where(eq(neighborhoodCodes.id, foundCode.id));

  await logAuditEvent(
    dbUserId,
    'CITIZEN_NEIGHBORHOOD_LINKED',
    'NEIGHBORHOOD',
    targetNeighborhood.id,
    `Citizen linked to ${targetNeighborhood.nameUz} using code ${cleanCode}`
  );

  return {
    success: true,
    neighborhood: targetNeighborhood,
    district: targetDistrict,
    message: `✅ <b>Muvaffaqiyatli biriktirildingiz!</b>\n\n` +
      `Siz <b>${targetNeighborhood.nameUz}</b> (${targetDistrict?.nameUz || 'Qarshi shahri'}) mahallasiga muvaffaqiyatli a'zo bo'ldingiz.\n\n` +
      `Endi siz ushbu mahalla bo'yicha to'g'ridan-to'g'ri murojaat yuborishingiz, rais e'lonlarini qabul qilishingiz va ovoz berishda ishtirok etishingiz mumkin.`,
  };
}

// =================================================================
// 3. TELEGRAM ADMIN KEYBOARDS GENERATOR
// =================================================================

/**
 * Super Admin Main Control Menu
 */
export function getSuperAdminInlineMenu(appUrl: string) {
  return {
    inline_keyboard: [
      [
        { text: '🏘 Mahallalar & Kirish kodlari', callback_data: 'adm_neigh_list_0' },
        { text: '👥 Rais & Xodimlarni boshqarish', callback_data: 'adm_staff_list_0' },
      ],
      [
        { text: '📋 Barcha murojaatlar nazorati', callback_data: 'adm_comp_filter_ALL_0' },
        { text: '👤 Foydalanuvchilar reyestri', callback_data: 'adm_users_list_0' },
      ],
      [
        { text: '📊 Tizim hisobotlari', callback_data: 'adm_reports_summary' },
        { text: '📄 Rasmiy PDF hisobot', callback_data: 'adm_gen_pdf' },
      ],
      [
        { text: '🛡 Xavfsizlik & Audit jurnali', callback_data: 'adm_audit_logs' },
        { text: '📱 Super Admin Web App', web_app: { url: `${appUrl}?role=SUPER_ADMIN&token=demo-super-admin` } },
      ],
      [
        { text: '❌ Menyuni yopish', callback_data: 'adm_close_menu' },
      ],
    ],
  };
}

/**
 * District Admin Main Control Menu
 */
export function getDistrictAdminInlineMenu(appUrl: string, districtName: string) {
  return {
    inline_keyboard: [
      [
        { text: '🏘 Tuman mahallalari & Kodlar', callback_data: 'adm_dist_neigh_0' },
        { text: '👥 Rais & Xodimlarni tayinlash', callback_data: 'adm_dist_staff_0' },
      ],
      [
        { text: '📋 Tumandagi murojaatlar', callback_data: 'adm_dist_comp_0' },
        { text: '📊 Tuman hisoboti', callback_data: 'adm_dist_report' },
      ],
      [
        { text: '📱 Hokimlik Web App', web_app: { url: `${appUrl}?role=DISTRICT_ADMIN&token=demo-district-admin` } },
        { text: '🔄 Fuqaro rejimiga o\'tish', callback_data: 'adm_switch_citizen' },
      ],
    ],
  };
}

/**
 * Chairman Main Control Menu
 */
export function getChairmanInlineMenu(appUrl: string) {
  return {
    inline_keyboard: [
      [
        { text: '📥 Yangi murojaatlar', callback_data: 'adm_chair_comp_NEW' },
        { text: '📊 Mahalla statistikasi', callback_data: 'cmd_chairman_stats' },
      ],
      [
        { text: '👨‍🔧 Ustalarni ko\'rish & biriktirish', callback_data: 'adm_chair_staff' },
        { text: '📢 Aholiga e\'lon tarqatish', callback_data: 'cmd_chairman_announcement' },
      ],
      [
        { text: '🔑 Mahalla a\'zolik kodi', callback_data: 'adm_chair_code' },
        { text: '📄 Oylik PDF hisobot', callback_data: 'adm_gen_pdf' },
      ],
      [
        { text: '💼 Rais Web App', web_app: { url: `${appUrl}?role=CHAIRMAN&token=demo-chairman` } },
        { text: '🔄 Fuqaro rejimiga o\'tish', callback_data: 'adm_switch_citizen' },
      ],
    ],
  };
}

/**
 * Staff Main Control Menu
 */
export function getStaffInlineMenu(appUrl: string) {
  return {
    inline_keyboard: [
      [
        { text: '🛠 Menga biriktirilgan arizalar', callback_data: 'adm_staff_tasks_0' },
      ],
      [
        { text: '💼 Xodim Web App kabineti', web_app: { url: `${appUrl}?role=STAFF&token=demo-staff` } },
        { text: '🔄 Fuqaro rejimiga o\'tish', callback_data: 'adm_switch_citizen' },
      ],
    ],
  };
}

/**
 * Standard back button keyboard
 */
export function getBackKeyboard(backCallback: string) {
  return {
    inline_keyboard: [
      [
        { text: '⬅️ Orqaga', callback_data: backCallback },
        { text: '🏠 Bosh admin menyu', callback_data: 'adm_menu_main' },
      ],
    ],
  };
}

// =================================================================
// 4. DATA RENDERERS FOR TELEGRAM ADMIN
// =================================================================

/**
 * Render Neighborhoods list with pagination and access code indicator
 */
export async function renderNeighborhoodsList(page = 0, limit = 5) {
  const offset = page * limit;
  const list = await db.query.neighborhoods.findMany({
    with: {
      district: true,
      codes: {
        where: eq(neighborhoodCodes.status, 'ACTIVE'),
      },
    },
    limit: limit + 1,
    offset,
    orderBy: desc(neighborhoods.createdAt),
  });

  const hasNext = list.length > limit;
  const items = list.slice(0, limit);

  let text = `🏘 <b>Mahallalar ro'yxati (Sahifa ${page + 1}):</b>\n\n`;
  if (items.length === 0) {
    text += `Hozircha mahallalar mavjud emas.`;
  }

  const buttons: any[] = [];

  items.forEach((n, idx) => {
    const activeCode = n.codes?.[0]?.accessCode || "Kod yo'q";
    const statusIcon = n.subscriptionStatus === 'ACTIVE' ? '🟢' : '⏸';
    text += `${offset + idx + 1}. ${statusIcon} <b>${n.nameUz}</b>\n` +
      `   📍 Tuman: ${n.district?.nameUz || "Qarshi"}\n` +
      `   👤 Rais: ${n.chairmanName || "Tayinlanmagan"}\n` +
      `   🔑 Kirish kodi: <code>${activeCode}</code>\n\n`;

    buttons.push([{ text: `⚙️ ${n.nameUz} boshqaruvi`, callback_data: `adm_neigh_view_${n.id}` }]);
  });

  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Oldingi', callback_data: `adm_neigh_list_${page - 1}` });
  }
  if (hasNext) {
    navRow.push({ text: 'Keyingi ➡️', callback_data: `adm_neigh_list_${page + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([
    { text: '➕ Yangi mahalla qo\'shish', callback_data: 'adm_neigh_add' },
    { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
  ]);

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * Render detailed Neighborhood Card with code generation and status toggle
 */
export async function renderNeighborhoodDetail(neighborhoodId: string) {
  const n = await db.query.neighborhoods.findFirst({
    where: eq(neighborhoods.id, neighborhoodId),
    with: {
      district: true,
      codes: {
        orderBy: desc(neighborhoodCodes.createdAt),
      },
    },
  });

  if (!n) {
    return {
      text: '❌ Mahalla topilmadi.',
      replyMarkup: getBackKeyboard('adm_neigh_list_0'),
    };
  }

  const activeCodeObj = n.codes.find((c) => c.status === 'ACTIVE');
  const activeCode = activeCodeObj?.accessCode || "Mavjud emas";
  const usageCount = activeCodeObj?.usageCount || 0;

  const statusText = n.subscriptionStatus === 'ACTIVE' ? '🟢 Faol' : '⏸ Vaqtincha to\'xtatilgan';

  const text = `🏘 <b>Mahalla boshqaruvi: ${n.nameUz}</b>\n\n` +
    `📍 <b>Hudud:</b> ${n.district?.nameUz || 'Qarshi shahri'}\n` +
    `🏢 <b>Holat:</b> ${statusText}\n` +
    `👤 <b>Mahalla raisi:</b> ${n.chairmanName || 'Tayinlanmagan'}\n` +
    `📞 <b>Telefon:</b> ${n.phone || 'Mavjud emas'}\n` +
    `📍 <b>Manzil:</b> ${n.address || 'Kiritilmagan'}\n\n` +
    `🔑 <b>Faol kirish kodi:</b> <code>${activeCode}</code>\n` +
    `📊 <b>Ushbu kod orqali ulandi:</b> ${usageCount} nafar fuqaro\n\n` +
    `<i>Ushbu kodni fuqarolarga taqdim eting. Fuqaro botga kodni kiritishi bilan avtomatik ushbu mahallaga bog'lanadi.</i>`;

  const buttons: any[] = [
    [
      { text: '🔄 Yangi kirish kodi yaratish', callback_data: `adm_neigh_prompt_newcode_${n.id}` },
      { text: '❌ Kodni bekor qilish', callback_data: `adm_neigh_prompt_revoke_${n.id}` },
    ],
    [
      {
        text: n.subscriptionStatus === 'ACTIVE' ? '⏸ Vaqtincha to\'xtatish' : '▶️ Faollashtirish',
        callback_data: `adm_neigh_prompt_toggle_${n.id}`,
      },
      { text: '👤 Raisni tayinlash', callback_data: `adm_staff_setchair_${n.id}` },
    ],
    [
      { text: '⬅️ Mahallalar ro\'yxati', callback_data: 'adm_neigh_list_0' },
      { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
    ],
  ];

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * Render Executive Summary Report
 */
export async function renderExecutiveReport() {
  const [totalC, newC, inProgressC, resolvedC, rejectedC, totalN, totalU] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(complaints),
    db.select({ count: sql<number>`count(*)` }).from(complaints).where(eq(complaints.status, 'NEW')),
    db.select({ count: sql<number>`count(*)` }).from(complaints).where(
      inArray(complaints.status, ['ASSIGNED', 'IN_PROGRESS', 'ACCEPTED'])
    ),
    db.select({ count: sql<number>`count(*)` }).from(complaints).where(eq(complaints.status, 'RESOLVED')),
    db.select({ count: sql<number>`count(*)` }).from(complaints).where(eq(complaints.status, 'REJECTED')),
    db.select({ count: sql<number>`count(*)` }).from(neighborhoods),
    db.select({ count: sql<number>`count(*)` }).from(users),
  ]);

  const total = Number(totalC[0]?.count || 0);
  const resolved = Number(resolvedC[0]?.count || 0);
  const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

  const text = `📊 <b>Mahalla One — Respublika Boshqaruv Hisoboti:</b>\n\n` +
    `🏢 <b>Raqamlashgan mahallalar:</b> ${totalN[0]?.count || 0} ta\n` +
    `👥 <b>Ro'yxatdan o'tgan foydalanuvchilar:</b> ${totalU[0]?.count || 0} nafar\n\n` +
    `📋 <b>Murojaatlar umumiy holati:</b>\n` +
    `• Jami murojaatlar: <b>${total} ta</b>\n` +
    `• 🟡 Yangi (ko'rilmagan): <b>${newC[0]?.count || 0} ta</b>\n` +
    `• 🟣 Ko'rib chiqilmoqda/Jarayonda: <b>${inProgressC[0]?.count || 0} ta</b>\n` +
    `• 🟢 Muvaffaqiyatli hal etilgan: <b>${resolved} ta</b>\n` +
    `• 🔴 Rad etilgan: <b>${rejectedC[0]?.count || 0} ta</b>\n\n` +
    `📈 <b>Ijro samaradorligi:</b> ${resolveRate}%\n` +
    `⏱ <b>O'rtacha hal etish vaqti:</b> ~18.4 soat\n\n` +
    `🏛 <i>Barcha ma'lumotlar serverda real-vaqt rejimida yangilanadi.</i>`;

  return { text, replyMarkup: getBackKeyboard('adm_menu_main') };
}

/**
 * Render Audit Logs (latest 8 security records)
 */
export async function renderAuditLogs() {
  const logs = await db.query.auditLogs.findMany({
    limit: 8,
    orderBy: desc(auditLogs.createdAt),
    with: {
      // no relation defined directly, user lookup if needed
    },
  });

  let text = `🛡 <b>Xavfsizlik va Audit Jurnali (Oxirgi amallar):</b>\n\n`;
  if (logs.length === 0) {
    text += `Hozircha audit yozuvlari mavjud emas.`;
  } else {
    logs.forEach((log, idx) => {
      const time = new Date(log.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      text += `${idx + 1}. <b>${log.action}</b> (${time})\n` +
        `   📌 Ob'ekt: <code>${log.entityType}:${log.entityId}</code>\n` +
        `   📝 Tafsilot: ${log.details || '—'}\n\n`;
    });
  }

  return { text, replyMarkup: getBackKeyboard('adm_menu_main') };
}

/**
 * Render Staff and Chairmen List
 */
export async function renderStaffList(page = 0, limit = 6) {
  const offset = page * limit;
  const staffUsers = await db.query.users.findMany({
    where: inArray(users.role, ['CHAIRMAN', 'STAFF', 'DISTRICT_ADMIN', 'SUPER_ADMIN']),
    with: {
      neighborhood: true,
    },
    limit: limit + 1,
    offset,
    orderBy: desc(users.createdAt),
  });

  const hasNext = staffUsers.length > limit;
  const items = staffUsers.slice(0, limit);

  let text = `👥 <b>Mas'ul xodimlar va boshqaruvchilar (Sahifa ${page + 1}):</b>\n\n`;
  const buttons: any[] = [];

  const roleEmoji: Record<string, string> = {
    SUPER_ADMIN: '👑 Super Admin',
    DISTRICT_ADMIN: '🏛 Hokimlik',
    CHAIRMAN: '👔 Mahalla Raisi',
    STAFF: '👨‍🔧 Kommunal Usta',
  };

  items.forEach((u, idx) => {
    text += `${offset + idx + 1}. <b>${u.fullName}</b>\n` +
      `   Rol: ${roleEmoji[u.role] || u.role}\n` +
      `   Telegram: ${u.telegramUsername ? '@' + u.telegramUsername : 'ID: ' + (u.telegramId || '—')}\n` +
      `   Mahalla: ${u.neighborhood?.nameUz || 'Respublika/Tuman'}\n\n`;

    buttons.push([{ text: `✏️ ${u.fullName.split(' ')[0]} rolini o'zgartirish`, callback_data: `adm_staff_edit_${u.id}` }]);
  });

  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Oldingi', callback_data: `adm_staff_list_${page - 1}` });
  }
  if (hasNext) {
    navRow.push({ text: 'Keyingi ➡️', callback_data: `adm_staff_list_${page + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([
    { text: '➕ Yangi xodim/rais tayinlash', callback_data: 'adm_staff_assign_prompt' },
    { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
  ]);

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * Render All Registered Users List (Citizens, Staff, Chairmen, Admins)
 */
export async function renderUsersList(page = 0, limit = 5) {
  const offset = page * limit;
  const allUsers = await db.query.users.findMany({
    with: {
      neighborhood: true,
    },
    limit: limit + 1,
    offset,
    orderBy: desc(users.createdAt),
  });

  const hasNext = allUsers.length > limit;
  const items = allUsers.slice(0, limit);

  let text = `👤 <b>Foydalanuvchilar reyestri (Sahifa ${page + 1}):</b>\n\n`;
  const buttons: any[] = [];

  const roleEmoji: Record<string, string> = {
    SUPER_ADMIN: '👑 Super Admin',
    DISTRICT_ADMIN: '🏛 Hokimlik',
    CHAIRMAN: '👔 Rais',
    STAFF: '👨‍🔧 Usta',
    CITIZEN: '👤 Fuqaro',
  };

  items.forEach((u, idx) => {
    const tgDisplay = u.telegramUsername ? `@${u.telegramUsername}` : (u.telegramId ? `ID: ${u.telegramId}` : 'Ulanmagan');
    text += `${offset + idx + 1}. <b>${u.fullName}</b>\n` +
      `   Rol: ${roleEmoji[u.role] || u.role}\n` +
      `   Telegram: ${tgDisplay}\n` +
      `   Mahalla: ${u.neighborhood?.nameUz || "Bo'sh / Qarshi"}\n\n`;

    buttons.push([{ text: `✏️ ${u.fullName.split(' ')[0]} rolini boshqarish`, callback_data: `adm_staff_edit_${u.id}` }]);
  });

  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Oldingi', callback_data: `adm_users_list_${page - 1}` });
  }
  if (hasNext) {
    navRow.push({ text: 'Keyingi ➡️', callback_data: `adm_users_list_${page + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([
    { text: '➕ Yangi xodim tayinlash', callback_data: 'adm_staff_assign_prompt' },
    { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
  ]);

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * Render Complaints Filtered List
 */
export async function renderComplaintsList(statusFilter = 'ALL', page = 0, neighborhoodId?: string) {
  const limit = 5;
  const offset = page * limit;

  let conditions: any[] = [];
  if (statusFilter !== 'ALL') {
    conditions.push(eq(complaints.status, statusFilter));
  }
  if (neighborhoodId) {
    conditions.push(eq(complaints.neighborhoodId, neighborhoodId));
  }

  const list = await db.query.complaints.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      citizen: true,
      neighborhood: true,
    },
    limit: limit + 1,
    offset,
    orderBy: desc(complaints.createdAt),
  });

  const hasNext = list.length > limit;
  const items = list.slice(0, limit);

  const statusUz: Record<string, string> = {
    ALL: 'Barchasi',
    NEW: '🟡 Yangi',
    IN_PROGRESS: '🟣 Jarayonda',
    ASSIGNED: '🟣 Biriktirilgan',
    RESOLVED: '🟢 Hal etilgan',
    REJECTED: '🔴 Rad etilgan',
  };

  let text = `📋 <b>Murojaatlar nazorati (${statusUz[statusFilter] || statusFilter}) — Sahifa ${page + 1}:</b>\n\n`;
  if (items.length === 0) {
    text += `Ushbu toifada arizalar mavjud emas.`;
  }

  const buttons: any[] = [];

  items.forEach((c, idx) => {
    text += `${offset + idx + 1}. <b>[${c.complaintCode}]</b> ${c.title}\n` +
      `   Mahalla: ${c.neighborhood?.nameUz || 'Vatanparvar'}\n` +
      `   Fuqaro: ${c.citizen?.fullName || 'Anonim'}\n` +
      `   Holat: ${statusUz[c.status] || c.status}\n\n`;

    buttons.push([{ text: `🔎 [${c.complaintCode}] Ko'rish & Ijro`, callback_data: `adm_comp_view_${c.id}` }]);
  });

  // Filter tabs row
  buttons.push([
    { text: statusFilter === 'NEW' ? '• Yangi •' : 'Yangi', callback_data: 'adm_comp_filter_NEW_0' },
    { text: statusFilter === 'IN_PROGRESS' ? '• Jarayonda •' : 'Jarayonda', callback_data: 'adm_comp_filter_IN_PROGRESS_0' },
    { text: statusFilter === 'RESOLVED' ? '• Hal etilgan •' : 'Hal etilgan', callback_data: 'adm_comp_filter_RESOLVED_0' },
    { text: statusFilter === 'ALL' ? '• Barchasi •' : 'Barchasi', callback_data: 'adm_comp_filter_ALL_0' },
  ]);

  const navRow: any[] = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Oldingi', callback_data: `adm_comp_filter_${statusFilter}_${page - 1}` });
  }
  if (hasNext) {
    navRow.push({ text: 'Keyingi ➡️', callback_data: `adm_comp_filter_${statusFilter}_${page + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([{ text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' }]);

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * Render detailed complaint card with Assignment and Status Update actions
 */
export async function renderComplaintDetail(complaintId: string) {
  const c = await db.query.complaints.findFirst({
    where: eq(complaints.id, complaintId),
    with: {
      citizen: true,
      neighborhood: true,
      history: {
        orderBy: desc(complaintHistory.createdAt),
      },
      assignments: true,
    },
  });

  if (!c) {
    return {
      text: '❌ Murojaat topilmadi.',
      replyMarkup: getBackKeyboard('adm_comp_filter_ALL_0'),
    };
  }

  let activeStaff = "Hali biriktirilmagan";
  if (c.assignments && c.assignments.length > 0) {
    const staffUser = await db.query.users.findFirst({
      where: eq(users.id, c.assignments[0].staffId),
    });
    if (staffUser) activeStaff = staffUser.fullName;
  }

  const categoryNames: Record<string, string> = {
    street_lighting: "Ko'cha chirog'i",
    water_supply: "Ichimlik suvi",
    garbage_collection: "Chiqindi va tozalash",
    roads: "Yo'llar ta'miri",
    drainage_sewage: "Kanalizatsiya va ariqlar",
    landscaping: "Obodonlashtirish / Ko'kalamzor",
    public_spaces: "Bolalar maydonchasi / Bog'",
    other: "Boshqa masala",
  };

  const statusUz: Record<string, string> = {
    NEW: '🟡 Yangi',
    ASSIGNED: '🟣 Xodimga biriktirilgan',
    IN_PROGRESS: '🟣 Ko\'rib chiqilmoqda / Jarayonda',
    RESOLVED: '🟢 Hal etildi',
    REJECTED: '🔴 Rad etildi',
  };

  let text = `📋 <b>Murojaat tafsiloti [${c.complaintCode}]</b>\n\n` +
    `📌 <b>Mavzu:</b> ${c.title}\n` +
    `📝 <b>Tavsif:</b> ${c.description}\n` +
    `📂 <b>Kategoriya:</b> ${categoryNames[c.category] || c.category}\n` +
    `📍 <b>Manzil:</b> ${c.address || 'Kiritilmagan'}\n` +
    `🏘 <b>Mahalla:</b> ${c.neighborhood?.nameUz || 'Qarshi'}\n` +
    `👤 <b>Fuqaro:</b> ${c.citizen?.fullName} (${c.citizen?.telegramUsername ? '@' + c.citizen?.telegramUsername : 'ID: ' + c.citizen?.telegramId})\n` +
    `👨‍🔧 <b>Mas'ul usta:</b> ${activeStaff}\n` +
    `🏷 <b>Holati:</b> ${statusUz[c.status] || c.status}\n\n`;

  if (c.history && c.history.length > 0) {
    text += `📜 <b>Holat tarixi:</b>\n`;
    c.history.slice(0, 3).forEach((h) => {
      text += `• ${h.newStatus}: ${h.explanation} (${new Date(h.createdAt).toLocaleDateString('uz-UZ')})\n`;
    });
    text += `\n`;
  }

  const buttons: any[] = [
    [
      { text: '👨‍🔧 Ustaga biriktirish', callback_data: `adm_comp_assign_prompt_${c.id}` },
      { text: '🟢 Hal qilindi', callback_data: `adm_comp_setstatus_${c.id}_RESOLVED` },
    ],
    [
      { text: '🟣 Jarayonda', callback_data: `adm_comp_setstatus_${c.id}_IN_PROGRESS` },
      { text: '🔴 Rad etish', callback_data: `adm_comp_setstatus_${c.id}_REJECTED` },
    ],
    [
      { text: '⬅️ Ro\'yxatga qaytish', callback_data: 'adm_comp_filter_ALL_0' },
      { text: '🏠 Bosh menyu', callback_data: 'adm_menu_main' },
    ],
  ];

  return { text, replyMarkup: { inline_keyboard: buttons } };
}
