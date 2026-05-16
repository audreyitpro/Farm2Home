// app/styles/freightTheme.ts

export const freightColors = {
  background: "#0B1220",
  surface: "#121A2B",
  card: "#182235",
  cardHover: "#1F2C44",

  primary: "#00C2FF",
  primaryDark: "#0094C7",
  primaryLight: "#D9F7FF",

  accent: "#FFB020",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",

  text: "#F3F4F6",
  mutedText: "#94A3B8",
  border: "#273449",

  rowDark: "#101826",
  rowLight: "#182235",

  loadHot: "#22C55E",
  loadMedium: "#F59E0B",
  loadLow: "#EF4444",
};

export const freightSpacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const freightRadius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const freightShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
};

export const freightTypography = {
  title: {
    fontSize: 30,
    fontWeight: "800" as const,
    color: freightColors.text,
  },

  heading: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: freightColors.text,
  },

  subheading: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: freightColors.text,
  },

  body: {
    fontSize: 14,
    lineHeight: 22,
    color: freightColors.mutedText,
  },

  button: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#FFFFFF",
  },

  tableHeader: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: freightColors.mutedText,
    textTransform: "uppercase" as const,
  },

  tableCell: {
    fontSize: 14,
    color: freightColors.text,
  },
};

export const freightButtons = {
  primary: {
    backgroundColor: freightColors.primary,
    borderRadius: freightRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  secondary: {
    backgroundColor: freightColors.card,
    borderWidth: 1,
    borderColor: freightColors.border,
    borderRadius: freightRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  warning: {
    backgroundColor: freightColors.accent,
    borderRadius: freightRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};

export const freightCards = {
  default: {
    backgroundColor: freightColors.card,
    borderRadius: freightRadius.lg,
    borderWidth: 1,
    borderColor: freightColors.border,
    padding: freightSpacing.md,
    ...freightShadow,
  },

  boardRow: {
    backgroundColor: freightColors.surface,
    borderRadius: freightRadius.md,
    borderWidth: 1,
    borderColor: freightColors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
};

export const freightInputs = {
  input: {
    backgroundColor: freightColors.surface,
    borderColor: freightColors.border,
    borderWidth: 1,
    borderRadius: freightRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: freightColors.text,
    fontSize: 15,
  },

  label: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: freightColors.mutedText,
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
};

export const freightTable = {
  headerRow: {
    flexDirection: "row" as const,
    backgroundColor: freightColors.rowDark,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: freightColors.border,
  },

  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: freightColors.rowLight,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: freightColors.border,
  },
};

export const freightTheme = {
  colors: freightColors,
  spacing: freightSpacing,
  radius: freightRadius,
  shadow: freightShadow,
  typography: freightTypography,
  buttons: freightButtons,
  cards: freightCards,
  inputs: freightInputs,
  table: freightTable,
};

export default freightTheme;