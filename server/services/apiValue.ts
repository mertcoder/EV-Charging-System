import { fromCents } from "../domain";

const moneyFields: Record<string, string> = {
  balanceCents: "balance",
  amountCents: "amount",
  pricePerKwhCents: "pricePerKwh",
  estimatedCostCents: "estimatedCost",
  holdAmountCents: "holdAmount",
  refundAmountCents: "refundAmount",
  unitPriceCents: "unitPrice",
  totalCostCents: "totalCost"
};

export function toApiValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toApiValue);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const mappedKey = moneyFields[key];
    if (mappedKey) {
      output[mappedKey] = typeof item === "number" ? fromCents(item) : item;
    } else {
      output[key] = toApiValue(item);
    }
  }
  return output;
}
