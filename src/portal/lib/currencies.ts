// Currency options for the invoice editor's currency dropdown (Wave-style
// "USD ($) – U.S. dollar"). `code` is what's stored on the invoice + passed to
// formatCurrency (Intl). Keep this list short and common; add more as needed.
export interface CurrencyOption { code: string; symbol: string; name: string }

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$',  name: 'U.S. dollar' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'British pound' },
  { code: 'CAD', symbol: '$',  name: 'Canadian dollar' },
  { code: 'AUD', symbol: '$',  name: 'Australian dollar' },
  { code: 'INR', symbol: '₹',  name: 'Indian rupee' },
  { code: 'SGD', symbol: '$',  name: 'Singapore dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss franc' },
];

// "USD ($) – U.S. dollar" label used in the dropdown.
export function currencyLabel(c: CurrencyOption): string {
  return `${c.code} (${c.symbol}) – ${c.name}`;
}
