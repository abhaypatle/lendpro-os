import React from 'react';
import { useTranslation } from 'react-i18next';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-slate-900 text-cyan-400 border border-cyan-500/30 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
      >
        <option value="en">English (EN)</option>
        <option value="hi">हिंदी (HI)</option>
        <option value="mr">मराठी (MR)</option>
        <option value="hi_en">Hinglish</option>
      </select>
    </div>
  );
}
