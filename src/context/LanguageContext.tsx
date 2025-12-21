import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import { translations } from "../i18n/translations";

type Language = "en" | "ar" | "fr";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof typeof translations.en) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      // SAFETY CHECK: Ensure Native RTL is ALWAYS off so manual logic works
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }

      const storedLang = await AsyncStorage.getItem("user-language");
      if (storedLang) {
        setLanguageState(storedLang as Language);
      }
    } catch (error) {
      console.log("Error loading language", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setLanguage = async (lang: Language) => {
    // Simply update state and storage. No reloads.
    setLanguageState(lang);
    await AsyncStorage.setItem("user-language", lang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || key;
  };

  if (!isLoaded) return null;

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, isRTL: language === "ar" }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
