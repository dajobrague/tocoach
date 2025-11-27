// Mock data for client profile - for demo purposes only

export interface MockClient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  nickName?: string;
  email: string;
  avatar?: string;
  status: string;
  joinedDate: string;
  age: number | null;
  occupation: string;
  goals: string[];
  phone?: string;
  dob?: string;
  nationalId?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
}

export interface MockWorkoutExercise {
  order: number;
  name: string;
  sets: number;
  reps: string;
  tempo: string;
  rest: string;
  trainingSystem: string;
  videoUrl?: string;
  systemVideoUrl?: string;
}

export interface MockWorkoutSession {
  id: string;
  dayOfWeek: "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom";
  name: string;
  completed: boolean;
  exercises: MockWorkoutExercise[];
}

export interface MockWorkoutProgram {
  id: string;
  name: string;
  type: "Strength" | "HIIT" | "Functional" | "Hypertrophy";
  division: string; // "Full Body", "Upper/Lower", "Push/Pull/Legs", etc.
  currentWeek: string; // "Semana 20"
  sessionsPerWeek: number;
  assignedDate: string;
  lastModified: string;
  progress: number;
  status: "active" | "completed";
  sessions: MockWorkoutSession[];
}

export interface MockCardioExercise {
  order: number;
  name: string;
  type:
    | "Running"
    | "Cycling"
    | "Swimming"
    | "Walking"
    | "Rowing"
    | "HIIT"
    | "Elliptical"
    | "Stairmaster";
  duration?: number; // minutos
  distance?: number; // km
  intensity: "Low" | "Moderate" | "High" | "Interval";
  targetHeartRate?: { min: number; max: number };
  notes?: string;
}

export interface MockCardioSession {
  id: string;
  dayOfWeek: "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom";
  name: string;
  completed: boolean;
  exercises: MockCardioExercise[];
}

export interface MockCardioProgram {
  id: string;
  name: string;
  type: "Endurance" | "HIIT" | "Mixed" | "Fat Loss";
  goal: string;
  currentWeek: string;
  sessionsPerWeek: number;
  assignedDate: string;
  lastModified: string;
  progress: number;
  status: "active" | "completed";
  sessions: MockCardioSession[];
}

export interface MockNutritionIngredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  // Nutritional information per ingredient (total for the quantity specified)
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  calories: number; // kcal
}

export interface MockNutritionMeal {
  id: string;
  label: string; // "Meal 1", "Breakfast", "Snack", etc.
  ingredients: MockNutritionIngredient[];
  notes?: string;
}

export interface MockNutritionDay {
  id: string;
  dayLabel: string; // "Día 1", "Lunes", etc.
  meals: MockNutritionMeal[];
}

export interface MockNutritionPlan {
  id: string;
  name: string;
  startDate: string;
  status: "active" | "completed";
  days: MockNutritionDay[];
  notes?: string;
}

export interface MockSupplement {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  notes?: string;
}

export interface MockCheckIn {
  id: string;
  date: string;
  frequency: "weekly" | "biweekly" | "monthly";
  weight?: number;
  energy: 1 | 2 | 3 | 4 | 5;
  sleep: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  mood: 1 | 2 | 3 | 4 | 5;
  progressNotes: string;
  challenges: string;
  achievements: string;
}

export interface MockDailyHabit {
  date: string;
  steps?: number;
  sleepHours?: number;
  sunExposure?: number; // minutos
  weight?: number;
  waterIntake?: number; // vasos
  mood?: 1 | 2 | 3 | 4 | 5;
}

export interface MockProgressPhoto {
  id: string;
  date: string;
  angle: "front" | "side" | "back";
  url: string;
  notes?: string;
}

export interface MockProgressPhotoSession {
  id: string;
  date: string;
  photos: MockProgressPhoto[];
}

export interface MockCalendarEvent {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  time?: string; // Time in HH:MM format
  type:
    | "workout"
    | "cardio"
    | "meeting"
    | "check-in"
    | "rest"
    | "nutrition-prep";
  title: string;
  description?: string;
  status: "scheduled" | "completed" | "missed" | "in-progress";
  duration?: number; // minutes
  relatedProgram?: string; // reference to program ID
  sessionId?: string; // reference to session ID
  notes?: string;
  reminder?: boolean;
}

// Sample client data
export const getMockClientById = (clientId: string): MockClient => {
  // For demo, we return a sample client. In a real app, this would fetch from database
  return {
    id: clientId,
    name: "Carlos Ramirez",
    firstName: "Carlos",
    lastName: "Ramirez",
    email: "carlos.ramirez@email.com",
    status: "Activo",
    joinedDate: "2024-03-15",
    age: 32,
    occupation: "Software Engineer",
    goals: [
      "Ganar masa muscular",
      "Mejorar resistencia",
      "Mantener un estilo de vida saludable",
    ],
    phone: "+34 600 123 456",
    location: {
      city: "Madrid",
      country: "España",
    },
  };
};

// Mock workout programs
export const getMockWorkoutPrograms = (
  clientId: string
): MockWorkoutProgram[] => {
  return [
    {
      id: "prog-1",
      name: "Full Body - Carlos Ramirez",
      type: "Strength",
      division: "Full Body",
      currentWeek: "Semana 20",
      sessionsPerWeek: 2,
      assignedDate: "2025-01-06",
      lastModified: "2025-04-07",
      progress: 62,
      status: "active",
      sessions: [
        {
          id: "session-1",
          dayOfWeek: "Lun",
          name: "Full Body A",
          completed: true,
          exercises: [
            {
              order: 1,
              name: "Sentadilla Hack",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-sentadilla-hack",
            },
            {
              order: 2,
              name: "Press De Banca Plano Con Barra",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-press-banca",
            },
            {
              order: 3,
              name: "Remo con Barra",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-remo",
            },
            {
              order: 4,
              name: "Curl Femoral Sentado",
              sets: 4,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-curl-femoral",
            },
            {
              order: 5,
              name: "Curl De Bíceps Con Mancuernas En Banco Inclinado",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-curl-biceps",
            },
            {
              order: 6,
              name: "Elevaciones Laterales con Mancuernas de Pie",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-elevaciones-laterales",
            },
            {
              order: 7,
              name: "Encogimientos De Abdomen En Polea",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-encogimientos",
            },
          ],
        },
        {
          id: "session-2",
          dayOfWeek: "Jue",
          name: "Full Body B",
          completed: false,
          exercises: [
            {
              order: 1,
              name: "Peso Muerto Convencional Deadstop",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-peso-muerto",
            },
            {
              order: 2,
              name: "Press Militar con Barra de Pie",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-press-militar",
            },
            {
              order: 3,
              name: "Dominadas con Agarre Neutro",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-dominadas",
            },
            {
              order: 4,
              name: "Sentadilla Búlgara con Mancuernas",
              sets: 4,
              reps: "8",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Series Rectas",
              videoUrl: "https://example.com/video-sentadilla-bulgara",
            },
            {
              order: 5,
              name: "Press Francés con Barra en Banco",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-press-frances",
            },
            {
              order: 6,
              name: "Extensiones de Tobillo en Prensa",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-extensiones-tobillo",
            },
            {
              order: 7,
              name: "Elevación De Rodillas Colgado",
              sets: 3,
              reps: "30",
              tempo: "Pausa Final Excéntrica y Concéntrica",
              rest: "El necesario para rendir al 100%",
              trainingSystem: "Repeticiones Totales",
              videoUrl: "https://example.com/video-elevacion-rodillas",
            },
          ],
        },
      ],
    },
    {
      id: "prog-2",
      name: "Hypertrophy Program",
      type: "Hypertrophy",
      division: "Push/Pull/Legs",
      currentWeek: "Completado",
      sessionsPerWeek: 5,
      assignedDate: "2024-06-01",
      lastModified: "2024-09-15",
      progress: 100,
      status: "completed",
      sessions: [],
    },
  ];
};

// Mock cardio programs
export const getMockCardioPrograms = (
  clientId: string
): MockCardioProgram[] => {
  return [
    {
      id: "cardio-prog-1",
      name: "Cardiovascular Base - Carlos Ramirez",
      type: "Endurance",
      goal: "Mejorar resistencia cardiovascular y quemar grasa",
      currentWeek: "Semana 8",
      sessionsPerWeek: 3,
      assignedDate: "2025-08-20",
      lastModified: "2025-10-10",
      progress: 55,
      status: "active",
      sessions: [
        {
          id: "cardio-session-1",
          dayOfWeek: "Mar",
          name: "Cardio Ligero - Recuperación",
          completed: true,
          exercises: [
            {
              order: 1,
              name: "Caminata Ligera",
              type: "Walking",
              duration: 30,
              distance: 3,
              intensity: "Low",
              targetHeartRate: { min: 100, max: 120 },
              notes: "Ritmo cómodo, conversacional. Enfocarse en respiración.",
            },
            {
              order: 2,
              name: "Bicicleta Estática",
              type: "Cycling",
              duration: 20,
              intensity: "Moderate",
              targetHeartRate: { min: 120, max: 135 },
              notes: "Resistencia baja-media. Mantener cadencia constante.",
            },
          ],
        },
        {
          id: "cardio-session-2",
          dayOfWeek: "Jue",
          name: "HIIT - Alta Intensidad",
          completed: false,
          exercises: [
            {
              order: 1,
              name: "Calentamiento en Caminadora",
              type: "Running",
              duration: 5,
              intensity: "Low",
              notes: "Ritmo suave para preparar el cuerpo.",
            },
            {
              order: 2,
              name: "Intervalos Sprint/Caminar",
              type: "HIIT",
              duration: 20,
              intensity: "Interval",
              targetHeartRate: { min: 160, max: 180 },
              notes: "30 seg sprint + 90 seg caminar. Repetir 10 veces.",
            },
            {
              order: 3,
              name: "Enfriamiento Caminando",
              type: "Walking",
              duration: 5,
              intensity: "Low",
              notes: "Bajar pulsaciones gradualmente.",
            },
          ],
        },
        {
          id: "cardio-session-3",
          dayOfWeek: "Sab",
          name: "Cardio Moderado - Resistencia",
          completed: false,
          exercises: [
            {
              order: 1,
              name: "Carrera Continua",
              type: "Running",
              duration: 40,
              distance: 5.5,
              intensity: "Moderate",
              targetHeartRate: { min: 135, max: 150 },
              notes:
                "Mantener ritmo constante. Deberías poder mantener una conversación breve.",
            },
          ],
        },
      ],
    },
  ];
};

// Mock nutrition plan
export const getMockNutritionPlan = (clientId: string): MockNutritionPlan => {
  return {
    id: "nutrition-1",
    name: "Plan Nutricional - Carlos Ramirez",
    startDate: "2024-09-15",
    status: "active",
    days: [
      {
        id: "day-1",
        dayLabel: "Lunes",
        meals: [
          {
            id: "meal-1",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-1",
                name: "Huevo",
                quantity: "4",
                unit: "medianos",
                protein: 24,
                carbs: 2,
                fats: 20,
                calories: 280,
              },
              {
                id: "ing-2",
                name: "Espinacas",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 1,
                fats: 0,
                calories: 7,
              },
              {
                id: "ing-3",
                name: "Pan integral",
                quantity: "2",
                unit: "rebanadas",
                protein: 8,
                carbs: 30,
                fats: 2,
                calories: 160,
              },
              {
                id: "ing-4",
                name: "Aceite de oliva",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 0,
                fats: 14,
                calories: 119,
              },
            ],
            notes: "Revuelto de huevo con espinacas y tostadas integrales",
          },
          {
            id: "meal-2",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-5",
                name: "Salmón a la parrilla",
                quantity: "170",
                unit: "g",
                protein: 34,
                carbs: 0,
                fats: 17,
                calories: 309,
              },
              {
                id: "ing-6",
                name: "Arroz integral cocido",
                quantity: "1",
                unit: "taza",
                protein: 5,
                carbs: 45,
                fats: 2,
                calories: 216,
              },
              {
                id: "ing-7",
                name: "Brócoli al vapor",
                quantity: "1",
                unit: "taza",
                protein: 3,
                carbs: 6,
                fats: 0,
                calories: 31,
              },
              {
                id: "ing-8",
                name: "Tomates cherry",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 6,
                fats: 0,
                calories: 27,
              },
            ],
          },
          {
            id: "meal-3",
            label: "Comida 3 - Snack",
            ingredients: [
              {
                id: "ing-9",
                name: "Proteína Whey",
                quantity: "30",
                unit: "g",
                protein: 24,
                carbs: 3,
                fats: 1,
                calories: 120,
              },
              {
                id: "ing-10",
                name: "Leche de almendras",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 2,
                fats: 3,
                calories: 39,
              },
              {
                id: "ing-11",
                name: "Plátano",
                quantity: "1",
                unit: "mediano",
                protein: 1,
                carbs: 27,
                fats: 0,
                calories: 105,
              },
            ],
          },
          {
            id: "meal-4",
            label: "Comida 4 - Cena",
            ingredients: [
              {
                id: "ing-12",
                name: "Pechuga de pollo a la parrilla",
                quantity: "170",
                unit: "g",
                protein: 53,
                carbs: 0,
                fats: 6,
                calories: 281,
              },
              {
                id: "ing-13",
                name: "Hojas verdes mixtas",
                quantity: "2",
                unit: "tazas",
                protein: 2,
                carbs: 4,
                fats: 0,
                calories: 18,
              },
              {
                id: "ing-14",
                name: "Aguacate",
                quantity: "0.5",
                unit: "mediano",
                protein: 2,
                carbs: 9,
                fats: 15,
                calories: 161,
              },
              {
                id: "ing-15",
                name: "Vinagre balsámico",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 3,
                fats: 0,
                calories: 14,
              },
            ],
            notes: "Ensalada de pollo con aguacate",
          },
        ],
      },
      {
        id: "day-2",
        dayLabel: "Martes",
        meals: [
          {
            id: "meal-5",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-16",
                name: "Avena",
                quantity: "100",
                unit: "g",
                protein: 13,
                carbs: 67,
                fats: 7,
                calories: 389,
              },
              {
                id: "ing-17",
                name: "Mantequilla de almendras",
                quantity: "2",
                unit: "cda",
                protein: 7,
                carbs: 6,
                fats: 18,
                calories: 196,
              },
              {
                id: "ing-18",
                name: "Arándanos",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 21,
                fats: 0,
                calories: 84,
              },
              {
                id: "ing-19",
                name: "Miel",
                quantity: "1",
                unit: "cdta",
                protein: 0,
                carbs: 6,
                fats: 0,
                calories: 21,
              },
            ],
          },
          {
            id: "meal-6",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-20",
                name: "Pechuga de pavo",
                quantity: "150",
                unit: "g",
                protein: 45,
                carbs: 0,
                fats: 3,
                calories: 207,
              },
              {
                id: "ing-21",
                name: "Quinoa cocida",
                quantity: "1",
                unit: "taza",
                protein: 8,
                carbs: 39,
                fats: 4,
                calories: 222,
              },
              {
                id: "ing-22",
                name: "Espárragos",
                quantity: "8",
                unit: "unidades",
                protein: 2,
                carbs: 4,
                fats: 0,
                calories: 20,
              },
              {
                id: "ing-23",
                name: "Jugo de limón",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 1,
                fats: 0,
                calories: 3,
              },
            ],
          },
          {
            id: "meal-7",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-24",
                name: "Solomillo de res",
                quantity: "200",
                unit: "g",
                protein: 52,
                carbs: 0,
                fats: 14,
                calories: 344,
              },
              {
                id: "ing-25",
                name: "Camote",
                quantity: "1",
                unit: "mediano",
                protein: 2,
                carbs: 24,
                fats: 0,
                calories: 103,
              },
              {
                id: "ing-26",
                name: "Ejotes",
                quantity: "1",
                unit: "taza",
                protein: 2,
                carbs: 8,
                fats: 0,
                calories: 31,
              },
            ],
          },
        ],
      },
      {
        id: "day-3",
        dayLabel: "Miércoles",
        meals: [
          {
            id: "meal-8",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-27",
                name: "Yogurt griego",
                quantity: "200",
                unit: "g",
                protein: 20,
                carbs: 10,
                fats: 10,
                calories: 210,
              },
              {
                id: "ing-28",
                name: "Granola",
                quantity: "50",
                unit: "g",
                protein: 5,
                carbs: 35,
                fats: 10,
                calories: 245,
              },
              {
                id: "ing-29",
                name: "Fresas",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 12,
                fats: 0,
                calories: 49,
              },
            ],
          },
          {
            id: "meal-9",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-30",
                name: "Filete de atún",
                quantity: "170",
                unit: "g",
                protein: 40,
                carbs: 0,
                fats: 2,
                calories: 184,
              },
              {
                id: "ing-31",
                name: "Arroz blanco cocido",
                quantity: "1",
                unit: "taza",
                protein: 4,
                carbs: 45,
                fats: 0,
                calories: 205,
              },
              {
                id: "ing-32",
                name: "Zanahorias",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 12,
                fats: 0,
                calories: 52,
              },
            ],
          },
          {
            id: "meal-10",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-33",
                name: "Lomo de cerdo",
                quantity: "180",
                unit: "g",
                protein: 45,
                carbs: 0,
                fats: 8,
                calories: 260,
              },
              {
                id: "ing-34",
                name: "Coles de Bruselas",
                quantity: "1",
                unit: "taza",
                protein: 3,
                carbs: 8,
                fats: 0,
                calories: 38,
              },
              {
                id: "ing-35",
                name: "Aceite de oliva",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 0,
                fats: 14,
                calories: 119,
              },
            ],
          },
        ],
      },
      {
        id: "day-4",
        dayLabel: "Jueves",
        meals: [
          {
            id: "meal-11",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-36",
                name: "Claras de huevo",
                quantity: "6",
                unit: "grandes",
                protein: 21,
                carbs: 1,
                fats: 0,
                calories: 102,
              },
              {
                id: "ing-37",
                name: "Hotcakes integrales",
                quantity: "2",
                unit: "medianos",
                protein: 6,
                carbs: 40,
                fats: 4,
                calories: 220,
              },
              {
                id: "ing-38",
                name: "Miel de maple",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 13,
                fats: 0,
                calories: 52,
              },
            ],
          },
          {
            id: "meal-12",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-39",
                name: "Muslo de pollo a la parrilla",
                quantity: "200",
                unit: "g",
                protein: 46,
                carbs: 0,
                fats: 14,
                calories: 318,
              },
              {
                id: "ing-40",
                name: "Cuscús",
                quantity: "1",
                unit: "taza",
                protein: 6,
                carbs: 36,
                fats: 0,
                calories: 176,
              },
              {
                id: "ing-41",
                name: "Pimientos",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 9,
                fats: 0,
                calories: 39,
              },
            ],
          },
          {
            id: "meal-13",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-42",
                name: "Filete de bacalao",
                quantity: "170",
                unit: "g",
                protein: 38,
                carbs: 0,
                fats: 2,
                calories: 174,
              },
              {
                id: "ing-43",
                name: "Puré de papa",
                quantity: "1",
                unit: "taza",
                protein: 4,
                carbs: 35,
                fats: 4,
                calories: 200,
              },
              {
                id: "ing-44",
                name: "Calabacín",
                quantity: "1",
                unit: "taza",
                protein: 1,
                carbs: 4,
                fats: 0,
                calories: 20,
              },
            ],
          },
        ],
      },
      {
        id: "day-5",
        dayLabel: "Viernes",
        meals: [
          {
            id: "meal-14",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-45",
                name: "Batido de proteína",
                quantity: "1",
                unit: "porción",
                protein: 25,
                carbs: 35,
                fats: 5,
                calories: 285,
              },
              {
                id: "ing-46",
                name: "Mantequilla de maní",
                quantity: "1",
                unit: "cda",
                protein: 4,
                carbs: 3,
                fats: 8,
                calories: 94,
              },
            ],
          },
          {
            id: "meal-15",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-47",
                name: "Carne molida magra",
                quantity: "200",
                unit: "g",
                protein: 40,
                carbs: 0,
                fats: 20,
                calories: 340,
              },
              {
                id: "ing-48",
                name: "Pasta integral",
                quantity: "60",
                unit: "g",
                protein: 8,
                carbs: 40,
                fats: 2,
                calories: 210,
              },
              {
                id: "ing-49",
                name: "Salsa de tomate",
                quantity: "0.5",
                unit: "taza",
                protein: 2,
                carbs: 10,
                fats: 1,
                calories: 50,
              },
            ],
          },
          {
            id: "meal-16",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-50",
                name: "Camarones",
                quantity: "170",
                unit: "g",
                protein: 35,
                carbs: 1,
                fats: 2,
                calories: 168,
              },
              {
                id: "ing-51",
                name: "Arroz de coliflor",
                quantity: "2",
                unit: "tazas",
                protein: 4,
                carbs: 10,
                fats: 0,
                calories: 50,
              },
              {
                id: "ing-52",
                name: "Mantequilla",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 0,
                fats: 12,
                calories: 102,
              },
            ],
          },
        ],
      },
      {
        id: "day-6",
        dayLabel: "Sábado",
        meals: [
          {
            id: "meal-17",
            label: "Comida 1 - Desayuno",
            ingredients: [
              {
                id: "ing-53",
                name: "Huevos revueltos",
                quantity: "3",
                unit: "grandes",
                protein: 18,
                carbs: 2,
                fats: 15,
                calories: 210,
              },
              {
                id: "ing-54",
                name: "Tostada con aguacate",
                quantity: "1",
                unit: "rebanada",
                protein: 6,
                carbs: 20,
                fats: 12,
                calories: 210,
              },
            ],
          },
          {
            id: "meal-18",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-55",
                name: "Cordero a la parrilla",
                quantity: "170",
                unit: "g",
                protein: 42,
                carbs: 0,
                fats: 18,
                calories: 330,
              },
              {
                id: "ing-56",
                name: "Vegetales asados",
                quantity: "2",
                unit: "tazas",
                protein: 4,
                carbs: 20,
                fats: 5,
                calories: 140,
              },
            ],
          },
          {
            id: "meal-19",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-57",
                name: "Pollo al horno",
                quantity: "170",
                unit: "g",
                protein: 53,
                carbs: 0,
                fats: 6,
                calories: 281,
              },
              {
                id: "ing-58",
                name: "Ensalada de espinacas",
                quantity: "2",
                unit: "tazas",
                protein: 2,
                carbs: 4,
                fats: 0,
                calories: 20,
              },
              {
                id: "ing-59",
                name: "Aderezo balsámico",
                quantity: "2",
                unit: "cda",
                protein: 0,
                carbs: 6,
                fats: 0,
                calories: 28,
              },
            ],
          },
        ],
      },
      {
        id: "day-7",
        dayLabel: "Domingo",
        meals: [
          {
            id: "meal-20",
            label: "Comida 1 - Brunch",
            ingredients: [
              {
                id: "ing-60",
                name: "Tostadas francesas",
                quantity: "2",
                unit: "rebanadas",
                protein: 10,
                carbs: 40,
                fats: 8,
                calories: 272,
              },
              {
                id: "ing-61",
                name: "Salchicha de pavo",
                quantity: "2",
                unit: "piezas",
                protein: 14,
                carbs: 2,
                fats: 8,
                calories: 140,
              },
              {
                id: "ing-62",
                name: "Jugo de naranja",
                quantity: "1",
                unit: "taza",
                protein: 2,
                carbs: 26,
                fats: 0,
                calories: 112,
              },
            ],
          },
          {
            id: "meal-21",
            label: "Comida 2 - Almuerzo",
            ingredients: [
              {
                id: "ing-63",
                name: "Filete de res",
                quantity: "225",
                unit: "g",
                protein: 62,
                carbs: 0,
                fats: 24,
                calories: 480,
              },
              {
                id: "ing-64",
                name: "Papa al horno",
                quantity: "1",
                unit: "grande",
                protein: 4,
                carbs: 37,
                fats: 0,
                calories: 164,
              },
              {
                id: "ing-65",
                name: "Crema ácida",
                quantity: "2",
                unit: "cda",
                protein: 1,
                carbs: 1,
                fats: 5,
                calories: 51,
              },
            ],
          },
          {
            id: "meal-22",
            label: "Comida 3 - Cena",
            ingredients: [
              {
                id: "ing-66",
                name: "Pescado a la parrilla",
                quantity: "170",
                unit: "g",
                protein: 36,
                carbs: 0,
                fats: 5,
                calories: 200,
              },
              {
                id: "ing-67",
                name: "Brócoli al vapor",
                quantity: "2",
                unit: "tazas",
                protein: 6,
                carbs: 12,
                fats: 0,
                calories: 62,
              },
              {
                id: "ing-68",
                name: "Salsa de mantequilla con limón",
                quantity: "1",
                unit: "cda",
                protein: 0,
                carbs: 0,
                fats: 12,
                calories: 102,
              },
            ],
          },
        ],
      },
    ],
    notes:
      "Plan diseñado para ganar masa muscular de forma controlada. Ajustar porciones según progreso.",
  };
};

// Helper functions to calculate nutritional totals
export interface NutritionTotals {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
}

export const calculateMealTotals = (
  meal: MockNutritionMeal
): NutritionTotals => {
  return meal.ingredients.reduce(
    (totals, ingredient) => ({
      protein: totals.protein + ingredient.protein,
      carbs: totals.carbs + ingredient.carbs,
      fats: totals.fats + ingredient.fats,
      calories: totals.calories + ingredient.calories,
    }),
    { protein: 0, carbs: 0, fats: 0, calories: 0 }
  );
};

export const calculateDayTotals = (day: MockNutritionDay): NutritionTotals => {
  return day.meals.reduce(
    (totals, meal) => {
      const mealTotals = calculateMealTotals(meal);

      return {
        protein: totals.protein + mealTotals.protein,
        carbs: totals.carbs + mealTotals.carbs,
        fats: totals.fats + mealTotals.fats,
        calories: totals.calories + mealTotals.calories,
      };
    },
    { protein: 0, carbs: 0, fats: 0, calories: 0 }
  );
};

// Mock supplements
export const getMockSupplements = (clientId: string): MockSupplement[] => {
  return [
    {
      id: "supp-1",
      name: "Creatina Monohidrato",
      dosage: "5g",
      frequency: "Diario",
      timing: "Post-entrenamiento",
      notes: "Mezclar con batido de proteína",
    },
    {
      id: "supp-2",
      name: "Whey Protein",
      dosage: "30g (1 scoop)",
      frequency: "2x día",
      timing: "Post-entrenamiento + Mañana",
      notes: "Sabor chocolate",
    },
    {
      id: "supp-3",
      name: "Omega-3",
      dosage: "1000mg",
      frequency: "2x día",
      timing: "Con almuerzo y cena",
      notes: "Para salud cardiovascular",
    },
    {
      id: "supp-4",
      name: "Vitamina D3",
      dosage: "2000 IU",
      frequency: "Diario",
      timing: "Con desayuno",
      notes: "Importante en invierno",
    },
    {
      id: "supp-5",
      name: "Magnesio",
      dosage: "400mg",
      frequency: "Diario",
      timing: "Antes de dormir",
      notes: "Ayuda con recuperación y sueño",
    },
  ];
};

// Mock check-ins
export const getMockCheckIns = (clientId: string): MockCheckIn[] => {
  return [
    {
      id: "checkin-1",
      date: "2024-10-10",
      frequency: "weekly",
      weight: 82.5,
      energy: 5,
      sleep: 4,
      stress: 2,
      mood: 5,
      progressNotes:
        "Esta semana he notado gran mejora en mi energía. Los entrenamientos se sienten más ligeros y puedo levantar más peso en los ejercicios principales. El apetito está controlado y estoy siguiendo el plan nutricional al 95%.",
      challenges:
        "Tuve un día difícil el miércoles con trabajo hasta tarde, lo que afectó mi entrenamiento de piernas. Lo recuperé el sábado.",
      achievements:
        "¡Nuevo PR en sentadilla! 105kg x 6 reps. También completé todas las sesiones de cardio esta semana.",
    },
    {
      id: "checkin-2",
      date: "2024-10-03",
      frequency: "weekly",
      weight: 82.3,
      energy: 4,
      sleep: 4,
      stress: 3,
      mood: 4,
      progressNotes:
        "Buena semana en general. La adherencia al plan nutricional fue del 90%. Me sentí fuerte en los entrenamientos pero noté algo de fatiga hacia el viernes.",
      challenges:
        "El sueño no fue óptimo esta semana (6-6.5 horas en promedio). Estrés laboral alto por proyecto.",
      achievements:
        "Completé todas las sesiones programadas. Mejoré técnica en press de banca según feedback.",
    },
    {
      id: "checkin-3",
      date: "2024-09-26",
      frequency: "weekly",
      weight: 82.0,
      energy: 4,
      sleep: 5,
      stress: 2,
      mood: 5,
      progressNotes:
        "Excelente semana. Dormí bien todas las noches (7-8 horas). Los entrenamientos fueron intensos pero manejables. Disfruté el proceso.",
      challenges: "Ninguno significativo esta semana. Todo fluyó muy bien.",
      achievements:
        "Perdí 0.3kg mientras mantengo fuerza. Las medidas corporales muestran menos grasa en abdomen.",
    },
    {
      id: "checkin-4",
      date: "2024-09-19",
      frequency: "weekly",
      weight: 82.3,
      energy: 3,
      sleep: 3,
      stress: 4,
      mood: 3,
      progressNotes:
        "Semana complicada. Tuve que viajar por trabajo y no pude seguir el plan al 100%. Hice lo mejor posible con entrenamientos en hotel.",
      challenges:
        "Viajes de trabajo, poco acceso a comida saludable, gimnasio limitado.",
      achievements:
        "A pesar de las dificultades, hice 3 entrenamientos adaptados y mantuve el consumo de proteína alto.",
    },
  ];
};

// Mock daily habits (last 30 days)
export const getMockDailyHabits = (clientId: string): MockDailyHabit[] => {
  const habits: MockDailyHabit[] = [];
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);

    date.setDate(date.getDate() - i);

    habits.push({
      date: date.toISOString().split("T")[0]!,
      steps: Math.floor(7000 + Math.random() * 6000), // 7000-13000
      sleepHours: Math.round((6 + Math.random() * 2.5) * 10) / 10, // 6-8.5 hours
      sunExposure: Math.floor(10 + Math.random() * 30), // 10-40 min
      weight: 82 + Math.random() * 1.5, // 82-83.5kg
      waterIntake: Math.floor(6 + Math.random() * 4), // 6-10 vasos
      mood: Math.ceil(3 + Math.random() * 2) as 3 | 4 | 5, // 3-5
    });
  }

  return habits;
};

// Mock progress photos
export const getMockProgressPhotos = (
  clientId: string
): MockProgressPhotoSession[] => {
  return [
    {
      id: "session-1",
      date: "2024-10-01",
      photos: [
        {
          id: "photo-1-1",
          date: "2024-10-01",
          angle: "front",
          url: "https://avatar.vercel.sh/front1.png?size=300",
          notes: "Inicio de mes - notando definición en abdomen",
        },
        {
          id: "photo-1-2",
          date: "2024-10-01",
          angle: "side",
          url: "https://avatar.vercel.sh/side1.png?size=300",
        },
        {
          id: "photo-1-3",
          date: "2024-10-01",
          angle: "back",
          url: "https://avatar.vercel.sh/back1.png?size=300",
        },
      ],
    },
    {
      id: "session-2",
      date: "2024-09-01",
      photos: [
        {
          id: "photo-2-1",
          date: "2024-09-01",
          angle: "front",
          url: "https://avatar.vercel.sh/front2.png?size=300",
        },
        {
          id: "photo-2-2",
          date: "2024-09-01",
          angle: "side",
          url: "https://avatar.vercel.sh/side2.png?size=300",
        },
        {
          id: "photo-2-3",
          date: "2024-09-01",
          angle: "back",
          url: "https://avatar.vercel.sh/back2.png?size=300",
        },
      ],
    },
    {
      id: "session-3",
      date: "2024-08-01",
      photos: [
        {
          id: "photo-3-1",
          date: "2024-08-01",
          angle: "front",
          url: "https://avatar.vercel.sh/front3.png?size=300",
        },
        {
          id: "photo-3-2",
          date: "2024-08-01",
          angle: "side",
          url: "https://avatar.vercel.sh/side3.png?size=300",
        },
        {
          id: "photo-3-3",
          date: "2024-08-01",
          angle: "back",
          url: "https://avatar.vercel.sh/back3.png?size=300",
        },
      ],
    },
  ];
};

// Mock calendar events - generates events for current month and next 30 days
export const getMockCalendarEvents = (
  clientId: string
): MockCalendarEvent[] => {
  const events: MockCalendarEvent[] = [];
  const today = new Date();

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0]!;
  };

  // Helper to add days to a date
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);

    result.setDate(result.getDate() + days);

    return result;
  };

  // Generate events for the past 7 days and next 30 days
  for (let i = -7; i <= 30; i++) {
    const eventDate = addDays(today, i);
    const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateStr = formatDate(eventDate);

    // Monday - Full Body A Workout
    if (dayOfWeek === 1) {
      events.push({
        id: `workout-${dateStr}-1`,
        date: dateStr,
        time: "07:00",
        type: "workout",
        title: "Full Body A",
        description: "7 ejercicios - Enfoque en press y sentadilla",
        status: i < 0 ? "completed" : i === 0 ? "in-progress" : "scheduled",
        duration: 75,
        relatedProgram: "prog-1",
        sessionId: "session-1",
        reminder: i >= 0 && i <= 7,
      });
    }

    // Tuesday - Cardio Light + Meeting (every other Tuesday)
    if (dayOfWeek === 2) {
      events.push({
        id: `cardio-${dateStr}-1`,
        date: dateStr,
        time: "18:00",
        type: "cardio",
        title: "Cardio Ligero - Recuperación",
        description: "Caminata + Bicicleta estática - 50 min total",
        status: i < 0 ? "completed" : "scheduled",
        duration: 50,
        relatedProgram: "cardio-prog-1",
        sessionId: "cardio-session-1",
        reminder: i >= 0 && i <= 3,
      });

      // Bi-weekly coaching meeting
      const weekNumber = Math.floor(
        (eventDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      if (weekNumber % 2 === 0) {
        events.push({
          id: `meeting-${dateStr}-1`,
          date: dateStr,
          time: "20:00",
          type: "meeting",
          title: "Sesión de Coaching",
          description: "Revisión de progreso y ajuste de plan",
          status: i < 0 ? "completed" : "scheduled",
          duration: 30,
          reminder: i >= 0 && i <= 7,
          notes: "Preparar fotos de progreso y comentarios sobre nutrición",
        });
      }
    }

    // Wednesday - Rest Day & Meal Prep
    if (dayOfWeek === 3) {
      events.push({
        id: `rest-${dateStr}-1`,
        date: dateStr,
        time: "08:00",
        type: "rest",
        title: "Día de Recuperación",
        description: "Enfoque en movilidad y stretching ligero",
        status: i < 0 ? "completed" : "scheduled",
        duration: 20,
        notes: "Caminar 30 min, estiramientos suaves",
      });

      events.push({
        id: `nutrition-${dateStr}-1`,
        date: dateStr,
        time: "19:00",
        type: "nutrition-prep",
        title: "Preparación de Comidas",
        description: "Meal prep para jueves y viernes",
        status: i < 0 ? "completed" : "scheduled",
        duration: 90,
        notes: "Cocinar pollo, arroz, y preparar vegetales",
      });
    }

    // Thursday - Full Body B + HIIT Cardio
    if (dayOfWeek === 4) {
      events.push({
        id: `workout-${dateStr}-2`,
        date: dateStr,
        time: "07:00",
        type: "workout",
        title: "Full Body B",
        description: "7 ejercicios - Enfoque en peso muerto y dominadas",
        status: i < 0 ? "completed" : "scheduled",
        duration: 80,
        relatedProgram: "prog-1",
        sessionId: "session-2",
        reminder: i >= 0 && i <= 7,
      });

      events.push({
        id: `cardio-${dateStr}-2`,
        date: dateStr,
        time: "18:30",
        type: "cardio",
        title: "HIIT - Alta Intensidad",
        description: "Intervalos sprint/caminar - 30 min total",
        status: i < 0 ? "completed" : "scheduled",
        duration: 30,
        relatedProgram: "cardio-prog-1",
        sessionId: "cardio-session-2",
        reminder: i >= 0 && i <= 3,
      });
    }

    // Friday - Rest/Active Recovery
    if (dayOfWeek === 5) {
      events.push({
        id: `rest-${dateStr}-2`,
        date: dateStr,
        time: "08:00",
        type: "rest",
        title: "Recuperación Activa",
        description: "Yoga o natación ligera",
        status: i < 0 ? "completed" : "scheduled",
        duration: 30,
        notes: "Enfocarse en movilidad de cadera y hombros",
      });
    }

    // Saturday - Cardio Moderado
    if (dayOfWeek === 6) {
      events.push({
        id: `cardio-${dateStr}-3`,
        date: dateStr,
        time: "09:00",
        type: "cardio",
        title: "Cardio Moderado - Resistencia",
        description: "Carrera continua - 40 min",
        status: i < 0 ? "completed" : "scheduled",
        duration: 40,
        relatedProgram: "cardio-prog-1",
        sessionId: "cardio-session-3",
        reminder: i >= 0 && i <= 3,
        notes: "Ritmo conversacional, 5.5km objetivo",
      });
    }

    // Sunday - Weekly Check-in (every Sunday)
    if (dayOfWeek === 0) {
      events.push({
        id: `checkin-${dateStr}-1`,
        date: dateStr,
        time: "20:00",
        type: "check-in",
        title: "Check-in Semanal",
        description: "Registro de peso, medidas y progreso",
        status: i < 0 ? "completed" : "scheduled",
        duration: 15,
        reminder: i >= 0 && i <= 7,
        notes: "Completar formulario de check-in y subir foto de peso",
      });

      events.push({
        id: `nutrition-${dateStr}-2`,
        date: dateStr,
        time: "17:00",
        type: "nutrition-prep",
        title: "Preparación de Comidas Semanal",
        description: "Meal prep para lunes, martes y miércoles",
        status: i < 0 ? "completed" : "scheduled",
        duration: 120,
        notes: "Cocinar proteínas, carbohidratos y preparar snacks",
      });
    }
  }

  // Add some special events
  const nextWeek = addDays(today, 7);
  const twoWeeksOut = addDays(today, 14);
  const threeWeeksOut = addDays(today, 21);

  // Progress photo session (every 4 weeks)
  events.push({
    id: `special-photos-1`,
    date: formatDate(addDays(today, 21)),
    time: "10:00",
    type: "check-in",
    title: "Sesión de Fotos de Progreso",
    description: "Tomar fotos de frente, lado y espalda",
    status: "scheduled",
    duration: 20,
    reminder: true,
    notes: "En ayunas, buena iluminación, mismo lugar que última vez",
  });

  // Nutrition plan review
  events.push({
    id: `special-meeting-nutrition`,
    date: formatDate(addDays(today, 12)),
    time: "19:30",
    type: "meeting",
    title: "Revisión Plan Nutricional",
    description: "Ajustes al plan basado en progreso",
    status: "scheduled",
    duration: 45,
    reminder: true,
    notes: "Llevar registro de comidas de última semana",
  });

  // Program phase change
  events.push({
    id: `special-program-change`,
    date: formatDate(addDays(today, 28)),
    time: "07:00",
    type: "workout",
    title: "¡Nueva Fase del Programa!",
    description: "Semana 1 - Fase de Volumen",
    status: "scheduled",
    duration: 90,
    reminder: true,
    notes: "Nuevos ejercicios y rep ranges. Revisar videos antes.",
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
};
