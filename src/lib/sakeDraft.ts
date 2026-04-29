import type { SakeDraft } from "../types/sake";

export function getTodayInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createInitialSakeDraft(date = new Date()): SakeDraft {
  return {
    name: "",
    region: "",
    brewery: "",
    rice: "",
    sake_type: "",
    sake_meter_value: "",
    abv: "",
    volume: "",
    price: "",
    drink_again: null,
    sweet_dry: null,
    aroma_intensity: null,
    acidity: null,
    clean_umami: null,
    one_line_note: "",
    place: "",
    consumed_date: getTodayInputDate(date),
    companions: "",
    food_pairing: "",
    images: [],
    selected_tag_ids: [],
  };
}
