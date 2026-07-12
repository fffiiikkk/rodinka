import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh flex items-center justify-center text-center p-8">
      <div>
        <div className="text-6xl mb-4">🗺️</div>
        <h1 className="text-2xl font-extrabold text-ink mb-2">404 — Stránka nenalezena</h1>
        <p className="text-ink-muted mb-6">Tato stránka neexistuje nebo byla přesunuta.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-6 py-3">
          ← Zpět domů
        </button>
      </div>
    </div>
  );
}
