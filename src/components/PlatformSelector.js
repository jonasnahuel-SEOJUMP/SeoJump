"use client";

import { CMS_PLATFORMS, getStoredPlatform, setStoredPlatform } from "../lib/cmsGuide";

export default function PlatformSelector({ value, onChange, playClick }) {
  const current = value || getStoredPlatform();

  const handleChange = (id) => {
    setStoredPlatform(id);
    if (onChange) onChange(id);
    if (playClick) playClick();
  };

  return (
    <div className="card-3d p-4 md:p-5 border border-duo-blue/30 bg-slate-900/40 space-y-3">
      <p className="text-xs font-black text-duo-blue uppercase tracking-wider">
        🧭 ¿Cómo está hecha tu web?
      </p>
      <p className="text-sm font-bold text-slate-400">
        Elegí una vez y te mostramos <strong className="text-slate-200">dónde editar</strong> cada cambio.
      </p>
      <div className="flex flex-wrap gap-2">
        {CMS_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleChange(p.id)}
            className={`text-sm font-black transition-all ${
              current === p.id
                ? 'btn-3d btn-blue !py-2 !px-4 !text-xs !normal-case !tracking-normal scale-105'
                : 'px-3 py-2 rounded-full border-2 border-slate-600 bg-slate-800/80 text-slate-300 hover:border-duo-blue/50 hover:text-white'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
