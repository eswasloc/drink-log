interface IntensityBarProps {
  value: number;
  onChange: (value: number) => void;
}

export function IntensityBar({ value, onChange }: IntensityBarProps) {
  return (
    <div className="intensity-row">
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        aria-label="강도"
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`star-button ${value >= step ? "is-filled" : ""}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}
