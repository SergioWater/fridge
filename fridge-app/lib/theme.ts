/**
 * Design tokens — the single source of truth for colors, type, spacing.
 * Inspired by warm Mediterranean kitchen palette: parchment cream
 * backgrounds, deep saturated greens, terracotta accents, honey warnings.
 *
 * Anywhere in the app, import from here instead of hardcoding values:
 *   import { colors, spacing, type } from "@/lib/theme";
 */

export const colors = {
  // Backgrounds
  bgBase: "#F7F3EC", // warm parchment cream
  bgCard: "#FFFFFF", // section cards
  bgElevated: "#EFE9DD", // sticky add bar, tab bar
  bgPressed: "#EAE3D2", // pressed-state highlight

  // Text
  textPrimary: "#1A1F1A", // warm near-black, slight green undertone
  textMuted: "#6E6A5E", // section headers, metadata
  textFaint: "#A9A395", // empty-state hints, placeholders
  textInverse: "#FFFFFF", // on dark/accent backgrounds

  // Brand accent (deep kitchen green — spinach, basil)
  accent: "#2F6A3E",
  accentDeep: "#1F4A2A",
  accentSoft: "#DDEBD8", // "in X days" success chip fill

  // Warnings (honey-yellow — egg yolk)
  warning: "#D4A24A",
  warningSoft: "#F5E8C7",

  // Danger (terracotta — tomato)
  danger: "#B53A2A",
  dangerSoft: "#F0D6CE",

  // Structure
  divider: "#E8E1D2", // hairline between rows
  border: "#D9D2C2", // input outlines, cards
  scrim: "rgba(26,31,26,0.5)", // modal overlay background
} as const;

/**
 * Spacing scale — 4pt base.
 * Use these instead of magic numbers so margins/paddings stay consistent.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Border radius scale.
 */
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * Font family names. These match what we load in App.tsx via
 * @expo-google-fonts/fraunces and /inter.
 */
export const fonts = {
  displayRegular: "Fraunces_400Regular",
  displayMedium: "Fraunces_500Medium",
  displaySemibold: "Fraunces_600SemiBold",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

/**
 * Pre-baked text styles. Use these as a starting point and override on a
 * case-by-case basis. Anywhere we'd write `{ fontFamily, fontSize, ... }`
 * inline, prefer pulling from here.
 */
export const type = {
  h1: {
    fontFamily: fonts.displaySemibold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyStrong: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  captionStrong: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  button: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    lineHeight: 20,
  },
  chip: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  // Canonical pattern: editorial section header + metadata count side-by-side.
  // Used by the Fridge category headers; reuse for any "Fraunces header + Inter
  // metadata" pairing rather than inlining values in components.
  sectionHeader: {
    fontFamily: fonts.displaySemibold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  sectionMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
  },
} as const;

/**
 * Shadows — subtle for warm-light theme. Native shadow props differ
 * between iOS and Android; this helper returns both.
 */
export const shadows = {
  card: {
    shadowColor: "#1A1F1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: "#1A1F1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;
