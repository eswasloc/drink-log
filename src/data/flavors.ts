import type { FlavorCategory, FlavorDefinition } from "../types/models";

export const CATEGORY_ORDER: FlavorCategory[] = [
  "sweet",
  "floral",
  "spice",
  "wood",
  "smoke",
  "texture",
];

export const CATEGORY_META: Record<
  FlavorCategory,
  { label: string; short: string; description: string }
> = {
  sweet: {
    label: "Sweet / Fruit",
    short: "Sweet",
    description: "과일, 당감, 농익은 향",
  },
  floral: {
    label: "Floral / Herbal",
    short: "Floral",
    description: "꽃, 허브, 차 계열 향",
  },
  spice: {
    label: "Spice / Heat",
    short: "Spice",
    description: "향신료, 열감, 자극",
  },
  wood: {
    label: "Wood / Earth",
    short: "Wood",
    description: "나무, 흙, 견과, 감칠맛",
  },
  smoke: {
    label: "Smoke / Off-note",
    short: "Smoke",
    description: "훈연, 발효, 오프노트",
  },
  texture: {
    label: "Texture / Mouthfeel",
    short: "Texture",
    description: "질감, 바디, 무게감",
  },
};

export const FLAVOR_DEFINITIONS: FlavorDefinition[] = [
  { key: "sweet", label: "Sweet", category: "sweet", valence: "positive" },
  { key: "honey", label: "Honey", category: "sweet", valence: "positive" },
  { key: "caramel", label: "Caramel", category: "sweet", valence: "positive" },
  { key: "vanilla", label: "Vanilla", category: "sweet", valence: "positive" },
  { key: "fruity", label: "Fruity", category: "sweet", valence: "positive" },
  { key: "citrus", label: "Citrus", category: "sweet", valence: "positive" },
  { key: "tropical", label: "Tropical", category: "sweet", valence: "positive" },
  { key: "dried_fruit", label: "Dried Fruit", category: "sweet", valence: "positive" },
  { key: "jammy", label: "Jammy", category: "sweet", valence: "positive" },
  { key: "floral", label: "Floral", category: "floral", valence: "positive" },
  { key: "rose", label: "Rose", category: "floral", valence: "positive" },
  { key: "lavender", label: "Lavender", category: "floral", valence: "positive" },
  { key: "herbal", label: "Herbal", category: "floral", valence: "neutral" },
  { key: "tea_like", label: "Tea-like", category: "floral", valence: "neutral" },
  { key: "green", label: "Green", category: "floral", valence: "neutral" },
  { key: "grass", label: "Grass", category: "floral", valence: "neutral" },
  { key: "mint", label: "Mint", category: "floral", valence: "positive" },
  { key: "spicy", label: "Spicy", category: "spice", valence: "positive" },
  { key: "peppery", label: "Peppery", category: "spice", valence: "neutral" },
  { key: "cinnamon", label: "Cinnamon", category: "spice", valence: "positive" },
  { key: "ginger", label: "Ginger", category: "spice", valence: "positive" },
  { key: "warm", label: "Warm", category: "spice", valence: "positive" },
  { key: "alcohol_heat", label: "Alcohol Heat", category: "spice", valence: "negative" },
  { key: "harsh_burn", label: "Harsh Burn", category: "spice", valence: "negative" },
  { key: "woody", label: "Woody", category: "wood", valence: "positive" },
  { key: "oak", label: "Oak", category: "wood", valence: "positive" },
  { key: "earthy", label: "Earthy", category: "wood", valence: "neutral" },
  { key: "tobacco", label: "Tobacco", category: "wood", valence: "neutral" },
  { key: "leather", label: "Leather", category: "wood", valence: "neutral" },
  { key: "nutty", label: "Nutty", category: "wood", valence: "positive" },
  { key: "umami", label: "Umami", category: "wood", valence: "positive" },
  { key: "smoky", label: "Smoky", category: "smoke", valence: "positive" },
  { key: "peaty", label: "Peaty", category: "smoke", valence: "positive" },
  { key: "charred", label: "Charred", category: "smoke", valence: "neutral" },
  { key: "funky", label: "Funky", category: "smoke", valence: "neutral" },
  { key: "fermented", label: "Fermented", category: "smoke", valence: "neutral" },
  { key: "solvent_like", label: "Solvent-like", category: "smoke", valence: "negative" },
  { key: "metallic", label: "Metallic", category: "smoke", valence: "negative" },
  { key: "light_body", label: "Light Body", category: "texture", valence: "neutral" },
  { key: "medium_body", label: "Medium Body", category: "texture", valence: "neutral" },
  { key: "full_body", label: "Full Body", category: "texture", valence: "positive" },
  { key: "oily", label: "Oily", category: "texture", valence: "positive" },
  { key: "smooth", label: "Smooth", category: "texture", valence: "positive" },
  { key: "rough", label: "Rough", category: "texture", valence: "negative" },
  { key: "thin", label: "Thin", category: "texture", valence: "negative" },
  { key: "creamy", label: "Creamy", category: "texture", valence: "positive" },
];

export const FLAVORS_BY_CATEGORY = CATEGORY_ORDER.reduce<
  Record<FlavorCategory, FlavorDefinition[]>
>(
  (acc, category) => {
    acc[category] = FLAVOR_DEFINITIONS.filter(
      (flavor) => flavor.category === category,
    );
    return acc;
  },
  {
    sweet: [],
    floral: [],
    spice: [],
    wood: [],
    smoke: [],
    texture: [],
  },
);
