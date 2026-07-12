import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-5">
        {/* Logo mark */}
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-raised">
            <span className="text-3xl">📅</span>
          </div>
          {/* Spinning ring */}
          <div className="absolute -inset-2 rounded-[1.75rem] border-4 border-transparent border-t-primary animate-spin" />
        </div>

        {/* App name */}
        <div className="text-center">
          <p className="font-extrabold text-lg text-gradient leading-tight">Rodinka</p>
          <p className="text-ink-faint text-xs mt-1 font-medium">Načítám…</p>
        </div>
      </div>
    </div>
  );
}
