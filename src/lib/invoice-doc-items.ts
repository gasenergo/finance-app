export interface InvoiceItemInput {
  description: string;
  amount: number;
  quantity?: number;
  unit?: string;
  unitPrice?: number | null;
}

export interface InvoiceItemGroup {
  description: string;
  qty: number;
  price: number;
  total: number;
  unit: string | null;
}

/**
 * Объединяет одинаковые работы (по названию) в строки акта:
 * - количество и сумма складываются;
 * - цена за единицу берётся из работы (unitPrice = default_price вида работ),
 *   иначе (своё название без вида) — сумма ÷ количество;
 * - единица измерения сохраняется из работы.
 */
export function aggregateInvoiceItems(items: InvoiceItemInput[]): InvoiceItemGroup[] {
  const groups = new Map<string, { description: string; unitPrice: number | null; unit: string | null; qty: number; total: number }>();

  for (const item of items) {
    const key = item.description.trim();
    const qty = Math.max(1, Math.round(item.quantity ?? 1));
    const total = Number(item.amount) || 0;

    const existing = groups.get(key);
    if (existing) {
      existing.qty += qty;
      existing.total += total;
      if (existing.unitPrice == null && item.unitPrice != null) existing.unitPrice = item.unitPrice;
      continue;
    }

    groups.set(key, {
      description: key,
      unitPrice: item.unitPrice ?? null,
      unit: item.unit && item.unit.trim() ? item.unit.trim() : null,
      qty,
      total,
    });
  }

  return [...groups.values()].map(g => ({
    description: g.description,
    qty: g.qty,
    total: g.total,
    price: g.unitPrice != null ? g.unitPrice : g.total / g.qty,
    unit: g.unit,
  }));
}