// app/styles/farmTheme.ts

export const farmColors = {
  background: "#FFF8EF",
  card: "#FFFFFF",
  primary: "#067A46",
  primaryDark: "#045E36",
  primaryLight: "#E6F5EC",
  accent: "#FF7A1A",
  accentLight: "#FFF0E3",
  text: "#1F2933",
  mutedText: "#6B7280",
  border: "#E5E7EB",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  cream: "#FFF8EF",
  farmGreen: "#0B7A3B",
  freshGreen: "#23A455",
  leaf: "#DFF5E7",
};

export const farmSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const farmRadius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const farmShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
};

export const farmTypography = {
  title: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: farmColors.text,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: farmColors.text,
  },
  subheading: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: farmColors.text,
  },
  body: {
    fontSize: 15,
    color: farmColors.mutedText,
    lineHeight: 22,
  },
  button: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#FFFFFF",
  },
};

export const farmButtons = {
  primary: {
    backgroundColor: farmColors.primary,
    borderRadius: farmRadius.pill,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondary: {
    backgroundColor: farmColors.accent,
    borderRadius: farmRadius.pill,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  outline: {
    backgroundColor: "#FFFFFF",
    borderColor: farmColors.primary,
    borderWidth: 1.5,
    borderRadius: farmRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};

export const farmCards = {
  default: {
    backgroundColor: farmColors.card,
    borderRadius: farmRadius.lg,
    padding: farmSpacing.md,
    borderWidth: 1,
    borderColor: farmColors.border,
    ...farmShadow,
  },
  soft: {
    backgroundColor: farmColors.primaryLight,
    borderRadius: farmRadius.lg,
    padding: farmSpacing.md,
  },
};

export const farmInputs = {
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: farmColors.border,
    borderWidth: 1,
    borderRadius: farmRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: farmColors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: farmColors.text,
    marginBottom: 8,
  },
};

export const farmTheme = {
  colors: farmColors,
  spacing: farmSpacing,
  radius: farmRadius,
  shadow: farmShadow,
  typography: farmTypography,
  buttons: farmButtons,
  cards: farmCards,
  inputs: farmInputs,
};

export default farmTheme;