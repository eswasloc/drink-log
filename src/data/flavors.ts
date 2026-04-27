import type { FlavorCategory, FlavorDefinition, FlavorEntry } from "../types/models";

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
    label: "단맛 / 과일",
    short: "단맛",
    description: "과일, 당감, 농익은 향",
  },
  floral: {
    label: "꽃 / 허브",
    short: "꽃향",
    description: "꽃, 허브, 차 계열 향",
  },
  spice: {
    label: "향신료 / 열감",
    short: "향신료",
    description: "향신료, 열감, 자극",
  },
  wood: {
    label: "나무 / 흙",
    short: "나무",
    description: "나무, 흙, 견과, 감칠맛",
  },
  smoke: {
    label: "훈연 / 이취",
    short: "훈연",
    description: "훈연, 발효, 오프노트",
  },
  texture: {
    label: "질감 / 입안 느낌",
    short: "질감",
    description: "질감, 바디, 무게감",
  },
};

export const FLAVOR_DEFINITIONS: FlavorDefinition[] = [
  { key: "sweet", label: "달콤함", category: "sweet", valence: "positive" },
  { key: "honey", label: "꿀", category: "sweet", valence: "positive" },
  { key: "caramel", label: "캐러멜", category: "sweet", valence: "positive" },
  { key: "vanilla", label: "바닐라", category: "sweet", valence: "positive" },
  { key: "fruity", label: "과일향", category: "sweet", valence: "positive" },
  { key: "citrus", label: "시트러스", category: "sweet", valence: "positive" },
  { key: "tropical", label: "열대과일", category: "sweet", valence: "positive" },
  { key: "dried_fruit", label: "말린 과일", category: "sweet", valence: "positive" },
  { key: "jammy", label: "잼 같은", category: "sweet", valence: "positive" },
  { key: "floral", label: "꽃향", category: "floral", valence: "positive" },
  { key: "rose", label: "장미", category: "floral", valence: "positive" },
  { key: "lavender", label: "라벤더", category: "floral", valence: "positive" },
  { key: "herbal", label: "허브", category: "floral", valence: "neutral" },
  { key: "tea_like", label: "차 같은", category: "floral", valence: "neutral" },
  { key: "green", label: "풋풋함", category: "floral", valence: "neutral" },
  { key: "grass", label: "풀 내음", category: "floral", valence: "neutral" },
  { key: "mint", label: "민트", category: "floral", valence: "positive" },
  { key: "spicy", label: "스파이시", category: "spice", valence: "positive" },
  { key: "peppery", label: "후추", category: "spice", valence: "neutral" },
  { key: "cinnamon", label: "계피", category: "spice", valence: "positive" },
  { key: "ginger", label: "생강", category: "spice", valence: "positive" },
  { key: "warm", label: "따뜻함", category: "spice", valence: "positive" },
  { key: "alcohol_heat", label: "알코올 열감", category: "spice", valence: "negative" },
  { key: "harsh_burn", label: "거친 자극", category: "spice", valence: "negative" },
  { key: "woody", label: "나무향", category: "wood", valence: "positive" },
  { key: "oak", label: "오크", category: "wood", valence: "positive" },
  { key: "earthy", label: "흙내음", category: "wood", valence: "neutral" },
  { key: "tobacco", label: "담배잎", category: "wood", valence: "neutral" },
  { key: "leather", label: "가죽", category: "wood", valence: "neutral" },
  { key: "nutty", label: "견과류", category: "wood", valence: "positive" },
  { key: "umami", label: "감칠맛", category: "wood", valence: "positive" },
  { key: "smoky", label: "스모키", category: "smoke", valence: "positive" },
  { key: "peaty", label: "피트", category: "smoke", valence: "positive" },
  { key: "charred", label: "그을린 향", category: "smoke", valence: "neutral" },
  { key: "funky", label: "쿰쿰함", category: "smoke", valence: "neutral" },
  { key: "fermented", label: "발효향", category: "smoke", valence: "neutral" },
  { key: "solvent_like", label: "용제 같은", category: "smoke", valence: "negative" },
  { key: "metallic", label: "금속성", category: "smoke", valence: "negative" },
  { key: "light_body", label: "가벼운 바디", category: "texture", valence: "neutral" },
  { key: "medium_body", label: "중간 바디", category: "texture", valence: "neutral" },
  { key: "full_body", label: "묵직한 바디", category: "texture", valence: "positive" },
  { key: "oily", label: "오일리함", category: "texture", valence: "positive" },
  { key: "smooth", label: "부드러움", category: "texture", valence: "positive" },
  { key: "rough", label: "거침", category: "texture", valence: "negative" },
  { key: "thin", label: "묽음", category: "texture", valence: "negative" },
  { key: "creamy", label: "크리미함", category: "texture", valence: "positive" },
];

export function compareNegativeLast(
  left: Pick<FlavorDefinition | FlavorEntry, "valence">,
  right: Pick<FlavorDefinition | FlavorEntry, "valence">,
) {
  if (left.valence === right.valence) {
    return 0;
  }

  return left.valence === "negative" ? 1 : -1;
}

export function sortNegativeLast<T extends FlavorDefinition | FlavorEntry>(
  entries: T[],
) {
  return [...entries].sort(compareNegativeLast);
}

export const FLAVORS_BY_CATEGORY = CATEGORY_ORDER.reduce<
  Record<FlavorCategory, FlavorDefinition[]>
>(
  (acc, category) => {
    acc[category] = sortNegativeLast(
      FLAVOR_DEFINITIONS.filter((flavor) => flavor.category === category),
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
