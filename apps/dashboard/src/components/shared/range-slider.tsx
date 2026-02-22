import * as Slider from "@radix-ui/react-slider";
import { cn } from "@brimble/ui";

interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  hideValue?: boolean;
}

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  disabled = false,
  hideValue = false,
}: RangeSliderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Slider.Root
        className="relative flex h-5 flex-1 touch-none select-none items-center"
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <Slider.Track className="relative h-[5px] flex-1 rounded-full bg-dash-border">
          <Slider.Range className="absolute h-full rounded-full bg-[#4879f8]" />
        </Slider.Track>
        <Slider.Thumb
          className="block size-[18px] cursor-grab rounded-full bg-white shadow-[0px_1px_3px_rgba(3,7,18,0.15),0px_0px_0px_1px_rgba(3,7,18,0.08)] transition-shadow hover:shadow-[0px_2px_6px_rgba(3,7,18,0.18),0px_0px_0px_1px_rgba(3,7,18,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4879f8]/40 active:cursor-grabbing active:scale-105 dark:bg-[#e8eaed] dark:shadow-[0px_1px_3px_rgba(0,0,0,0.4),0px_0px_0px_1px_rgba(255,255,255,0.1)] dark:hover:shadow-[0px_2px_6px_rgba(0,0,0,0.5),0px_0px_0px_1px_rgba(255,255,255,0.12)]"
          aria-label="Value"
        />
      </Slider.Root>
      {!hideValue && (
        <span className="min-w-[36px] text-right text-sm font-medium text-dash-text-strong">
          {value}
          {unit}
        </span>
      )}
    </div>
  );
}
