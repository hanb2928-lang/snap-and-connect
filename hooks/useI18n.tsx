import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppLanguage } from '@/lib/i18n';
import { translations, detectSystemLanguage, translate } from '@/lib/i18n';
import { getItem, setItem } from '@/lib/storage';

const STORAGE_KEY = 'app_language';

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'ko',
  setLanguage: async () => {},
  t: (key) => key,
  isReady: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('ko');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getItem(STORAGE_KEY);
        if (stored && stored in translations) {
          setLanguageState(stored as AppLanguage);
        } else {
          const detected = detectSystemLanguage();
          setLanguageState(detected);
        }
      } catch {
        const detected = detectSystemLanguage();
        setLanguageState(detected);
      }
      setIsReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      await setItem(STORAGE_KEY, lang);
    } catch {
      // storage may not be available
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => translate(language, key, fallback),
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isReady }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { t } = useContext(I18nContext);
  return t;
}
