"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from "react";

/**
 * Pick a sensible heading weight from a font's available weights.
 *
 * Strategy: prefer the LIGHTEST available weight that's still ≥ 600
 * (semibold). If the font doesn't support 600+, fall back to the heaviest
 * weight present. If `weights` is empty/undefined, default to 600.
 *
 * Example outputs (heading):
 *   [400, 600, 700]              → 600
 *   [300, 400, 500, 600, 700]    → 600  // Inter
 *   [300, 400, 500, 700]         → 700  // Roboto (no 600)
 *   [400, 700]                   → 700  // Merriweather
 *   [300, 400, 500]              → 500  // body-only font; pick heaviest
 *   []                           → 600
 */
export function pickHeadingWeight(weights: number[] | undefined): number {
  if (!weights || weights.length === 0) return 600;
  const heading = weights.filter((w) => w >= 600).sort((a, b) => a - b);

  if (heading.length > 0) return heading[0]!;

  // No bold-enough weight available — pick the heaviest we have.
  return Math.max(...weights);
}

/**
 * Pick a sensible body weight: prefer the heaviest available weight that's
 * still ≤ 500 (regular/medium). Fall back to the lightest weight if the
 * font doesn't support ≤ 500 (rare).
 *
 * Example outputs (body):
 *   [300, 400, 500, 600, 700]    → 500  // Inter
 *   [300, 400, 700]              → 400  // Lato
 *   [400]                        → 400
 *   [600, 700]                   → 600  // edge case
 *   []                           → 400
 */
export function pickBodyWeight(weights: number[] | undefined): number {
  if (!weights || weights.length === 0) return 400;
  const body = weights.filter((w) => w <= 500).sort((a, b) => b - a);

  if (body.length > 0) return body[0]!;

  // No regular-enough weight — pick the lightest we have.
  return Math.min(...weights);
}

// Types for the setup wizard state
export interface SetupWizardState {
  // Domain settings
  domain: {
    current: string;
    desired: string;
    isAvailable: boolean | null;
    isChecking: boolean;
    suggestions: string[];
  };

  // Brand colors
  colors: {
    // Brand colors
    primary: string;
    secondary: string;

    // Text colors
    text: {
      h1: string;
      h2: string;
      h3: string;
      body: string;
      muted: string;
    };

    // Background colors
    background: {
      primary: string;
      secondary: string;
      accent: string;
    };

    // Surface colors (cards, sections)
    surface: {
      "1": string;
      "2": string;
      "3": string;
    };

    // Button colors
    buttons: {
      primary: {
        bg: string;
        text: string;
        hover: string;
      };
      secondary: {
        bg: string;
        text: string;
        hover: string;
      };
    };

    // Shadow colors
    shadows: {
      light: string;
      medium: string;
      dark: string;
    };

    // Semantic colors
    semantic: {
      success: string;
      warning: string;
      danger: string;
    };
  };

  // Logo settings
  logo: {
    file: File | null;
    url: string | null;
    text: string;
    position: "left" | "center" | "right";
    size: "small" | "medium" | "large";
  };

  // Typography
  fonts: {
    heading: {
      family: string;
      weights: number[];
    };
    body: {
      family: string;
      weights: number[];
    };
  };

  // Wizard state
  currentStep: number;
  isLoading: boolean;
  errors: Record<string, string>;
}

// Action types
type SetupWizardAction =
  | { type: "SET_DOMAIN"; payload: { desired: string } }
  | {
      type: "SET_DOMAIN_AVAILABILITY";
      payload: { isAvailable: boolean; suggestions: string[] };
    }
  | { type: "SET_DOMAIN_CHECKING"; payload: boolean }
  | { type: "SET_PRIMARY_COLOR"; payload: string }
  | { type: "SET_SECONDARY_COLOR"; payload: string }
  | {
      type: "SET_TEXT_COLOR";
      payload: { type: "h1" | "h2" | "h3" | "body" | "muted"; color: string };
    }
  | {
      type: "SET_BACKGROUND_COLOR";
      payload: { type: "primary" | "secondary" | "accent"; color: string };
    }
  | {
      type: "SET_BUTTON_COLOR";
      payload: {
        button: "primary" | "secondary";
        property: "bg" | "text" | "hover";
        color: string;
      };
    }
  | {
      type: "SET_SHADOW_COLOR";
      payload: { type: "light" | "medium" | "dark"; color: string };
    }
  | { type: "SET_LOGO_FILE"; payload: File | null }
  | { type: "SET_LOGO_URL"; payload: string | null }
  | { type: "SET_LOGO_TEXT"; payload: string }
  | { type: "SET_LOGO_POSITION"; payload: "left" | "center" | "right" }
  | { type: "SET_LOGO_SIZE"; payload: "small" | "medium" | "large" }
  | { type: "SET_HEADING_FONT"; payload: { family: string; weights: number[] } }
  | { type: "SET_BODY_FONT"; payload: { family: string; weights: number[] } }
  | { type: "SET_STEP"; payload: number }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: { field: string; message: string } }
  | { type: "CLEAR_ERROR"; payload: string }
  | { type: "INITIALIZE_STATE"; payload: Partial<SetupWizardState> };

// Initial state
const initialState: SetupWizardState = {
  domain: {
    current: "",
    desired: "",
    isAvailable: null,
    isChecking: false,
    suggestions: [],
  },
  colors: {
    primary: "#3b82f6", // Default blue
    secondary: "#6366f1", // Default indigo

    text: {
      h1: "#1f2937", // Dark gray for main headings
      h2: "#374151", // Medium gray for subheadings
      h3: "#4b5563", // Lighter gray for smaller headings
      body: "#6b7280", // Body text
      muted: "#9ca3af", // Muted text
    },

    background: {
      primary: "#ffffff", // Main background
      secondary: "#f9fafb", // Section backgrounds
      accent: "#f3f4f6", // Accent backgrounds
    },

    surface: {
      "1": "#ffffff",
      "2": "#f8fafc",
      "3": "#f1f5f9",
    },

    buttons: {
      primary: {
        bg: "#3b82f6",
        text: "#ffffff",
        hover: "#2563eb",
      },
      secondary: {
        bg: "#f3f4f6",
        text: "#374151",
        hover: "#e5e7eb",
      },
    },

    shadows: {
      light: "rgba(0, 0, 0, 0.05)",
      medium: "rgba(0, 0, 0, 0.1)",
      dark: "rgba(0, 0, 0, 0.25)",
    },

    semantic: {
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    },
  },
  logo: {
    file: null,
    url: null,
    text: "",
    position: "left",
    size: "medium",
  },
  fonts: {
    heading: {
      family: "Poppins",
      weights: [400, 600, 700],
    },
    body: {
      family: "Inter",
      weights: [300, 400, 500],
    },
  },
  currentStep: 1,
  isLoading: false,
  errors: {},
};

// Helper function to generate surface colors from primary
function generateSurfaceColors(primaryColor: string) {
  // This is a simplified version - in production, you'd use a proper color manipulation library
  return {
    "1": "#ffffff",
    "2": "#f8fafc",
    "3": "#f1f5f9",
  };
}

// Reducer
function setupWizardReducer(
  state: SetupWizardState,
  action: SetupWizardAction
): SetupWizardState {
  switch (action.type) {
    case "INITIALIZE_STATE":
      return { ...state, ...action.payload };

    case "SET_DOMAIN":
      return {
        ...state,
        domain: { ...state.domain, desired: action.payload.desired },
      };

    case "SET_DOMAIN_AVAILABILITY":
      return {
        ...state,
        domain: {
          ...state.domain,
          isAvailable: action.payload.isAvailable,
          suggestions: action.payload.suggestions,
          isChecking: false,
        },
      };

    case "SET_DOMAIN_CHECKING":
      return {
        ...state,
        domain: { ...state.domain, isChecking: action.payload },
      };

    case "SET_PRIMARY_COLOR":
      return {
        ...state,
        colors: {
          ...state.colors,
          primary: action.payload,
          surface: generateSurfaceColors(action.payload),
        },
      };

    case "SET_SECONDARY_COLOR":
      return {
        ...state,
        colors: { ...state.colors, secondary: action.payload },
      };

    case "SET_TEXT_COLOR":
      return {
        ...state,
        colors: {
          ...state.colors,
          text: {
            ...state.colors.text,
            [action.payload.type]: action.payload.color,
          },
        },
      };

    case "SET_BACKGROUND_COLOR":
      return {
        ...state,
        colors: {
          ...state.colors,
          background: {
            ...state.colors.background,
            [action.payload.type]: action.payload.color,
          },
        },
      };

    case "SET_BUTTON_COLOR":
      return {
        ...state,
        colors: {
          ...state.colors,
          buttons: {
            ...state.colors.buttons,
            [action.payload.button]: {
              ...state.colors.buttons[action.payload.button],
              [action.payload.property]: action.payload.color,
            },
          },
        },
      };

    case "SET_SHADOW_COLOR":
      return {
        ...state,
        colors: {
          ...state.colors,
          shadows: {
            ...state.colors.shadows,
            [action.payload.type]: action.payload.color,
          },
        },
      };

    case "SET_LOGO_FILE":
      return {
        ...state,
        logo: { ...state.logo, file: action.payload },
      };

    case "SET_LOGO_URL":
      return {
        ...state,
        logo: { ...state.logo, url: action.payload },
      };

    case "SET_LOGO_TEXT":
      return {
        ...state,
        logo: { ...state.logo, text: action.payload },
      };

    case "SET_LOGO_POSITION":
      return {
        ...state,
        logo: { ...state.logo, position: action.payload },
      };

    case "SET_LOGO_SIZE":
      return {
        ...state,
        logo: { ...state.logo, size: action.payload },
      };

    case "SET_HEADING_FONT":
      return {
        ...state,
        fonts: { ...state.fonts, heading: action.payload },
      };

    case "SET_BODY_FONT":
      return {
        ...state,
        fonts: { ...state.fonts, body: action.payload },
      };

    case "SET_STEP":
      return { ...state, currentStep: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };

    case "CLEAR_ERROR":
      const newErrors = { ...state.errors };

      delete newErrors[action.payload];

      return { ...state, errors: newErrors };

    default:
      return state;
  }
}

// Context
const SetupWizardContext = createContext<{
  state: SetupWizardState;
  dispatch: React.Dispatch<SetupWizardAction>;
  actions: {
    setDomain: (domain: string) => void;
    checkDomainAvailability: (domain: string) => Promise<void>;
    saveDomain: (domain: string) => Promise<void>;
    setPrimaryColor: (color: string) => void;
    setSecondaryColor: (color: string) => void;
    setTextColor: (
      type: "h1" | "h2" | "h3" | "body" | "muted",
      color: string
    ) => void;
    setBackgroundColor: (
      type: "primary" | "secondary" | "accent",
      color: string
    ) => void;
    setButtonColor: (
      button: "primary" | "secondary",
      property: "bg" | "text" | "hover",
      color: string
    ) => void;
    setShadowColor: (type: "light" | "medium" | "dark", color: string) => void;
    setLogoFile: (file: File | null) => void;
    setLogoUrl: (url: string | null) => void;
    setLogoText: (text: string) => void;
    setLogoPosition: (position: "left" | "center" | "right") => void;
    setLogoSize: (size: "small" | "medium" | "large") => void;
    setHeadingFont: (family: string, weights: number[]) => void;
    setBodyFont: (family: string, weights: number[]) => void;
    nextStep: () => void;
    prevStep: () => void;
    setStep: (step: number) => void;
    saveConfiguration: () => Promise<void>;
  };
} | null>(null);

// Provider component
export function SetupWizardProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Partial<SetupWizardState>;
}) {
  const [state, dispatch] = useReducer(setupWizardReducer, {
    ...initialState,
    ...initialData,
  });

  // Action creators
  const setDomain = useCallback((domain: string) => {
    dispatch({ type: "SET_DOMAIN", payload: { desired: domain } });
  }, []);

  const checkDomainAvailability = useCallback(async (domain: string) => {
    dispatch({ type: "SET_DOMAIN_CHECKING", payload: true });

    try {
      const response = await fetch("/api/setup/check-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const result = await response.json();

      dispatch({
        type: "SET_DOMAIN_AVAILABILITY",
        payload: {
          isAvailable: result.isAvailable,
          suggestions: result.suggestions || [],
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "domain",
          message: "Error al verificar disponibilidad",
        },
      });
    }
  }, []);

  const saveDomain = useCallback(async (domain: string) => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const response = await fetch("/api/setup/save-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al guardar el dominio");
      }

      // Clear any previous errors
      dispatch({ type: "CLEAR_ERROR", payload: "domain" });

      console.log("[Setup Wizard] Domain saved successfully:", domain);
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "domain",
          message:
            error instanceof Error
              ? error.message
              : "Error al guardar el dominio",
        },
      });
      throw error; // Re-throw to handle in component
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    dispatch({ type: "SET_PRIMARY_COLOR", payload: color });
  }, []);

  const setSecondaryColor = useCallback((color: string) => {
    dispatch({ type: "SET_SECONDARY_COLOR", payload: color });
  }, []);

  const setTextColor = useCallback(
    (type: "h1" | "h2" | "h3" | "body" | "muted", color: string) => {
      dispatch({ type: "SET_TEXT_COLOR", payload: { type, color } });
    },
    []
  );

  const setBackgroundColor = useCallback(
    (type: "primary" | "secondary" | "accent", color: string) => {
      dispatch({ type: "SET_BACKGROUND_COLOR", payload: { type, color } });
    },
    []
  );

  const setButtonColor = useCallback(
    (
      button: "primary" | "secondary",
      property: "bg" | "text" | "hover",
      color: string
    ) => {
      dispatch({
        type: "SET_BUTTON_COLOR",
        payload: { button, property, color },
      });
    },
    []
  );

  const setShadowColor = useCallback(
    (type: "light" | "medium" | "dark", color: string) => {
      dispatch({ type: "SET_SHADOW_COLOR", payload: { type, color } });
    },
    []
  );

  const setLogoFile = useCallback((file: File | null) => {
    dispatch({ type: "SET_LOGO_FILE", payload: file });
  }, []);

  const setLogoUrl = useCallback((url: string | null) => {
    dispatch({ type: "SET_LOGO_URL", payload: url });
  }, []);

  const setLogoText = useCallback((text: string) => {
    dispatch({ type: "SET_LOGO_TEXT", payload: text });
  }, []);

  const setLogoPosition = useCallback(
    (position: "left" | "center" | "right") => {
      dispatch({ type: "SET_LOGO_POSITION", payload: position });
    },
    []
  );

  const setLogoSize = useCallback((size: "small" | "medium" | "large") => {
    dispatch({ type: "SET_LOGO_SIZE", payload: size });
  }, []);

  const setHeadingFont = useCallback((family: string, weights: number[]) => {
    dispatch({ type: "SET_HEADING_FONT", payload: { family, weights } });
  }, []);

  const setBodyFont = useCallback((family: string, weights: number[]) => {
    dispatch({ type: "SET_BODY_FONT", payload: { family, weights } });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: "SET_STEP", payload: state.currentStep + 1 });
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    dispatch({ type: "SET_STEP", payload: Math.max(1, state.currentStep - 1) });
  }, [state.currentStep]);

  const setStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", payload: Math.max(1, Math.min(5, step)) });
  }, []);

  const saveConfiguration = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Build theme JSON matching database schema requirements
      const themeJson = {
        // Meta information
        meta: {
          name: state.logo.text || "Mi Plataforma",
          version: "1.0.0",
          description: `${state.logo.text || "Mi Plataforma"} - Plataforma de Coaching`,
          domain: state.domain.desired,
          logoUrl: state.logo.url,
          logoText: state.logo.text,
        },

        // Fonts configuration (required by DB)
        //
        // Pick the lightest available weight ≥ 600 for headings, and ≤ 500
        // for body. The previous code used `weights[1]` as a positional
        // shortcut, which broke for fonts whose weight arrays don't start
        // with a heading-appropriate value: e.g. Roboto's `[300, 400, 500,
        // 700]` and Inter's `[300, 400, 500, 600, 700]` both yielded
        // `weights[1] === 400` — a body weight, not a heading weight. The
        // saved heading.weight then failed schema validation (which used
        // to require 500-700) and the tenant fell back to the default
        // TopCoach theme without anyone noticing. The `pickWeight` helpers
        // below pick semantically correct defaults for ANY weights array.
        fonts: {
          heading: {
            family: `${state.fonts.heading.family}, system-ui, sans-serif`,
            weight: pickHeadingWeight(state.fonts.heading.weights),
          },
          body: {
            family: `${state.fonts.body.family}, system-ui, sans-serif`,
            weight: pickBodyWeight(state.fonts.body.weights),
          },
        },

        // Colors configuration (required by DB)
        // Map our detailed color structure to DB format
        colors: {
          // Main brand colors
          brand: state.colors.primary,
          accent: state.colors.secondary,

          // Text colors
          text: {
            primary: state.colors.text.h1,
            secondary: state.colors.text.body,
            muted: state.colors.text.muted,
          },

          // Surface/background colors
          surface: {
            "1": state.colors.background.primary,
            "2": state.colors.background.secondary,
            "3": state.colors.background.accent,
          },

          // Border and fill colors
          border: state.colors.text.muted,
          fill: state.colors.background.accent,

          // Button colors (custom extension)
          buttons: {
            primary: {
              bg: state.colors.buttons.primary.bg,
              text: state.colors.buttons.primary.text,
              hover: state.colors.buttons.primary.hover,
            },
            secondary: {
              bg: state.colors.buttons.secondary.bg,
              text: state.colors.buttons.secondary.text,
              hover: state.colors.buttons.secondary.hover,
            },
          },
        },

        // Radius configuration (required by DB)
        radius: {
          sm: 6,
          md: 8,
          lg: 12,
          xl: 16,
        },

        // Shadow configuration (required by DB)
        shadow: {
          e1: `0 1px 2px ${state.colors.shadows.light}`,
          e2: `0 2px 4px ${state.colors.shadows.medium}`,
          e3: `0 10px 25px ${state.colors.shadows.dark}`,
        },

        // Semantic colors
        semantic: {
          success: state.colors.semantic.success,
          warning: state.colors.semantic.warning,
          error: state.colors.semantic.danger,
        },

        // Logo configuration (custom extension)
        logo: {
          position: state.logo.position,
          size: state.logo.size,
          url: state.logo.url,
          text: state.logo.text,
        },

        // Typography details (custom extension for weights)
        typography: {
          heading: {
            weights: state.fonts.heading.weights,
          },
          body: {
            weights: state.fonts.body.weights,
          },
        },
      };

      console.log("[Setup Wizard] Saving configuration:", {
        domain: state.domain.desired,
        themeKeys: Object.keys(themeJson),
      });

      const response = await fetch("/api/setup/save-configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: state.domain.desired,
          themeJson,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al guardar la configuración");
      }

      console.log("[Setup Wizard] Configuration saved successfully");

      // Clear localStorage to prevent redirect loop
      if (typeof window !== "undefined") {
        localStorage.removeItem("activeSection");
        localStorage.setItem("activeSection", "metricas");
      }

      // Add a completion flag to prevent redirect loop
      // The dashboard will see this and not redirect back to setup
      window.location.href = "/trainer/dashboard?setup=completed";
    } catch (error) {
      console.error("[Setup Wizard] Save error:", error);
      dispatch({
        type: "SET_ERROR",
        payload: {
          field: "save",
          message: error instanceof Error ? error.message : "Error al guardar",
        },
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state]);

  const actions = {
    setDomain,
    checkDomainAvailability,
    saveDomain,
    setPrimaryColor,
    setSecondaryColor,
    setTextColor,
    setBackgroundColor,
    setButtonColor,
    setShadowColor,
    setLogoFile,
    setLogoUrl,
    setLogoText,
    setLogoPosition,
    setLogoSize,
    setHeadingFont,
    setBodyFont,
    nextStep,
    prevStep,
    setStep,
    saveConfiguration,
  };

  return (
    <SetupWizardContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SetupWizardContext.Provider>
  );
}

// Custom hook to use the setup wizard context
export function useSetupWizard() {
  const context = useContext(SetupWizardContext);

  if (!context) {
    throw new Error("useSetupWizard must be used within a SetupWizardProvider");
  }

  return context;
}
