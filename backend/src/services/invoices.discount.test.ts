import { describe, it, expect, vi } from 'vitest';

// invoices.service imports '../config/supabase' (and storage.service, which also
// imports it) at module load. Stub it so the PURE computeDiscountAmount helper
// can be imported without real Supabase env — it never touches the DB.
vi.mock('../config/supabase', () => ({ supabaseAdmin: {} }));

import { computeDiscountAmount } from './invoices.service';

// Mirror of the service's downstream totals math (discount applies BEFORE tax),
// so the assertions document the full Subtotal → Discount → Tax → Total chain
// that both the backend and the frontend (lib/utils.computeDiscount) must agree on.
const round2 = (n: number) => Math.round(n * 100) / 100;
function totals(subtotal: number, type: 'percentage' | 'fixed' | null, value: number, taxRate: number) {
  const discountAmount = computeDiscountAmount(subtotal, type, value);
  const discounted = round2(subtotal - discountAmount);
  const taxAmount = round2(discounted * (taxRate / 100));
  const total = round2(discounted + taxAmount);
  return { discountAmount, taxAmount, total };
}

describe('computeDiscountAmount', () => {
  it('returns 0 when there is no discount', () => {
    expect(computeDiscountAmount(1000, null, 0)).toBe(0);
    expect(computeDiscountAmount(1000, 'percentage', 0)).toBe(0);
    expect(computeDiscountAmount(1000, 'fixed', 0)).toBe(0);
    expect(computeDiscountAmount(0, 'percentage', 10)).toBe(0);
  });

  it('applies a percentage discount', () => {
    expect(computeDiscountAmount(1000, 'percentage', 10)).toBe(100);
    expect(computeDiscountAmount(1000, 'percentage', 12.5)).toBe(125);
  });

  it('applies a fixed discount', () => {
    expect(computeDiscountAmount(1000, 'fixed', 250)).toBe(250);
  });

  it('clamps a fixed discount to the subtotal (never negative total)', () => {
    expect(computeDiscountAmount(750, 'fixed', 1000)).toBe(750);
  });

  it('rounds to cents', () => {
    expect(computeDiscountAmount(99.99, 'percentage', 33.333)).toBe(33.33);
  });
});

describe('invoice totals (discount before tax)', () => {
  it('1000 − 10% then 7% tax → 900 / 63 / 963', () => {
    expect(totals(1000, 'percentage', 10, 7)).toEqual({ discountAmount: 100, taxAmount: 63, total: 963 });
  });

  it('1000 − $250 then 7% tax → 750 / 52.50 / 802.50', () => {
    expect(totals(1000, 'fixed', 250, 7)).toEqual({ discountAmount: 250, taxAmount: 52.5, total: 802.5 });
  });

  it('fixed discount larger than subtotal zeroes the total', () => {
    expect(totals(500, 'fixed', 1000, 7)).toEqual({ discountAmount: 500, taxAmount: 0, total: 0 });
  });

  it('no discount leaves tax on the full subtotal', () => {
    expect(totals(1000, null, 0, 10)).toEqual({ discountAmount: 0, taxAmount: 100, total: 1100 });
  });
});
