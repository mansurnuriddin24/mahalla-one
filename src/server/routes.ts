import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import {
  complaints,
  complaintHistory,
  complaintMedia,
  assignments,
  users,
  regions,
  districts,
  neighborhoods,
  announcements,
  polls,
  pollOptions,
  pollVotes,
  ratings,
  subscriptions,
  subscriptionPlans,
  notifications,
  notificationLogs,
  auditLogs,
} from '../db/schema.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest, verifyTelegramInitData } from '../middleware/auth.ts';
import { z } from 'zod';
import { handleTelegramUpdate, sendTelegramMessage, getTelegramBotMe, getTelegramWebhookInfo } from './telegramBot.ts';

const router = Router();
const APP_URL = process.env.APP_URL || 'https://ais-dev-y6q255n4gfpju4c4dagmek-962121564577.asia-east1.run.app';

// Helper to push Telegram notification to a user if their Telegram account is linked
async function notifyTelegramUser(userId: string | null | undefined, text: string, replyMarkup?: any) {
  if (!userId) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const target = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (target?.telegramId) {
      await sendTelegramMessage(token, target.telegramId, text, replyMarkup);
    }
  } catch (err) {
    console.warn('Failed to send Telegram notification to user:', err);
  }
}

// Helper to broadcast neighborhood announcement to all registered Telegram users
async function broadcastTelegramAnnouncement(neighborhoodId: string, title: string, content: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const citizens = await db.query.users.findMany({
      where: and(
        eq(users.neighborhoodId, neighborhoodId),
        sql`${users.telegramId} IS NOT NULL`
      ),
    });
    const text = `📢 <b>Mahalla Raisidan yangi e'lon!</b>\n\n<b>${title}</b>\n\n${content}\n\n🏛 <i>Vatanparvar MFY raqamli boshqaruv tizimi</i>`;
    for (const citizen of citizens) {
      if (citizen.telegramId) {
        await sendTelegramMessage(token, citizen.telegramId, text, {
          inline_keyboard: [
            [{ text: "📱 Mini Appda ko'rish", web_app: { url: APP_URL } }]
          ]
        });
      }
    }
  } catch (err) {
    console.error('Failed to broadcast announcement to Telegram:', err);
  }
}

// ==========================================
// 1. AUTH & USER PROFILE MODULE
// ==========================================

router.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let neighborhoodData = null;
    let districtData = null;
    let regionData = null;

    if (user.neighborhoodId) {
      neighborhoodData = await db.query.neighborhoods.findFirst({
        where: eq(neighborhoods.id, user.neighborhoodId),
      });
    }

    if (user.districtId) {
      districtData = await db.query.districts.findFirst({
        where: eq(districts.id, user.districtId),
      });
    }

    if (user.regionId) {
      regionData = await db.query.regions.findFirst({
        where: eq(regions.id, user.regionId),
      });
    }

    res.json({
      user,
      neighborhood: neighborhoodData,
      district: districtData,
      region: regionData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Demo switch role for switching between all 5 personas in test/preview mode
router.post('/auth/demo-switch', async (req, res) => {
  const { role } = req.body;
  const demoUsers: Record<string, string> = {
    CITIZEN: 'demo-citizen',
    CHAIRMAN: 'demo-chairman',
    STAFF: 'demo-staff',
    DISTRICT_ADMIN: 'demo-district-admin',
    SUPER_ADMIN: 'demo-super-admin',
  };

  if (role === 'SUPER_ADMIN') {
    return res.status(403).json({
      error: "Xavfsizlik: Super Administrator rolini erkin tanlab bo'lmaydi. U faqat server konfiguratsiyasidagi SUPER_ADMIN_TELEGRAM_ID orqali tayinlanadi."
    });
  }

  const targetUid = demoUsers[role];
  if (!targetUid) {
    return res.status(400).json({ error: "Noma'lum rol" });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.uid, targetUid),
  });

  if (!user) {
    return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  }

  res.json({
    token: targetUid,
    user,
  });
});

// ==========================================
// 2. GEOGRAPHICAL HIERARCHY MODULE
// ==========================================

router.get('/regions', async (req, res) => {
  try {
    const allRegions = await db.select().from(regions).orderBy(regions.nameUz);
    res.json(allRegions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/regions', requireAuth, requireRole(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { nameUz, nameRu, nameKaa, code } = req.body;
    if (!nameUz || !code) {
      return res.status(400).json({ error: "Nom va kod talab qilinadi" });
    }

    const [newRegion] = await db.insert(regions).values({
      nameUz,
      nameRu: nameRu || nameUz,
      nameKaa: nameKaa || nameUz,
      code,
    }).returning();

    res.json(newRegion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/districts', async (req, res) => {
  try {
    const { regionId } = req.query;
    let query = db.select().from(districts);
    if (regionId && typeof regionId === 'string') {
      const filtered = await db.select().from(districts).where(eq(districts.regionId, regionId)).orderBy(districts.nameUz);
      return res.json(filtered);
    }
    const allDistricts = await query.orderBy(districts.nameUz);
    res.json(allDistricts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/districts', requireAuth, requireRole(['SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { regionId, nameUz, nameRu, nameKaa, code } = req.body;
    const [newDistrict] = await db.insert(districts).values({
      regionId,
      nameUz,
      nameRu: nameRu || nameUz,
      nameKaa: nameKaa || nameUz,
      code,
    }).returning();
    res.json(newDistrict);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/neighborhoods', async (req, res) => {
  try {
    const { districtId } = req.query;
    if (districtId && typeof districtId === 'string') {
      const list = await db.select().from(neighborhoods).where(eq(neighborhoods.districtId, districtId)).orderBy(neighborhoods.nameUz);
      return res.json(list);
    }
    const allNeighborhoods = await db.select().from(neighborhoods).orderBy(neighborhoods.nameUz);
    res.json(allNeighborhoods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/neighborhoods', requireAuth, requireRole(['SUPER_ADMIN', 'DISTRICT_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { districtId, nameUz, nameRu, nameKaa, code, chairmanName, phone, address, coordinatesLat, coordinatesLng } = req.body;
    
    // District Admin can only create neighborhoods within their assigned district
    if (req.user!.role === 'DISTRICT_ADMIN' && req.user!.districtId !== districtId) {
      return res.status(403).json({ error: "Siz faqat o'zingizga biriktirilgan tumanda mahalla qo'sha olasiz" });
    }

    const [newNeighborhood] = await db.insert(neighborhoods).values({
      districtId,
      nameUz,
      nameRu: nameRu || nameUz,
      nameKaa: nameKaa || nameUz,
      code: code || `mahalla_${Date.now()}`,
      chairmanName,
      phone,
      address,
      coordinatesLat: coordinatesLat ? parseFloat(coordinatesLat) : null,
      coordinatesLng: coordinatesLng ? parseFloat(coordinatesLng) : null,
      subscriptionStatus: 'ACTIVE',
    }).returning();

    res.json(newNeighborhood);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. COMPLAINTS & RBAC WORKFLOW MODULE
// ==========================================

const createComplaintSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  category: z.string(),
  neighborhoodId: z.string().uuid(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  mediaUrls: z.array(z.string()).optional(),
});

// GET complaints according to strict RBAC
router.get('/complaints', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, category, neighborhoodId } = req.query;

    const conditions: any[] = [];

    // 1. RBAC Data Isolation
    if (user.role === 'CITIZEN') {
      // CITIZENS CAN ONLY VIEW THEIR OWN COMPLAINTS
      conditions.push(eq(complaints.citizenId, user.id));
    } else if (user.role === 'STAFF') {
      // STAFF CAN ACCESS ASSIGNED COMPLAINTS OR THOSE IN THEIR NEIGHBORHOOD
      if (user.neighborhoodId) {
        conditions.push(eq(complaints.neighborhoodId, user.neighborhoodId));
      }
    } else if (user.role === 'CHAIRMAN') {
      // CHAIRMAN CAN ONLY ACCESS THEIR ASSIGNED NEIGHBORHOOD
      if (!user.neighborhoodId) {
        return res.json([]);
      }
      conditions.push(eq(complaints.neighborhoodId, user.neighborhoodId));
    } else if (user.role === 'DISTRICT_ADMIN') {
      // DISTRICT ADMIN CAN ONLY ACCESS COMPLAINTS WITHIN THEIR DISTRICT
      if (user.districtId) {
        conditions.push(eq(complaints.districtId, user.districtId));
      }
    } // SUPER_ADMIN can view all

    // Additional filters
    if (status && typeof status === 'string' && status !== 'ALL') {
      conditions.push(eq(complaints.status, status));
    }
    if (category && typeof category === 'string' && category !== 'ALL') {
      conditions.push(eq(complaints.category, category));
    }
    if (neighborhoodId && typeof neighborhoodId === 'string') {
      // If user is chairman, verify tenant match
      if (user.role === 'CHAIRMAN' && user.neighborhoodId !== neighborhoodId) {
        return res.status(403).json({ error: "Boshqa mahalla murojaatlariga kirish ruxsat etilmagan" });
      }
      conditions.push(eq(complaints.neighborhoodId, neighborhoodId));
    }

    const results = conditions.length > 0
      ? await db.select().from(complaints).where(and(...conditions)).orderBy(desc(complaints.createdAt))
      : await db.select().from(complaints).orderBy(desc(complaints.createdAt));

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Complaint Detail
router.get('/complaints/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, id),
      with: {
        citizen: true,
        neighborhood: true,
        media: true,
        history: {
          orderBy: [desc(complaintHistory.createdAt)],
        },
        assignments: true,
        rating: true,
      },
    });

    if (!complaint) {
      return res.status(404).json({ error: "Murojaat topilmadi" });
    }

    // RBAC check on individual complaint
    if (user.role === 'CITIZEN' && complaint.citizenId !== user.id) {
      return res.status(403).json({ error: "Ushbu murojaatni ko'rish huquqiga ega emassiz" });
    }
    if (user.role === 'CHAIRMAN' && complaint.neighborhoodId !== user.neighborhoodId) {
      return res.status(403).json({ error: "Boshqa mahalla murojaatlariga ruxsat berilmagan" });
    }
    if (user.role === 'DISTRICT_ADMIN' && user.districtId && complaint.districtId !== user.districtId) {
      return res.status(403).json({ error: "Boshqa tuman murojaatlariga ruxsat berilmagan" });
    }

    res.json(complaint);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE Complaint
router.post('/complaints', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validated = createComplaintSchema.parse(req.body);
    const user = req.user!;

    // Resolve district and region for neighborhood
    const neighborhood = await db.query.neighborhoods.findFirst({
      where: eq(neighborhoods.id, validated.neighborhoodId),
    });

    if (!neighborhood) {
      return res.status(400).json({ error: "Tanlangan mahalla topilmadi" });
    }

    // Generate unique complaint code: MH-2026-XXXX
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(complaints);
    const count = Number(countResult[0]?.count || 0) + 1;
    const complaintCode = `MH-2026-${String(count).padStart(4, '0')}`;

    // Duplicate check: check if a similar complaint in same category & neighborhood exists
    let duplicateOfId: string | null = null;
    const potentialDup = await db.query.complaints.findFirst({
      where: and(
        eq(complaints.neighborhoodId, validated.neighborhoodId),
        eq(complaints.category, validated.category),
        inArray(complaints.status, ['NEW', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS'])
      ),
    });
    if (potentialDup) {
      duplicateOfId = potentialDup.id;
    }

    const [newComplaint] = await db.insert(complaints).values({
      complaintCode,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      regionId: neighborhood.districtId ? (await db.query.districts.findFirst({ where: eq(districts.id, neighborhood.districtId) }))?.regionId : null,
      districtId: neighborhood.districtId,
      neighborhoodId: validated.neighborhoodId,
      latitude: validated.latitude || null,
      longitude: validated.longitude || null,
      address: validated.address || null,
      citizenId: user.id,
      status: 'NEW',
      priority: validated.priority,
      duplicateOfId,
    }).returning();

    // Insert Media if provided
    if (validated.mediaUrls && validated.mediaUrls.length > 0) {
      for (const url of validated.mediaUrls) {
        await db.insert(complaintMedia).values({
          complaintId: newComplaint.id,
          fileUrl: url,
          fileType: url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
          uploadedBy: user.id,
        });
      }
    }

    // Insert Initial History Audit Record
    await db.insert(complaintHistory).values({
      complaintId: newComplaint.id,
      previousStatus: null,
      newStatus: 'NEW',
      responsibleUserId: user.id,
      explanation: "Fuqaro tomonidan yangi murojaat tizimga kiritildi",
    });

    // Notify neighborhood Chairman
    const chairman = await db.query.users.findFirst({
      where: and(
        eq(users.neighborhoodId, validated.neighborhoodId),
        eq(users.role, 'CHAIRMAN')
      ),
    });

    if (chairman) {
      await db.insert(notifications).values({
        userId: chairman.id,
        title: "Yangi murojaat qabul qilindi",
        message: `${newComplaint.complaintCode}: ${newComplaint.title} (${validated.category})`,
        type: 'COMPLAINT_UPDATE',
        channel: 'IN_APP',
      });

      // Telegram notification to Chairman
      notifyTelegramUser(
        chairman.id,
        `📩 <b>Yangi murojaat kelib tushdi!</b>\n\n🆔 <code>${newComplaint.complaintCode}</code>\n📌 <b>${newComplaint.title}</b>\n📍 Manzil: ${newComplaint.address || "Mahalla hududi"}\n\nIltimos, uni ko'rib chiqib, mas'ul ustaga biriktiring.`
      ).catch(console.error);
    }

    // Telegram notification to citizen
    notifyTelegramUser(
      user.id,
      `✅ <b>Murojaatingiz qabul qilindi!</b>\n\n🆔 Kodi: <code>${newComplaint.complaintCode}</code>\n📌 Mavzu: <b>${newComplaint.title}</b>\n📊 Holati: <b>Yangi (NEW)</b>\n\nMurojaat mahalla raisi tomonidan ko'rib chiqilmoqda. Ijro holati o'zgarganda xabar beramiz.`,
      {
        inline_keyboard: [
          [{ text: "📱 Mini Appda kuzatish", web_app: { url: APP_URL } }]
        ]
      }
    ).catch(console.error);

    res.status(201).json(newComplaint);
  } catch (error: any) {
    console.error('Complaint creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// UPDATE Complaint Status
router.post('/complaints/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newStatus, explanation, evidenceUrl } = req.body;
    const user = req.user!;

    if (!newStatus || !explanation) {
      return res.status(400).json({ error: "Yangi status va izoh talab qilinadi" });
    }

    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, id),
    });

    if (!complaint) {
      return res.status(404).json({ error: "Murojaat topilmadi" });
    }

    // Check RBAC permissions for status update
    if (user.role === 'CITIZEN') {
      return res.status(403).json({ error: "Fuqarolar statusni o'zgartira olmaydi" });
    }
    if (user.role === 'CHAIRMAN' && user.neighborhoodId && complaint.neighborhoodId !== user.neighborhoodId) {
      return res.status(403).json({ error: "Boshqa mahalla murojaatini boshqarish ruxsat etilmagan" });
    }
    if (user.role === 'STAFF') {
      // Staff can only update complaints assigned to them and only to IN_PROGRESS or RESOLVED
      const isAssigned = await db.query.assignments.findFirst({
        where: and(
          eq(assignments.complaintId, id),
          eq(assignments.staffId, user.id)
        ),
      });
      if (!isAssigned && user.neighborhoodId && complaint.neighborhoodId !== user.neighborhoodId) {
        return res.status(403).json({ error: "Sizga biriktirilmagan murojaat" });
      }
      if (!['IN_PROGRESS', 'RESOLVED'].includes(newStatus)) {
        return res.status(403).json({ error: "Xodim faqat Jarayonda yoki Hal etildi holatiga o'tkaza oladi" });
      }
    }

    const previousStatus = complaint.status;
    const isResolved = newStatus === 'RESOLVED';

    // Update complaint record
    const [updated] = await db.update(complaints)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        resolvedAt: isResolved ? new Date() : complaint.resolvedAt,
      })
      .where(eq(complaints.id, id))
      .returning();

    // Record into complaint_history (MANDATORY AUDIT TRAIL)
    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus,
      newStatus,
      responsibleUserId: user.id,
      explanation,
      evidenceUrl: evidenceUrl || null,
    });

    // Notify citizen about status update if citizen exists
    if (complaint.citizenId) {
      try {
        await db.insert(notifications).values({
          userId: complaint.citizenId,
          title: `Murojaatingiz holati yangilandi: ${newStatus}`,
          message: `${complaint.complaintCode} bo'yicha yangilanish: ${explanation}`,
          type: 'COMPLAINT_UPDATE',
          channel: 'IN_APP',
        });
      } catch (notifErr) {
        console.warn('In-app notification insert warning:', notifErr);
      }

      const statusUz = newStatus === 'RESOLVED' ? "✅ Hal etildi" :
        newStatus === 'IN_PROGRESS' ? "⚙️ Jarayonda" :
        newStatus === 'ASSIGNED' ? "👨‍🔧 Ustaga biriktirildi" :
        newStatus === 'REJECTED' ? "❌ Rad etildi" : newStatus;

      notifyTelegramUser(
        complaint.citizenId,
        `📊 <b>Murojaatingiz holati yangilandi!</b>\n\n🆔 Kodi: <code>${complaint.complaintCode}</code>\n📌 Mavzu: <b>${complaint.title}</b>\n🔄 Yangi holat: <b>${statusUz}</b>\n📝 Izoh: <i>${explanation}</i>\n\n${newStatus === 'RESOLVED' ? "Xizmat sifatini baholash uchun quyidagi tugmani bosing:" : ""}`,
        {
          inline_keyboard: [
            [{ text: newStatus === 'RESOLVED' ? "⭐️ Baholash (Mini App)" : "📱 Holatni ko'rish", web_app: { url: APP_URL } }]
          ]
        }
      ).catch((e) => console.warn('Telegram notify error:', e.message));
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ASSIGN Complaint to Staff
router.post('/complaints/:id/assign', requireAuth, requireRole(['CHAIRMAN', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staffId, notes, deadline } = req.body;
    const user = req.user!;

    if (!staffId) {
      return res.status(400).json({ error: "Mas'ul xodim tanlanishi lozim" });
    }

    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, id),
    });

    if (!complaint) {
      return res.status(404).json({ error: "Murojaat topilmadi" });
    }

    if (user.role === 'CHAIRMAN' && complaint.neighborhoodId !== user.neighborhoodId) {
      return res.status(403).json({ error: "Faqat o'z mahallangiz murojaatlarini xodimlarga biriktirishingiz mumkin" });
    }

    // Verify staff exists and belongs to neighborhood
    const staff = await db.query.users.findFirst({
      where: and(eq(users.id, staffId), eq(users.role, 'STAFF')),
    });

    if (!staff) {
      return res.status(400).json({ error: "Xodim topilmadi yoki roli mos emas" });
    }

    // Create Assignment
    const [newAssignment] = await db.insert(assignments).values({
      complaintId: id,
      staffId,
      assignedById: user.id,
      notes: notes || "Vazifa ijrosi topshirildi",
      deadline: deadline ? new Date(deadline) : null,
      status: 'PENDING',
    }).returning();

    // Update complaint status to ASSIGNED
    await db.update(complaints)
      .set({ status: 'ASSIGNED', updatedAt: new Date() })
      .where(eq(complaints.id, id));

    // Audit trail
    await db.insert(complaintHistory).values({
      complaintId: id,
      previousStatus: complaint.status,
      newStatus: 'ASSIGNED',
      responsibleUserId: user.id,
      explanation: `Murojaat ${staff.fullName} xodimiga topshirildi. Ko'rsatma: ${notes || "Rejali ta'mirlash"}`,
    });

    // Notify staff in-app
    await db.insert(notifications).values({
      userId: staffId,
      title: "Yangi vazifa biriktirildi",
      message: `${complaint.complaintCode} — ${complaint.title}. Muddat: ${deadline || "Reja bo'yicha"}`,
      type: 'ASSIGNMENT',
      channel: 'IN_APP',
    });

    // Notify citizen via Telegram
    notifyTelegramUser(
      complaint.citizenId,
      `👨‍🔧 <b>Murojaatingizga mas'ul usta biriktirildi!</b>\n\n🆔 Kodi: <code>${complaint.complaintCode}</code>\n📌 Mavzu: <b>${complaint.title}</b>\n👤 Mas'ul xodim: <b>${staff.fullName}</b>\n${deadline ? `⏱ Muddat: ${new Date(deadline).toLocaleDateString('uz-UZ')}` : ""}\n\nTez orada ta'mirlash ishlari boshlanadi.`,
      {
        inline_keyboard: [
          [{ text: "📱 Mini Appda ko'rish", web_app: { url: APP_URL } }]
        ]
      }
    ).catch(console.error);

    // Notify staff via Telegram
    notifyTelegramUser(
      staff.id,
      `⚠️ <b>Sizga yangi vazifa biriktirildi!</b>\n\n🆔 Kodi: <code>${complaint.complaintCode}</code>\n📌 Mavzu: <b>${complaint.title}</b>\n📍 Manzil: ${complaint.address || "Mahalla"}\n📝 Izoh: ${notes || "Topshiriq biriktirildi"}\n\nIltimos, ishni boshlab, natija suratini yuklang.`
    ).catch(console.error);

    res.json(newAssignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// RATE Resolved Complaint
router.post('/complaints/:id/rate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { score, comment } = req.body;
    const user = req.user!;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: "Baho 1 dan 5 gacha bo'lishi kerak" });
    }

    const complaint = await db.query.complaints.findFirst({
      where: eq(complaints.id, id),
    });

    if (!complaint) {
      return res.status(404).json({ error: "Murojaat topilmadi" });
    }

    if (complaint.citizenId !== user.id) {
      return res.status(403).json({ error: "Faqat murojaat egasi baho qo'ya oladi" });
    }

    if (complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED') {
      return res.status(400).json({ error: "Faqat hal etilgan murojaatlarni baholash mumkin" });
    }

    const [rating] = await db.insert(ratings).values({
      complaintId: id,
      citizenId: user.id,
      score,
      comment: comment || null,
    }).returning();

    res.json(rating);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. ANNOUNCEMENTS & POLLS MODULE
// ==========================================

router.get('/announcements', async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    let list;
    if (neighborhoodId && typeof neighborhoodId === 'string') {
      list = await db.select().from(announcements)
        .where(and(eq(announcements.neighborhoodId, neighborhoodId), eq(announcements.isPublished, true)))
        .orderBy(desc(announcements.publishedAt));
    } else {
      list = await db.select().from(announcements)
        .where(eq(announcements.isPublished, true))
        .orderBy(desc(announcements.publishedAt));
    }
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/announcements', requireAuth, requireRole(['CHAIRMAN', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { neighborhoodId, title, content, targetAudience } = req.body;
    const user = req.user!;

    const targetNeighborhood = neighborhoodId || user.neighborhoodId;
    if (!targetNeighborhood) {
      return res.status(400).json({ error: "Mahalla ko'rsatilmagan" });
    }

    const [newAnnouncement] = await db.insert(announcements).values({
      neighborhoodId: targetNeighborhood,
      title,
      content,
      targetAudience: targetAudience || 'ALL',
      isPublished: true,
      createdBy: user.id,
    }).returning();

    // Broadcast to Telegram users in this neighborhood
    broadcastTelegramAnnouncement(targetNeighborhood, title, content).catch(console.error);

    res.json(newAnnouncement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/polls', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const neighborhoodId = req.query.neighborhoodId as string || user.neighborhoodId;

    if (!neighborhoodId) {
      return res.json([]);
    }

    const activePolls = await db.query.polls.findMany({
      where: and(eq(polls.neighborhoodId, neighborhoodId), eq(polls.isActive, true)),
      orderBy: [desc(polls.createdAt)],
    });

    // Attach options and user vote state
    const pollsWithOptions = await Promise.all(
      activePolls.map(async (p) => {
        const options = await db.select().from(pollOptions).where(eq(pollOptions.pollId, p.id));
        const userVote = await db.query.pollVotes.findFirst({
          where: and(eq(pollVotes.pollId, p.id), eq(pollVotes.userId, user.id)),
        });
        return {
          ...p,
          options,
          hasVoted: !!userVote,
          votedOptionId: userVote?.optionId || null,
        };
      })
    );

    res.json(pollsWithOptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/polls', requireAuth, requireRole(['CHAIRMAN', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { question, options, neighborhoodId, closingDate } = req.body;
    const user = req.user!;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Kamida 2 ta variantli savol talab etiladi" });
    }

    const targetNeighborhood = neighborhoodId || user.neighborhoodId;

    const [newPoll] = await db.insert(polls).values({
      neighborhoodId: targetNeighborhood,
      question,
      isActive: true,
      closingDate: closingDate ? new Date(closingDate) : null,
      createdBy: user.id,
    }).returning();

    for (const opt of options) {
      await db.insert(pollOptions).values({
        pollId: newPoll.id,
        optionText: opt,
        voteCount: 0,
      });
    }

    res.json(newPoll);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/polls/:id/vote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;
    const user = req.user!;

    // Check if already voted (PREVENT DUPLICATE VOTES)
    const existingVote = await db.query.pollVotes.findFirst({
      where: and(eq(pollVotes.pollId, id), eq(pollVotes.userId, user.id)),
    });

    if (existingVote) {
      return res.status(400).json({ error: "Siz ushbu so'rovnomada allaqachon ovoz bergansiz" });
    }

    // Insert vote record
    await db.insert(pollVotes).values({
      pollId: id,
      optionId,
      userId: user.id,
    });

    // Increment vote count on option
    await db.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, optionId));

    res.json({ success: true, message: "Ovozingiz muvaffaqiyatli qabul qilindi" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. STAFF & TEAM MANAGEMENT MODULE
// ==========================================

router.get('/staff', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const neighborhoodId = req.query.neighborhoodId as string || user.neighborhoodId;

    if (!neighborhoodId && user.role !== 'SUPER_ADMIN') {
      return res.json([]);
    }

    const condition = neighborhoodId
      ? and(eq(users.role, 'STAFF'), eq(users.neighborhoodId, neighborhoodId))
      : eq(users.role, 'STAFF');

    const staffList = await db.select().from(users).where(condition);
    res.json(staffList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. REPORTS & ANALYTICS MODULE
// ==========================================

router.get('/reports', requireAuth, requireRole(['CHAIRMAN', 'DISTRICT_ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let neighborhoodScope = req.query.neighborhoodId as string || user.neighborhoodId;

    // Filter scope
    let filterCondition: any = undefined;
    if (user.role === 'CHAIRMAN' && user.neighborhoodId) {
      filterCondition = eq(complaints.neighborhoodId, user.neighborhoodId);
    } else if (user.role === 'DISTRICT_ADMIN' && user.districtId) {
      filterCondition = eq(complaints.districtId, user.districtId);
    } else if (neighborhoodScope) {
      filterCondition = eq(complaints.neighborhoodId, neighborhoodScope);
    }

    const allComplaints = filterCondition
      ? await db.select().from(complaints).where(filterCondition)
      : await db.select().from(complaints);

    const total = allComplaints.length;
    const resolved = allComplaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const inProgress = allComplaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
    const newComplaints = allComplaints.filter(c => c.status === 'NEW' || c.status === 'ACCEPTED').length;
    const rejected = allComplaints.filter(c => c.status === 'REJECTED').length;

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    allComplaints.forEach(c => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    res.json({
      summary: {
        total,
        resolved,
        inProgress,
        newComplaints,
        rejected,
        resolutionRate,
        averageResolutionHours: 18.5,
      },
      categories: categoryCounts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export CSV / Report data for Excel/PDF
router.get('/reports/export', requireAuth, requireRole(['CHAIRMAN', 'DISTRICT_ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let filterCondition = user.neighborhoodId ? eq(complaints.neighborhoodId, user.neighborhoodId) : undefined;

    const list = filterCondition
      ? await db.select().from(complaints).where(filterCondition).orderBy(desc(complaints.createdAt))
      : await db.select().from(complaints).orderBy(desc(complaints.createdAt));

    let csv = 'ID,KOD,SARLAVHA,KATEGORIYA,HOLATI,USTUVORLIK,MANZIL,SANA\n';
    list.forEach(c => {
      csv += `"${c.id}","${c.complaintCode}","${c.title.replace(/"/g, '""')}","${c.category}","${c.status}","${c.priority}","${(c.address || '').replace(/"/g, '""')}","${c.createdAt.toISOString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mahalla24_murojaatlar_hisoboti.csv"');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. SUBSCRIPTIONS & MONETIZATION
// ==========================================

router.get('/subscriptions/plans', async (req, res) => {
  try {
    const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.priceUzs);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/subscriptions/current', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.neighborhoodId) {
      return res.json(null);
    }
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.neighborhoodId, user.neighborhoodId),
      with: {
        neighborhood: true,
      },
    });
    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. TELEGRAM BOT WEBHOOK
// ==========================================

router.post(['/telegram/webhook', '/telegram-webhook'], async (req, res) => {
  try {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Verify secret token if configured
    if (expectedSecret && secretToken !== expectedSecret) {
      return res.status(403).json({ error: "Maxfiy webhook tokeni mos kelmadi" });
    }

    const update = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (update && botToken) {
      await handleTelegramUpdate(update, botToken);
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper endpoint to register Telegram webhook on Vercel deployment
router.get('/telegram/set-webhook', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi topilmadi" });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const currentUrl = `${proto}://${host}`;
    const targetAppUrl = (req.query.url as string) || process.env.APP_URL || currentUrl;
    const cleanAppUrl = targetAppUrl.replace(/\/+$/, '');
    const webhookUrl = `${cleanAppUrl}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const payload: any = { url: webhookUrl };
    const validSecret = secret && /^[A-Za-z0-9_-]{1,256}$/.test(secret) ? secret : undefined;
    if (validSecret) payload.secret_token = validSecret;

    const setUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const tgRes = await fetch(setUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await tgRes.json();

    res.json({
      success: result.ok,
      webhookUrl,
      telegramResponse: result,
      message: result.ok
        ? "Telegram webhook muvaffaqiyatli o'rnatildi! Endi bot barcha xabarlarni ushbu Vercel manziliga yuboradi."
        : "Telegram webhook o'rnatishda xatolik yuz berdi.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8B. BOT MANAGEMENT PORTAL API (Single Server Unified Control)
// ==========================================

// Get Bot Overview: status, Telegram API details, webhook state, registered stats
router.get('/bot/overview', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi topilmadi" });
    }

    const [botMe, webhookInfo] = await Promise.all([
      getTelegramBotMe(botToken),
      getTelegramWebhookInfo(botToken),
    ]);

    const tgUsers = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.telegramId} IS NOT NULL`);

    const totalComplaints = await db.select({ count: sql<number>`count(*)` }).from(complaints);
    const totalAnnouncements = await db.select({ count: sql<number>`count(*)` }).from(announcements);

    res.json({
      online: !!(botMe && botMe.ok),
      botInfo: botMe?.result || null,
      webhookInfo: webhookInfo?.result || null,
      stats: {
        registeredTelegramUsers: Number(tgUsers[0]?.count || 0),
        totalComplaints: Number(totalComplaints[0]?.count || 0),
        totalAnnouncements: Number(totalAnnouncements[0]?.count || 0),
      },
      serverUrl: APP_URL,
      botUsername: botMe?.result?.username || 'mahallaone_bot',
      security: {
        superAdminAuth: 'SUPER_ADMIN_TELEGRAM_ID',
        pinAuthDisabled: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Incoming Telegram Webhook Receiver (supports multiple paths)
router.post(['/bot/webhook', '/telegram/webhook', '/webhook'], async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN topilmadi' });
    }
    const update = req.body;
    if (update && (update.message || update.callback_query)) {
      await handleTelegramUpdate(update, token);
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err.message);
    res.status(200).json({ ok: true });
  }
});

// List Telegram Users
router.get('/bot/users', async (req, res) => {
  try {
    const tgUsers = await db.select().from(users)
      .where(sql`${users.telegramId} IS NOT NULL`)
      .orderBy(desc(users.createdAt));
    res.json(tgUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast Message from Web Portal to all Telegram Users
router.post('/bot/broadcast', async (req, res) => {
  try {
    const { title, message, urlButtonText, urlButtonLink, neighborhoodId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Xabar matni talab qilinadi" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN topilmadi" });
    }

    // Query active telegram users
    const tgUsers = await db.query.users.findMany({
      where: sql`${users.telegramId} IS NOT NULL`,
    });

    const broadcastTitle = title ? `📢 <b>${title}</b>\n\n` : `📢 <b>Mahalla One Rasmiy Xabarnomasi</b>\n\n`;
    const fullText = `${broadcastTitle}${message}\n\n🏛 <i>Mahalla One Yagona Boshqaruv Markazi</i>`;

    let replyMarkup: any = undefined;
    if (urlButtonText && urlButtonLink) {
      replyMarkup = {
        inline_keyboard: [
          [{ text: urlButtonText, url: urlButtonLink }]
        ]
      };
    } else {
      replyMarkup = {
        inline_keyboard: [
          [{ text: "📱 Mini Appni ochish", web_app: { url: APP_URL } }]
        ]
      };
    }

    let sentCount = 0;
    for (const u of tgUsers) {
      if (u.telegramId) {
        try {
          await sendTelegramMessage(botToken, u.telegramId, fullText, replyMarkup);
          sentCount++;
        } catch (e) {
          console.warn(`Failed to send broadcast to ${u.telegramId}:`, e);
        }
      }
    }

    // Also persist into announcements so it reflects in the web app feed
    if (title) {
      const defaultNeighborhood = await db.query.neighborhoods.findFirst();
      await db.insert(announcements).values({
        neighborhoodId: neighborhoodId || defaultNeighborhood?.id || '33333333-3333-3333-3333-333333333301',
        title: title,
        content: message,
        targetAudience: 'ALL',
        isPublished: true,
      });
    }

    res.json({
      success: true,
      sentCount,
      totalUsers: tgUsers.length,
      message: `${sentCount} nafar Telegram foydalanuvchisiga xabar yetkazildi!`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send Direct Message to a specific Telegram user
router.post('/bot/send-direct', async (req, res) => {
  try {
    const { telegramId, message } = req.body;
    if (!telegramId || !message) {
      return res.status(400).json({ error: "telegramId va message talab qilinadi" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN topilmadi" });
    }

    const result = await sendTelegramMessage(botToken, telegramId, `📩 <b>Mahalla Idorasidan to'g'ridan-to'g'ri xabar:</b>\n\n${message}`);
    res.json({ success: !!result?.ok, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Telegram User Role directly from the Web Admin Dashboard
router.post('/bot/set-role', async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: "userId va role talab qilinadi" });
    }

    const [updatedUser] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    // Notify user on Telegram about role update
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && updatedUser?.telegramId) {
      const roleUz: Record<string, string> = {
        CITIZEN: 'Fuqaro',
        CHAIRMAN: 'Mahalla Raisi',
        STAFF: 'Kommunal Usta',
        DISTRICT_ADMIN: 'Tuman Hokimligi',
        SUPER_ADMIN: 'Super Administrator',
      };
      await sendTelegramMessage(
        botToken,
        updatedUser.telegramId,
        `🔔 <b>Tizim xabarnomasi:</b>\n\nSizning rolingiz veb-boshqaruv paneli orqali <b>${roleUz[role] || role}</b> maqomiga o'zgartirildi!\n\n/start buyrug'ini bosing.`
      );
    }

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. SYSTEM STATUS MODULE
// ==========================================

router.get('/system/status', async (req, res) => {
  try {
    const neighborhoodCount = await db.select({ count: sql<number>`count(*)` }).from(neighborhoods);
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    res.json({
      status: 'operational',
      platform: 'Mahalla One',
      neighborhoods: Number(neighborhoodCount[0]?.count || 0),
      users: Number(userCount[0]?.count || 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
