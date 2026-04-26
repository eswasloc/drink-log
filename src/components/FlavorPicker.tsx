import { FLAVORS_BY_CATEGORY } from "../data/flavors";
import { IntensityBar } from "./IntensityBar";
import type { FlavorCategory, FlavorDefinition, FlavorEntry } from "../types/models";

interface FlavorPickerProps {
  category: FlavorCategory;
  selected: FlavorEntry[];
  onToggle: (flavor: FlavorDefinition) => void;
  onIntensityChange: (flavorKey: string, intensity: number) => void;
}

export function FlavorPicker({
  category,
  selected,
  onToggle,
  onIntensityChange,
}: FlavorPickerProps) {
  const selectedByKey = new Map(selected.map((entry) => [entry.flavor, entry]));

  return (
    <div className="flavor-list">
      {FLAVORS_BY_CATEGORY[category].map((flavor) => {
        const selectedEntry = selectedByKey.get(flavor.key);
        const active = Boolean(selectedEntry);
        return (
          <div
            key={flavor.key}
            className={`flavor-control ${active ? "is-selected" : ""} ${flavor.valence === "negative" ? "is-negative" : ""}`}
          >
            <button
              type="button"
              className="flavor-toggle"
              onClick={() => onToggle(flavor)}
            >
              {flavor.label}
            </button>
            {selectedEntry ? (
              <IntensityBar
                value={selectedEntry.intensity}
                onChange={(value) => onIntensityChange(flavor.key, value)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
