export type { FoodResult, FoodSource, NutrientsPer100g } from "./types";

export { MockFoodSource } from "./mock-food-source";
export type { MockFoodSourceConfig } from "./mock-food-source";

export { OpenFoodFactsSource } from "./open-food-facts-source";

export {
  SupabaseIngredientRepository,
  rowToFoodResult,
  foodResultToInsert,
} from "./ingredient-repository";
export type {
  IngredientRepository,
  IngredientRow,
  IngredientInsert,
  ManualIngredientInput,
} from "./ingredient-repository";

export {
  SupabaseCommonFoodsRepository,
  commonFoodToResult,
  normalizeFoodQuery,
} from "./common-foods-repository";
export type {
  CommonFoodsRepository,
  CommonFoodRow,
} from "./common-foods-repository";

export { FoodLookupService } from "./food-lookup-service";
export type { FoodLookupServiceDeps } from "./food-lookup-service";

export { createFoodSource } from "./create-food-source";
