import type {
  DrinkAgainValue,
  SweetDryValue,
  ThreeStepRatingValue,
} from "../types/sake";

export const DRINK_AGAIN_OPTIONS: ReadonlyArray<{
  value: DrinkAgainValue;
  label: string;
}> = [
  { value: "no", label: "별로" },
  { value: "unsure", label: "잘모르겠음" },
  { value: "yes", label: "다시 마신다" },
] as const;

export const SWEET_DRY_OPTIONS: ReadonlyArray<{
  value: SweetDryValue;
  label: string;
}> = [
  { value: 1, label: "아주 달큼함" },
  { value: 2, label: "달큼함" },
  { value: 3, label: "보통" },
  { value: 4, label: "드라이함" },
  { value: 5, label: "아주 드라이함" },
] as const;

export const AROMA_INTENSITY_OPTIONS: ReadonlyArray<{
  value: ThreeStepRatingValue;
  label: string;
}> = [
  { value: 1, label: "은은한향" },
  { value: 2, label: "보통" },
  { value: 3, label: "화려한향" },
] as const;

export const ACIDITY_OPTIONS: ReadonlyArray<{
  value: ThreeStepRatingValue;
  label: string;
}> = [
  { value: 1, label: "산미없음" },
  { value: 2, label: "산미보통" },
  { value: 3, label: "산미높음" },
] as const;

export const CLEAN_UMAMI_OPTIONS: ReadonlyArray<{
  value: ThreeStepRatingValue;
  label: string;
}> = [
  { value: 1, label: "깔끔함" },
  { value: 2, label: "보통" },
  { value: 3, label: "감칠맛좋은" },
] as const;
