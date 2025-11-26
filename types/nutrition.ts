// TypeScript types for nutrition management system
// Matches database schema in supabase/migrations/018_create_nutrition_tables.sql

export interface NutritionPlan {
  id: string;
  tenant_host: string;
  client_id: string;
  trainer_id: string;
  name: string;
  start_date: string; // ISO date string
  status: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface NutritionDay {
  id: string;
  nutrition_plan_id: string;
  tenant_host: string;
  day_label: string;
  day_order: number;
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
  // Meal-level macros
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  calories: number; // kcal
  created_at: string;
  updated_at: string;
}

export interface NutritionIngredient {
  id: string;
  nutrition_meal_id: string;
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

export interface NutritionMealWithIngredients extends NutritionMeal {
  ingredients: NutritionIngredient[];
}

export interface NutritionPlanWithDays extends NutritionPlan {
  days: NutritionDayWithMeals[];
}

// API request types
export interface CreateNutritionPlanRequest {
  client_id: string;
  name: string;
  start_date?: string;
  status?: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
}

export interface UpdateNutritionPlanRequest {
  name?: string;
  start_date?: string;
  status?: "active" | "completed" | "paused" | "cancelled";
  notes?: string;
}

export interface CreateNutritionDayRequest {
  nutrition_plan_id: string;
  day_label: string;
  day_order?: number;
}

export interface UpdateNutritionDayRequest {
  day_label?: string;
  day_order?: number;
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
}

export interface CreateNutritionIngredientRequest {
  nutrition_meal_id: string;
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
export interface NutritionIngredientResponse
  extends NutritionApiResponse<NutritionIngredient> {}
