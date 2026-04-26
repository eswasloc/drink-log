import type { DrinkProfile, ProfileSection } from "../types/models";

export const PROFILE_LABELS: Record<DrinkProfile, string> = {
  whisky: "Whisky",
  sake: "Sake",
  gin: "Gin",
  rum: "Rum",
  korean_traditional: "Korean Traditional",
  wine: "Wine",
};

export const PROFILE_SECTIONS: Record<DrinkProfile, ProfileSection[]> = {
  whisky: [
    { id: "nose", label: "Nose", helper: "향에서 먼저 느껴지는 것" },
    { id: "palate", label: "Palate", helper: "입 안에서 중심이 되는 맛" },
    { id: "finish", label: "Finish", helper: "삼킨 뒤 남는 인상" },
  ],
  sake: [
    { id: "aroma", label: "Aroma", helper: "첫 향과 코에서 느껴지는 결" },
    { id: "taste", label: "Taste", helper: "입 안의 핵심 풍미" },
    { id: "aftertaste", label: "Aftertaste", helper: "넘긴 뒤 남는 여운" },
  ],
  gin: [
    { id: "botanical", label: "Botanical", helper: "주니퍼와 허브 중심 인상" },
    { id: "citrus", label: "Citrus", helper: "시트러스와 밝은 향" },
    { id: "finish", label: "Finish", helper: "끝에서 남는 톤" },
  ],
  rum: [
    { id: "aroma", label: "Aroma", helper: "첫 향과 당밀 계열 인상" },
    { id: "body", label: "Body", helper: "입 안의 무게감과 질감" },
    { id: "finish", label: "Finish", helper: "여운과 잔향" },
  ],
  korean_traditional: [
    { id: "sweetness", label: "Sweetness", helper: "단맛과 곡물감" },
    { id: "body", label: "Body", helper: "질감과 밀도" },
    { id: "alcohol_feel", label: "Alcohol Feel", helper: "열감과 자극의 정도" },
  ],
  wine: [
    { id: "aroma", label: "Aroma", helper: "잔에서 올라오는 향" },
    { id: "palate", label: "Palate", helper: "입 안의 풍미 구조" },
    { id: "finish", label: "Finish", helper: "마무리와 잔향" },
  ],
};
