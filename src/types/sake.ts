export type DrinkType = "sake";

export type DrinkAgainValue = "no" | "unsure" | "yes";

export type SweetDryValue = 1 | 2 | 3 | 4 | 5;
export type ThreeStepRatingValue = 1 | 2 | 3;

export type SakeTagGroup = "taste" | "aroma" | "mood";

export interface SakeRecord {
  id: string;
  owner_id: string;
  drink_type: DrinkType;
  name: string;
  region: string | null;
  brewery: string | null;
  rice: string | null;
  sake_type: string | null;
  sake_meter_value: string | null;
  abv: string | null;
  volume: string | null;
  price: string | null;
  drink_again: DrinkAgainValue | null;
  sweet_dry: SweetDryValue | null;
  aroma_intensity: ThreeStepRatingValue | null;
  acidity: ThreeStepRatingValue | null;
  clean_umami: ThreeStepRatingValue | null;
  one_line_note: string | null;
  place: string | null;
  consumed_date: string;
  companions: string | null;
  food_pairing: string | null;
  created_at: string;
  updated_at: string;
}

export interface SakeImage {
  id: string;
  owner_id: string;
  record_id: string;
  image_key: string;
  thumbnail_key: string | null;
  data_url: string;
  thumbnail_data_url: string | null;
  mime_type: string;
  file_name: string;
  display_order: number;
  created_at: string;
}

export interface SakeTag {
  id: string;
  owner_id: string | null;
  drink_type: DrinkType;
  tag_group: SakeTagGroup;
  label: string;
  is_default: boolean;
  created_at: string;
}

export interface SakeRecordTag {
  record_id: string;
  tag_id: string;
  created_at: string;
}

export interface SakeRecordEntry {
  id: string;
  record: SakeRecord;
  images: SakeImage[];
  tags: SakeTag[];
  record_tags: SakeRecordTag[];
}

export interface SakeDraftImage {
  id: string;
  data_url: string;
  thumbnail_data_url?: string;
  mime_type: string;
  file_name: string;
  display_order: number;
}

export interface SakeDraft {
  name: string;
  region: string;
  brewery: string;
  rice: string;
  sake_type: string;
  sake_meter_value: string;
  abv: string;
  volume: string;
  price: string;
  drink_again: DrinkAgainValue | null;
  sweet_dry: SweetDryValue | null;
  aroma_intensity: ThreeStepRatingValue | null;
  acidity: ThreeStepRatingValue | null;
  clean_umami: ThreeStepRatingValue | null;
  one_line_note: string;
  place: string;
  consumed_date: string;
  companions: string;
  food_pairing: string;
  images: SakeDraftImage[];
  selected_tag_ids: string[];
}
