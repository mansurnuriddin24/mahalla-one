import React, { useState } from 'react';
import { UserRole, User } from '../types/index.ts';
import { Smartphone, User as UserIcon, ChevronDown, Check, Bot } from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  currentRole: UserRole;
  isMiniAppView: boolean;
  onToggleMiniAppView: () => void;
  onSwitchRole: (role: UserRole) => void;
  activeNav: string;
  onSelectNav: (nav: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentRole,
  isMiniAppView,
  onToggleMiniAppView,
  onSwitchRole,
  activeNav,
  onSelectNav,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const roleLabels: Record<UserRole, string> = {
    CITIZEN: 'Fuqaro',
    CHAIRMAN: 'Mahalla Raisi',
    STAFF: 'Kommunal Usta',
    DISTRICT_ADMIN: 'Tuman Hokimligi',
    SUPER_ADMIN: 'Super Administrator',
  };

  const roleColors: Record<UserRole, string> = {
    CITIZEN: 'bg-blue-50 text-blue-700 border-blue-200',
    CHAIRMAN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    STAFF: 'bg-amber-50 text-amber-700 border-amber-200',
    DISTRICT_ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    SUPER_ADMIN: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-6">
        {/* Brand Logo & Territory */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectNav('public');
            }}
            className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <img
              src="/mahalla-one-logo.png"
              alt="Mahalla One"
              className="w-9 h-9 rounded-xl object-contain bg-white shadow-xs"
            />
            <div className="flex flex-col">
              <span className="leading-tight">Mahalla One</span>
              <span className="text-[10px] font-medium text-slate-500 tracking-normal">Raqamli mahalla tizimi</span>
            </div>
          </a>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            onClick={() => onSelectNav('public')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeNav === 'public' && !isMiniAppView ? 'text-[#16834B] font-bold' : 'hover:text-slate-900'
            }`}
          >
            Bosh sahifa
          </button>

          <button
            onClick={() => onSelectNav('dashboard')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeNav === 'dashboard' && !isMiniAppView ? 'text-[#16834B] font-bold' : 'hover:text-slate-900'
            }`}
          >
            {roleLabels[currentRole]} Kabineti
          </button>

          <button
            onClick={() => {
              onSelectNav('public');
              setTimeout(() => {
                const el = document.getElementById('how-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
          >
            Qanday ishlaydi
          </button>

          <button
            onClick={() => onSelectNav('map')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeNav === 'map' ? 'text-[#16834B] font-bold' : 'hover:text-slate-900'
            }`}
          >
            Mahalla xaritasi
          </button>

          <button
            onClick={() => onSelectNav('bot')}
            className={`whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
              activeNav === 'bot' && !isMiniAppView
                ? 'bg-emerald-50 text-[#16834B] font-bold border border-emerald-200'
                : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bot Boshqaruvi</span>
          </button>
        </nav>

        {/* Right Actions: Mini App Toggle & User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleMiniAppView}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap ${
              isMiniAppView
                ? 'bg-slate-900 text-white'
                : 'bg-emerald-50 text-[#16834B] border border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Telegram Mini App ko'rinishiga o'tish"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isMiniAppView ? 'Veb ko\'rinish' : 'Mini App'}</span>
          </button>

          {/* User Account / Role Badge */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-[#16834B]/10 text-[#16834B] flex items-center justify-center font-bold text-xs">
                {currentUser?.fullName?.charAt(0) || <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                  {currentUser?.fullName || 'Foydalanuvchi'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-none">
                  {roleLabels[currentRole]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Account Switcher Dropdown */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{currentUser?.fullName}</div>
                  <div className="text-[11px] text-slate-500">Qarshi shahri, Vatanparvar MFY</div>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleColors[currentRole]}`}>
                    {roleLabels[currentRole]}
                  </span>
                </div>

                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Kabinetni tanlash:
                  </div>
                  {((currentUser?.role === 'SUPER_ADMIN'
                    ? ['CITIZEN', 'CHAIRMAN', 'STAFF', 'DISTRICT_ADMIN', 'SUPER_ADMIN']
                    : ['CITIZEN', 'CHAIRMAN', 'STAFF', 'DISTRICT_ADMIN']
                  ) as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        onSwitchRole(r);
                        setProfileDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        currentRole === r ? 'font-bold text-[#16834B] bg-emerald-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{roleLabels[r]}</span>
                      {currentRole === r && <Check className="w-3.5 h-3.5 text-[#16834B]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
