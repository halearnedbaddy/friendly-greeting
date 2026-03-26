import { useState, useEffect } from 'react';

export interface Country {
    code: string;
    name: string;
    currencyCode: string;
    currencySymbol: string;
    phonePrefix: string;
    defaultLanguage: string;
}

export const SUPPORTED_COUNTRIES: Country[] = [
    { code: 'KE', name: 'Kenya', currencyCode: 'KES', currencySymbol: 'KES', phonePrefix: '+254', defaultLanguage: 'sw' },
    { code: 'UG', name: 'Uganda', currencyCode: 'UGX', currencySymbol: 'USh', phonePrefix: '+256', defaultLanguage: 'en' },
    { code: 'TZ', name: 'Tanzania', currencyCode: 'TZS', currencySymbol: 'TZS', phonePrefix: '+255', defaultLanguage: 'sw' },
    { code: 'RW', name: 'Rwanda', currencyCode: 'RWF', currencySymbol: 'RWF', phonePrefix: '+250', defaultLanguage: 'fr' },
];

/** Exchange rate: 1 KES = X in target currency (approximate). Used to convert stored KES amounts to display currency. */
export const EXCHANGE_RATES_FROM_KES: Record<string, number> = {
    KES: 1,
    UGX: 24,
    TZS: 21,
    RWF: 12.5,
    USD: 0.0077,
};

function getInitialCountry(): Country {
    if (typeof window === 'undefined') return SUPPORTED_COUNTRIES[0];
    const saved = localStorage.getItem('payloom_country');
    const country = saved ? SUPPORTED_COUNTRIES.find(c => c.code === saved) : null;
    return country ?? SUPPORTED_COUNTRIES[0];
}

function getInitialLanguage(): string {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('payloom_lang') || 'en';
}

export function useCurrency() {
    const [selectedCountry, setSelectedCountry] = useState<Country>(getInitialCountry);
    const [language, setLanguage] = useState<string>(getInitialLanguage);

    useEffect(() => {
        const saved = localStorage.getItem('payloom_country');
        if (saved) {
            const country = SUPPORTED_COUNTRIES.find(c => c.code === saved);
            if (country) setSelectedCountry(country);
        }
        const savedLang = localStorage.getItem('payloom_lang');
        if (savedLang) setLanguage(savedLang);
    }, []);

    // Sync when currency is changed from another component (e.g. CurrencySelector)
    useEffect(() => {
        const handler = () => {
            const saved = localStorage.getItem('payloom_country');
            if (saved) {
                const country = SUPPORTED_COUNTRIES.find(c => c.code === saved);
                if (country) setSelectedCountry(country);
            }
        };
        window.addEventListener('payloom-currency-changed', handler);
        return () => window.removeEventListener('payloom-currency-changed', handler);
    }, []);

    const changeCountry = (code: string) => {
        const country = SUPPORTED_COUNTRIES.find(c => c.code === code);
        if (country) {
            setSelectedCountry(country);
            localStorage.setItem('payloom_country', code);
            window.dispatchEvent(new CustomEvent('payloom-currency-changed', { detail: country.currencyCode }));
            if (!localStorage.getItem('payloom_lang')) {
                setLanguage(country.defaultLanguage);
                localStorage.setItem('payloom_lang', country.defaultLanguage);
                window.dispatchEvent(new CustomEvent('payloom-language-changed', { detail: country.defaultLanguage }));
            }
        }
    };

    const changeLanguage = (lang: string) => {
        setLanguage(lang);
        localStorage.setItem('payloom_lang', lang);
        window.dispatchEvent(new CustomEvent('payloom-language-changed', { detail: lang }));
    };

    /** Convert amount from source currency to display (selected) currency. Amounts are typically stored in KES. */
    const convert = (amount: number, fromCurrency: string): number => {
        if (fromCurrency === selectedCountry.currencyCode) return amount;
        const fromRate = fromCurrency === 'KES' ? 1 : 1 / (EXCHANGE_RATES_FROM_KES[fromCurrency] ?? 1);
        const toRate = EXCHANGE_RATES_FROM_KES[selectedCountry.currencyCode] ?? 1;
        return amount * fromRate * toRate;
    };

    /**
     * Format amount in display currency. If fromCurrency is provided and differs from selected currency, converts first.
     * @param amount - amount in the source currency (e.g. KES from backend)
     * @param fromCurrency - optional; if provided, amount is converted from this currency to selected, then formatted
     */
    const formatPrice = (amount: number, fromCurrency?: string) => {
        const displayCurrency = selectedCountry.currencyCode;
        const sourceCurrency = (typeof fromCurrency === 'string' ? fromCurrency : undefined) || displayCurrency;
        const amountToFormat = sourceCurrency !== displayCurrency ? convert(amount, sourceCurrency) : amount;
        const localeMap: Record<string, string> = {
            'KES': 'en-KE',
            'UGX': 'en-UG',
            'TZS': 'en-TZ',
            'RWF': 'en-RW',
            'USD': 'en-US',
        };
        return new Intl.NumberFormat(localeMap[displayCurrency] || 'en-US', {
            style: 'currency',
            currency: displayCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amountToFormat);
    };

    return { selectedCountry, changeCountry, formatPrice, convert, EXCHANGE_RATES_FROM_KES, SUPPORTED_COUNTRIES, language, changeLanguage };
}
