export type DrinkProfile =
  | "whisky"
  | "sake"
  | "gin"
  | "rum"
  | "korean_traditional"
  | "wine";

export type FlavorCategory =
  | "sweet"
  | "floral"
  | "spice"
  | "wood"
  | "smoke"
  | "texture";

export type FlavorValence = "positive" | "neutral" | "negative";

export interface Bottle {
  id: string;
  name: string;
  type: DrinkProfile;
  brand: string;
  abv: number | null;
  created_at: string;
}

export interface BottleImage {
  id: string;
  bottle_id: string;
  image_key: string;
  data_url: string;
  thumbnail_data_url?: string;
  mime_type: string;
  file_name: string;
  created_at: string;
}

export interface FlavorDefinition {
  key: string;
  label: string;
  category: FlavorCategory;
  valence: FlavorValence;
}

export interface FlavorEntry {
  flavor: string;
  intensity: number;
  valence: FlavorValence;
  category: FlavorCategory;
}

export interface ProfileSection {
  id: string;
  label: string;
  helper: string;
}

export interface SensoryNote {
  bottle_id: string;
  profile: DrinkProfile;
  sections: Record<string, FlavorEntry[]>;
  note: string;
}

export interface TastingLog {
  id: string;
  bottle: Bottle;
  images: BottleImage[];
  sensory: SensoryNote;
  created_at: string;
}
