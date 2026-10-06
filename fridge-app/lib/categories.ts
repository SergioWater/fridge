import {
  Leaf,
  Milk,
  Beef,
  Croissant,
  Package,
  Snowflake,
  CupSoda,
  Box,
  type LucideIcon,
} from "lucide-react-native";

export const CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Case-insensitive synonym map → canonical Category string.
// Covers historical DB rows saved before the prompt was pinned and any future
// model drift. Add entries here if Gemini ever invents a new synonym.
const SYNONYM_MAP: Record<string, Category> = {
  // Produce
  fruit: "Produce",
  fruits: "Produce",
  vegetable: "Produce",
  vegetables: "Produce",
  produce: "Produce",
  // Dairy
  dairy: "Dairy",
  eggs: "Dairy",
  // Meat
  meat: "Meat",
  poultry: "Meat",
  seafood: "Meat",
  fish: "Meat",
  // Bakery
  bakery: "Bakery",
  bread: "Bakery",
  "baked goods": "Bakery",
  // Pantry
  pantry: "Pantry",
  snacks: "Pantry",
  condiments: "Pantry",
  "dry goods": "Pantry",
  // Frozen
  frozen: "Frozen",
  freezer: "Frozen",
  // Beverages
  beverage: "Beverages",
  beverages: "Beverages",
  drink: "Beverages",
  drinks: "Beverages",
  // Other (explicit fallthrough so the map is exhaustive)
  other: "Other",
};

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  Produce: Leaf,
  Dairy: Milk,
  Meat: Beef,
  Bakery: Croissant,
  Pantry: Package,
  Frozen: Snowflake,
  Beverages: CupSoda,
  Other: Box,
};

/**
 * Maps any raw category string returned by Gemini (or stored in the DB before
 * the prompt was pinned) to one of the 8 canonical Category values.
 * Always returns "Other" for null, empty, or unrecognised inputs.
 */
export function normalizeCategory(raw: string | null | undefined): Category {
  if (!raw) return "Other";
  return SYNONYM_MAP[raw.trim().toLowerCase()] ?? "Other";
}
