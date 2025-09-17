// Theme schema definition and validation
import { z } from "zod";

// Hex color validation (6-digit with optional #)
const hexColorSchema = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Must be a valid 6-digit hex color")
  .transform((val) => (val.startsWith("#") ? val : `#${val}`));

// Radius validation (6-28px)
const radiusSchema = z
  .number()
  .min(6, "Radius must be at least 6px")
  .max(28, "Radius must be at most 28px");

// Shadow validation (basic CSS shadow format)
const shadowSchema = z
  .string()
  .regex(
    /^(\d+px\s+\d+px\s+\d+px\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|\w+)(\s*,\s*)?)+$/,
    "Must be a valid CSS shadow value"
  );

// Font weight validation
const fontWeightSchema = z.number().min(100).max(900);

// Theme schema definition
export const themeSchema = z.object({
  meta: z.object({
    name: z.string().min(1, "Theme name is required"),
    version: z.string().optional().default("1.0.0"),
    description: z.string().optional(),
  }),

  fonts: z.object({
    heading: z.object({
      family: z.string().min(1, "Heading font family is required"),
      weight: fontWeightSchema
        .min(500, "Heading font weight must be 500-700")
        .max(700, "Heading font weight must be 500-700"),
    }),
    body: z.object({
      family: z.string().min(1, "Body font family is required"),
      weight: fontWeightSchema
        .min(400, "Body font weight must be 400-500")
        .max(500, "Body font weight must be 400-500"),
    }),
  }),

  colors: z.object({
    brand: hexColorSchema,
    accent: hexColorSchema,
    text: z.object({
      primary: hexColorSchema,
      secondary: hexColorSchema,
    }),
    surface: z.object({
      "1": hexColorSchema,
      "2": hexColorSchema,
    }),
    border: hexColorSchema,
    fill: hexColorSchema,
  }),

  radius: z.object({
    sm: radiusSchema,
    md: radiusSchema,
    lg: radiusSchema,
    xl: radiusSchema,
  }),

  shadow: z.object({
    e1: shadowSchema,
    e2: shadowSchema,
  }),

  // Optional semantic colors
  semantic: z
    .object({
      success: hexColorSchema,
      warning: hexColorSchema,
      error: hexColorSchema,
    })
    .optional(),

  // Optional assets
  assets: z
    .object({
      logo: z.string().optional(),
      banner: z.string().optional(),
    })
    .optional(),

  // Optional motion settings (for future use)
  motion: z
    .object({
      duration: z.string().optional(),
      easing: z.string().optional(),
    })
    .optional(),
});

export type ThemeConfig = z.infer<typeof themeSchema>;

// Validation function with detailed error reporting
export function validateTheme(
  data: unknown,
  brandSlug: string
): { success: true; data: ThemeConfig } | { success: false; errors: string[] } {
  try {
    const result = themeSchema.parse(data);

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((err: any) => {
        const path = err.path.join(".");

        return `${brandSlug}.${path}: ${err.message}`;
      });

      return { success: false, errors };
    }

    return {
      success: false,
      errors: [`${brandSlug}: Unknown validation error`],
    };
  }
}

// Default fallback theme (always valid)
export const defaultTheme: ThemeConfig = {
  meta: {
    name: "TopCoach Default",
    version: "1.0.0",
    description: "Default TopCoach theme with professional blue palette",
  },
  fonts: {
    heading: {
      family: "Inter, system-ui, sans-serif",
      weight: 600,
    },
    body: {
      family: "Inter, system-ui, sans-serif",
      weight: 400,
    },
  },
  colors: {
    brand: "#0ea5e9",
    accent: "#0284c7",
    text: {
      primary: "#0f172a",
      secondary: "#64748b",
    },
    surface: {
      "1": "#ffffff",
      "2": "#f8fafc",
    },
    border: "#e2e8f0",
    fill: "#f1f5f9",
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
  },
  shadow: {
    e1: "0 1px 2px rgba(0, 0, 0, 0.05)",
    e2: "0 4px 6px rgba(0, 0, 0, 0.07)",
  },
  semantic: {
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  assets: {
    logo: "/brands/default/logo.svg",
    banner: "/brands/default/banner.svg",
  },
};
