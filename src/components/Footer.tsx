import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/mahalla-one-logo.png" alt="Mahalla One" className="w-5 h-5 rounded-md object-contain" />
          <span className="font-extrabold text-slate-900 tracking-tight">Mahalla One</span>
          <span>·</span>
          <span>O'zbekiston mahallalari raqamli boshqaruv platformasi</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span>Pilot: Qarshi shahar, Vatanparvar MFY</span>
          <span>·</span>
          <span>Telegram: @mahallaone_bot</span>
          <span>·</span>
          <span>© 2026 Mahalla One. Barcha huquqlar himoyalangan.</span>
        </div>
      </div>
    </footer>
  );
};
