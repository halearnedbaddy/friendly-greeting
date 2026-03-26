import { useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { useTranslations } from '@/hooks/useTranslations';
import { Globe, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', labelKey: 'common.english' as const },
  { code: 'sw', labelKey: 'common.swahili' as const },
  { code: 'fr', labelKey: 'common.french' as const },
];

/**
 * Global language switcher. Rendered in App so it appears on every page.
 * Uses z-40 so modals (z-50) render on top and the button is hidden when a modal is open.
 */
export function LanguageSwitcher() {
  const { language, changeLanguage } = useCurrency();
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg bg-white/95 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition text-sm font-medium text-gray-700 touch-target"
          aria-label="Change language"
          aria-expanded={isOpen}
        >
          <Globe size={18} className="text-[#5d2ba3]" />
          <span>{language.toUpperCase()}</span>
          <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2">
              <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Language
              </p>
              {LANGUAGES.map(({ code, labelKey }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    changeLanguage(code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition ${
                    language === code
                      ? 'bg-[#5d2ba3]/10 text-[#5d2ba3] font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
