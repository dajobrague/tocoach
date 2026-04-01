// TypeScript types for nutrition management system
// Matches database schema (nutrition tables + meal options migration)

export type NutritionPlanMode = "structured" | "pdf" | "hybrid";

export interface NutritionPlan {
  id: string;
  tenant_host: string;
  client_id: string | null; // Nullable for templates
  trainer_id: string;
  name: string;
  start_date: string; // ISO date string
  status: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
  is_template: boolean; // Whether this is a reusable template
  /** When false, clients do not see meal images (trainer can still manage them). */
  show_meal_images?: boolean;
  /** structured: solo comidas; pdf: solo PDF; hybrid: ambos */
  plan_mode?: NutritionPlanMode;
  pdf_url?: string | null;
  pdf_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionDay {
  id: string;
  nutrition_plan_id: string;
  tenant_host: string;
  day_label: string;
  day_order: number;
  // Day-level macros (can be manually set or calculated from meals)
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  calories: number; // kcal
  // Weekdays this nutrition day applies to (0=Sunday, 1=Monday, ..., 6=Saturday)
  // Can have multiple values for days that repeat multiple times per week
  weekdays: number[];
  created_at: string;
  updated_at: string;
}

export interface NutritionMeal {
  id: string;
  nutrition_day_id: string;
  tenant_host: string;
  label: string;
  meal_order: number;
  notes?: string;
  image_url?: string | null;
  /** True when the meal has more than one nutrition_meal_options row. */
  has_alternatives: boolean;
  // Meal-level macros
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  calories: number; // kcal
  created_at: string;
  updated_at: string;
}

export interface NutritionMealOption {
  id: string;
  meal_id: string;
  name: string;
  option_order: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  calories: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionIngredient {
  id: string;
  nutrition_meal_id: string;
  option_id: string;
  tenant_host: string;
  name: string;
  quantity: string;
  unit: string;
  ingredient_order: number;
  // Optional ingredient-level nutritional data
  protein?: number; // grams
  carbs?: number; // grams
  fats?: number; // grams
  calories?: number; // kcal
  created_at: string;
  updated_at: string;
}

// Nested structure for UI display
export interface NutritionDayWithMeals extends NutritionDay {
  meals: NutritionMealWithIngredients[];
}

export interface NutritionMealOptionWithIngredients
  extends NutritionMealOption {
  ingredients: NutritionIngredient[];
}

export interface NutritionMealWithIngredients extends NutritionMeal {
  options: NutritionMealOptionWithIngredients[];
  /** Flattened from all options; backwards compatibility for clients that read meal.ingredients only. */
  ingredients: NutritionIngredient[];
}

export interface NutritionPlanWithDays extends NutritionPlan {
  days: NutritionDayWithMeals[];
}

// Template-specific types
export interface NutritionTemplate extends NutritionPlan {
  is_template: true;
  client_id: null;
  dayCount?: number;
  mealCount?: number;
}

export interface CreateFromTemplateRequest {
  templateId: string;
  client_id: string;
  name: string;
  start_date?: string;
  notes?: string;
}

// API request types
export interface CreateNutritionPlanRequest {
  client_id?: string; // Optional when creating template
  name: string;
  start_date?: string;
  status?: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
  is_template?: boolean;
  templateId?: string; // For creating from template
}

export interface UpdateNutritionPlanRequest {
  name?: string;
  start_date?: string;
  status?: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
  show_meal_images?: boolean;
  plan_mode?: NutritionPlanMode;
}

export interface CreateNutritionDayRequest {
  nutrition_plan_id: string;
  day_label: string;
  day_order?: number;
  weekdays?: number[];
}

export interface UpdateNutritionDayRequest {
  day_label?: string;
  day_order?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  calories?: number;
  weekdays?: number[];
}

export interface CreateNutritionMealRequest {
  nutrition_day_id: string;
  label: string;
  meal_order?: number;
  notes?: string;
  protein?: number;
  carbs?: number;
  fats?: number;
  calories?: number;
}

export interface UpdateNutritionMealRequest {
  label?: string;
  meal_order?: number;
  notes?: string;
  protein?: number;
  carbs?: number;
  fats?: number;
  calories?: number;
  has_alternatives?: boolean;
}

export interface CreateNutritionMealOptionRequest {
  mealId: string;
  name: string;
}

export interface UpdateNutritionMealOptionRequest {
  name?: string;
  option_order?: number;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  calories?: number | null;
  image_url?: string | null;
}

export interface CreateNutritionIngredientRequest {
  /** Preferred: create under this option. */
  option_id?: string;
  optionId?: string;
  /** Legacy: uses the first option of the meal by option_order. */
  nutrition_meal_id?: string;
  mealId?: string;
  name: string;
  quantity: string;
  unit: string;
  ingredient_order?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  calories?: number;
}

export interface UpdateNutritionIngredientRequest {
  name?: string;
  quantity?: string;
  unit?: string;
  ingredient_order?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  calories?: number;
}

// API response types
export interface NutritionApiResponse<T> {
  data?: T;
  error?: string;
}

export interface NutritionPlansResponse
  extends NutritionApiResponse<NutritionPlanWithDays[]> {}
export interface NutritionPlanResponse
  extends NutritionApiResponse<NutritionPlanWithDays> {}
export interface NutritionDayResponse
  extends NutritionApiResponse<NutritionDay> {}
export interface NutritionMealResponse
  extends NutritionApiResponse<NutritionMeal> {}
export interface NutritionMealOptionResponse
  extends NutritionApiResponse<NutritionMealOption> {}
export interface NutritionIngredientResponse
  extends NutritionApiResponse<NutritionIngredient> {}
