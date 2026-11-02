import React, { useState, useEffect } from 'react';
import { User, UserRole, Complaint, Neighborhood, District, Region, Announcement, Poll, SubscriptionPlan, ReportSummary } from './types/index.ts';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { PublicWebsite } from './components/PublicWebsite.tsx';
import { TelegramMiniApp } from './components/TelegramMiniApp.tsx';
import { ChairmanDashboard } from './components/ChairmanDashboard.tsx';
import { StaffDashboard } from './components/StaffDashboard.tsx';
import { DistrictAdminDashboard } from './components/DistrictAdminDashboard.tsx';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.tsx';
import { ComplaintMap } from './components/ComplaintMap.tsx';
import { ComplaintDetailModal } from './components/ComplaintDetailModal.tsx';
import { BotManagementPanel } from './components/BotManagementPanel.tsx';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('CHAIRMAN');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('demo-chairman');
  const [isMiniAppView, setIsMiniAppView] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>('dashboard');

  // Core Data
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Modals
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper headers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  // Safe JSON parser to guard against HTML warmup/error pages
  const safeJson = async (res: Response) => {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  };

  // Switch demo persona
  const handleSwitchRole = async (role: UserRole) => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await safeJson(res);
      if (data?.token) {
        setToken(data.token);
        setCurrentRole(role);
        setCurrentUser(data.user);
        if (role === 'CITIZEN') {
          setIsMiniAppView(true);
        } else {
          setIsMiniAppView(false);
          setActiveNav('dashboard');
        }
      }
    } catch (err) {
      console.error('Role switch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data
  const fetchData = async (retryCount = 0) => {
    try {
      const headers = getHeaders();

      // Current user
      const meRes = await fetch('/api/auth/me', { headers });
      const meData = await safeJson(meRes);
      if (meData?.user) setCurrentUser(meData.user);

      // Complaints
      const complaintsRes = await fetch('/api/complaints', { headers });
      const complaintsData = await safeJson(complaintsRes);
      if (Array.isArray(complaintsData)) setComplaints(complaintsData);

      // Neighborhoods
      const nRes = await fetch('/api/neighborhoods');
      const nData = await safeJson(nRes);
      if (Array.isArray(nData)) setNeighborhoods(nData);

      // Districts
      const dRes = await fetch('/api/districts');
      const dData = await safeJson(dRes);
      if (Array.isArray(dData)) setDistricts(dData);

      // Regions
      const rRes = await fetch('/api/regions');
      const rData = await safeJson(rRes);
      if (Array.isArray(rData)) setRegions(rData);

      // Staff List
      const staffRes = await fetch('/api/staff', { headers });
      const staffData = await safeJson(staffRes);
      if (Array.isArray(staffData)) setStaffList(staffData);

      // Announcements
      const annRes = await fetch('/api/announcements');
      const annData = await safeJson(annRes);
      if (Array.isArray(annData)) setAnnouncements(annData);

      // Polls
      const pollsRes = await fetch('/api/polls', { headers });
      const pollsData = await safeJson(pollsRes);
      if (Array.isArray(pollsData)) setPolls(pollsData);

      // Plans
      const plansRes = await fetch('/api/subscriptions/plans');
      const plansData = await safeJson(plansRes);
      if (Array.isArray(plansData)) setPlans(plansData);

      // Reports (if authorized)
      if (currentRole !== 'CITIZEN' && currentRole !== 'STAFF') {
        const repRes = await fetch('/api/reports', { headers });
        const repData = await safeJson(repRes);
        if (repData?.summary) setReportSummary(repData.summary);
      }

      // If server was still initializing and returned null for neighborhoods, retry once
      if (!nData && retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), 1200);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      if (retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check URL parameters on mount (?role=CHAIRMAN or ?token=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role') as UserRole | null;
      const urlToken = params.get('token');
      if (urlRole && ['CITIZEN', 'CHAIRMAN', 'STAFF', 'DISTRICT_ADMIN', 'SUPER_ADMIN'].includes(urlRole)) {
        handleSwitchRole(urlRole);
      } else if (urlToken) {
        setToken(urlToken);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [token, currentRole]);

  // Create Complaint
  const handleCreateComplaint = async (data: any) => {
    let res: Response | null = null;
    let lastErr: any = null;

    for (let i = 0; i < 2; i++) {
      try {
        res = await fetch('/api/complaints', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(data),
        });
        if (res && res.ok) break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!res) {
      throw lastErr || new Error("Tarmoq xatosi: Server bilan aloqa o'rnatilmadi");
    }

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Xatolik yuz berdi');
    }
    await fetchData();
  };

  // Update Status
  const handleStatusUpdate = async (complaintId: string, newStatus: string, explanation: string, evidenceUrl?: string) => {
    let res: Response | null = null;
    let lastErr: any = null;

    for (let i = 0; i < 2; i++) {
      try {
        res = await fetch(`/api/complaints/${complaintId}/status`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ newStatus, explanation, evidenceUrl }),
        });
        if (res && res.ok) break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!res) {
      throw lastErr || new Error("Tarmoq xatosi: Server bilan aloqa o'rnatilmadi");
    }

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Statusni o\'zgartirishda xatolik');
    }
    // Refresh modal and complaints
    try {
      const detailRes = await fetch(`/api/complaints/${complaintId}`, { headers: getHeaders() });
      const detail = await safeJson(detailRes);
      if (detail) setSelectedComplaint(detail);
    } catch {
      // ignore
    }
    await fetchData();
  };

  // Assign Staff
  const handleAssignStaff = async (complaintId: string, staffId: string, notes: string, deadline?: string) => {
    const res = await fetch(`/api/complaints/${complaintId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ staffId, notes, deadline }),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Xodimga biriktirishda xatolik');
    }
    const detailRes = await fetch(`/api/complaints/${complaintId}`, { headers: getHeaders() });
    const detail = await safeJson(detailRes);
    if (detail) setSelectedComplaint(detail);
    await fetchData();
  };

  // Rate Complaint
  const handleRateComplaint = async (complaintId: string, score: number, comment?: string) => {
    const res = await fetch(`/api/complaints/${complaintId}/rate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ score, comment }),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Baholashda xatolik');
    }
    const detailRes = await fetch(`/api/complaints/${complaintId}`, { headers: getHeaders() });
    const detail = await safeJson(detailRes);
    if (detail) setSelectedComplaint(detail);
    await fetchData();
  };

  // Create Announcement
  const handleCreateAnnouncement = async (data: any) => {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('E\'lon yaratishda xatolik');
    await fetchData();
  };

  // Create Poll
  const handleCreatePoll = async (data: any) => {
    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('So\'rovnoma yaratishda xatolik');
    await fetchData();
  };

  // Vote in Poll
  const handleVotePoll = async (pollId: string, optionId: string) => {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ optionId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ovoz berishda xatolik');
    }
    await fetchData();
  };

  // Create Region
  const handleCreateRegion = async (data: any) => {
    await fetch('/api/regions', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await fetchData();
  };

  // Create District
  const handleCreateDistrict = async (data: any) => {
    await fetch('/api/districts', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await fetchData();
  };

  // Create Neighborhood
  const handleCreateNeighborhood = async (data: any) => {
    await fetch('/api/neighborhoods', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await fetchData();
  };

  // Export CSV Report
  const handleExportReport = () => {
    window.location.href = `/api/reports/export?token=${token}`;
  };

  // Open detailed complaint
  const handleSelectComplaint = async (c: Complaint) => {
    try {
      const res = await fetch(`/api/complaints/${c.id}`, { headers: getHeaders() });
      const detail = await safeJson(res);
      if (detail && detail.id) {
        setSelectedComplaint(detail);
      } else {
        setSelectedComplaint(c);
      }
    } catch {
      setSelectedComplaint(c);
    }
  };

  const currentNeighborhood = neighborhoods.find((n) => n.id === currentUser?.neighborhoodId) || neighborhoods[0] || null;
  const currentDistrict = districts.find((d) => d.id === currentUser?.districtId) || districts[0] || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F6] text-slate-900 font-sans antialiased">
      {/* Top Navbar with Role Switcher */}
      <Navbar
        currentUser={currentUser || ({} as User)}
        currentRole={currentRole}
        isMiniAppView={isMiniAppView}
        onToggleMiniAppView={() => setIsMiniAppView(!isMiniAppView)}
        onSwitchRole={handleSwitchRole}
        activeNav={activeNav}
        onSelectNav={(nav) => {
          setActiveNav(nav);
          setIsMiniAppView(false);
        }}
      />

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 border-4 border-[#16834B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isMiniAppView ? (
          /* Telegram Mini App Simulator View */
          <div className="py-2">
            <div className="text-center mb-3">
              <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                📱 Telegram Mini App (Mobil Ekran Ko'rinishi)
              </span>
            </div>
            <TelegramMiniApp
              currentUser={currentUser || ({} as User)}
              neighborhood={currentNeighborhood}
              complaints={complaints}
              announcements={announcements}
              polls={polls}
              onCreateComplaint={handleCreateComplaint}
              onSelectComplaint={handleSelectComplaint}
              onVotePoll={handleVotePoll}
              onSwitchToChairman={() => handleSwitchRole('CHAIRMAN')}
            />
          </div>
        ) : activeNav === 'public' ? (
          /* Responsive Public Website */
          <PublicWebsite
            neighborhoods={neighborhoods}
            announcements={announcements}
            complaints={complaints}
            onOpenMiniApp={() => setIsMiniAppView(true)}
            onSelectRole={handleSwitchRole}
            onOpenComplaint={handleSelectComplaint}
          />
        ) : activeNav === 'map' ? (
          /* Interactive Neighborhood Leaflet Map View */
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Qarshi shahri, Vatanparvar MFY xaritasi</h2>
                <p className="text-xs text-slate-500">Murojaatlar joylashuvi va toifalar bo'yicha vizual nazorat</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Hal etilgan</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> Jarayonda</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Yangi</span>
              </div>
            </div>
            <ComplaintMap
              complaints={complaints}
              center={[38.8612, 65.7891]}
              zoom={15}
              heightClass="h-[600px]"
              onSelectComplaint={handleSelectComplaint}
            />
          </div>
        ) : activeNav === 'bot' ? (
          /* Single Server Unified Bot Management Portal */
          <BotManagementPanel />
        ) : (
          /* Role-based Dashboards */
          <>
            {currentRole === 'CHAIRMAN' && (
              <ChairmanDashboard
                currentUser={currentUser || ({} as User)}
                neighborhood={currentNeighborhood}
                complaints={complaints}
                staffList={staffList}
                announcements={announcements}
                polls={polls}
                reportSummary={reportSummary}
                onSelectComplaint={handleSelectComplaint}
                onCreateAnnouncement={handleCreateAnnouncement}
                onCreatePoll={handleCreatePoll}
                onExportReport={handleExportReport}
              />
            )}

            {currentRole === 'STAFF' && (
              <StaffDashboard
                currentUser={currentUser || ({} as User)}
                complaints={complaints}
                onSelectComplaint={handleSelectComplaint}
                onStatusUpdate={handleStatusUpdate}
              />
            )}

            {currentRole === 'DISTRICT_ADMIN' && (
              <DistrictAdminDashboard
                district={currentDistrict}
                neighborhoods={neighborhoods}
                complaints={complaints}
                onSelectComplaint={handleSelectComplaint}
                onCreateNeighborhood={handleCreateNeighborhood}
              />
            )}

            {currentRole === 'SUPER_ADMIN' && (
              <SuperAdminDashboard
                regions={regions}
                districts={districts}
                neighborhoods={neighborhoods}
                users={allUsers.length > 0 ? allUsers : staffList}
                complaints={complaints}
                plans={plans}
                onCreateRegion={handleCreateRegion}
                onCreateDistrict={handleCreateDistrict}
                onCreateNeighborhood={handleCreateNeighborhood}
              />
            )}

            {currentRole === 'CITIZEN' && (
              <TelegramMiniApp
                currentUser={currentUser || ({} as User)}
                neighborhood={currentNeighborhood}
                complaints={complaints}
                announcements={announcements}
                polls={polls}
                onCreateComplaint={handleCreateComplaint}
                onSelectComplaint={handleSelectComplaint}
                onVotePoll={handleVotePoll}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Complaint Detail & Workflow Audit Modal */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          currentUser={currentUser || ({} as User)}
          staffList={staffList}
          onClose={() => setSelectedComplaint(null)}
          onStatusUpdate={handleStatusUpdate}
          onAssignStaff={handleAssignStaff}
          onRateComplaint={handleRateComplaint}
        />
      )}
    </div>
  );
}
