import { CATEGORY_META, CATEGORY_ORDER } from "../data/flavors";
import type { FlavorCategory } from "../types/models";

interface CategoryGridProps {
  activeCategory: FlavorCategory;
  onSelect: (category: FlavorCategory) => void;
}

export function CategoryGrid({
  activeCategory,
  onSelect,
}: CategoryGridProps) {
  return (
    <div className="category-grid">
      {CATEGORY_ORDER.map((category) => {
        const meta = CATEGORY_META[category];
        return (
          <button
            key={category}
            type="button"
            className={`category-card${activeCategory === category ? " is-active" : ""}`}
            onClick={() => onSelect(category)}
          >
            <span>{meta.short}</span>
          </button>
        );
      })}
    </div>
  );
}
