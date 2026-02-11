"use client";

import Color from "color";
import { PipetteIcon } from "lucide-react";
import { Slider } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ColorPickerContextValue = {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  mode: string;
  setHue: (hue: number) => void;
  setSaturation: (saturation: number) => void;
  setLightness: (lightness: number) => void;
  setAlpha: (alpha: number) => void;
  setMode: (mode: string) => void;
};

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(
  undefined
);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider");
  }

  return context;
};

export type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
  value?: Parameters<typeof Color>[0];
  defaultValue?: Parameters<typeof Color>[0];
  onChange?: (value: Parameters<typeof Color.rgb>[0]) => void;
};

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  const initColor = value ? Color(value) : Color(defaultValue);

  const [hue, setHueState] = useState(initColor.hue() || 0);
  const [saturation, setSaturationState] = useState(
    initColor.saturationl() || 100
  );
  const [lightness, setLightnessState] = useState(initColor.lightness() || 50);
  const [alpha, setAlphaState] = useState((initColor.alpha() ?? 1) * 100);
  const [mode, setMode] = useState("hex");

  // Track whether a change came from the user (internal) vs the value prop
  const isInternalChange = useRef(false);
  const prevValueRef = useRef(value);

  // Wrapped setters that mark changes as internal (user-driven)
  const setHue = useCallback((v: number) => {
    isInternalChange.current = true;
    setHueState(v);
  }, []);
  const setSaturation = useCallback((v: number) => {
    isInternalChange.current = true;
    setSaturationState(v);
  }, []);
  const setLightness = useCallback((v: number) => {
    isInternalChange.current = true;
    setLightnessState(v);
  }, []);
  const setAlpha = useCallback((v: number) => {
    isInternalChange.current = true;
    setAlphaState(v);
  }, []);

  // Sync from controlled value prop → internal HSL state (without triggering onChange)
  useEffect(() => {
    if (value && value !== prevValueRef.current) {
      prevValueRef.current = value;
      try {
        const color = Color(value);
        const h = color.hue() || 0;
        const s = color.saturationl() || 0;
        const l = color.lightness() || 50;
        const a = (color.alpha() ?? 1) * 100;

        // Set state directly without marking as internal change
        setHueState(h);
        setSaturationState(s);
        setLightnessState(l);
        setAlphaState(a);
      } catch {
        // ignore invalid color values
      }
    }
  }, [value]);

  // Notify parent only when the change was user-driven
  useEffect(() => {
    if (isInternalChange.current && onChange) {
      isInternalChange.current = false;
      const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100);
      const rgba = color.rgb().array();

      onChange([rgba[0], rgba[1], rgba[2], alpha / 100]);
    }
  }, [hue, saturation, lightness, alpha, onChange]);

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        alpha,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setAlpha,
        setMode,
      }}
    >
      <div
        className={cn("flex size-full flex-col gap-4", className)}
        {...props}
      />
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(
  ({ className, ...props }: ColorPickerSelectionProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { hue, saturation, lightness, setSaturation, setLightness } =
      useColorPicker();

    // Derive the cursor position from current saturation & lightness.
    // saturation = x * 100  →  x = saturation / 100
    // lightness  = (50 + 50*(1-x)) * (1-y)  →  solve for y
    const positionX = saturation / 100;
    const positionY = useMemo(() => {
      const topL = positionX < 0.01 ? 100 : 50 + 50 * (1 - positionX);

      if (topL === 0) return 0;

      return 1 - lightness / topL;
    }, [positionX, lightness]);

    const backgroundGradient = useMemo(() => {
      return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`;
    }, [hue]);

    const updateFromPointer = useCallback(
      (event: PointerEvent | React.PointerEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width)
        );
        const y = Math.max(
          0,
          Math.min(1, (event.clientY - rect.top) / rect.height)
        );

        setSaturation(x * 100);
        const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);

        setLightness(topLightness * (1 - y));
      },
      [setSaturation, setLightness]
    );

    useEffect(() => {
      if (!isDragging) return;

      const handlePointerMove = (e: PointerEvent) => updateFromPointer(e);
      const handlePointerUp = () => setIsDragging(false);

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }, [isDragging, updateFromPointer]);

    return (
      <div
        ref={containerRef}
        className={cn("relative size-full cursor-crosshair rounded", className)}
        style={{
          background: backgroundGradient,
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          updateFromPointer(e);
        }}
        {...props}
      >
        <div
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white"
          style={{
            left: `${positionX * 100}%`,
            top: `${positionY * 100}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    );
  }
);

ColorPickerSelection.displayName = "ColorPickerSelection";

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerHue = ({
  className,
  ...props
}: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker();

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={360}
      step={1}
      value={[hue]}
      onValueChange={([hue]) => setHue(hue ?? 0)}
      {...props}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <Slider.Range className="absolute h-full" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  );
};

export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerAlpha = ({
  className,
  ...props
}: ColorPickerAlphaProps) => {
  const { alpha, setAlpha } = useColorPicker();

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={100}
      step={1}
      value={[alpha]}
      onValueChange={([alpha]) => setAlpha(alpha ?? 0)}
      {...props}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center bg-repeat-x dark:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALklEQVR4nGP8+vWrCAMewM3N/QafPBM+SWLAqAGDwQBGQgoIpZOB98KoAVQwAADxzQcSVIRCfQAAAABJRU5ErkJggg==')]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50 dark:to-white/50" />
        <Slider.Range className="absolute h-full rounded-full bg-transparent" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  );
};

export type ColorPickerEyeDropperProps = HTMLAttributes<HTMLButtonElement>;

export const ColorPickerEyeDropper = ({
  className,
  ...props
}: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const color = Color(result.sRGBHex);
      const [h, s, l] = color.hsl().array();

      setHue(h ?? 0);
      setSaturation(s ?? 0);
      setLightness(l ?? 0);
      setAlpha(100);
    } catch (error) {
      console.error("EyeDropper failed:", error);
    }
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-md border border-input bg-background shadow-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        className
      )}
      type="button"
      onClick={handleEyeDropper}
    >
      <PipetteIcon size={16} />
    </button>
  );
};

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;

const formats = ["hex", "rgb", "css", "hsl"];

export const ColorPickerOutput = ({
  className,
  ...props
}: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select value={mode} onValueChange={setMode}>
      <SelectTrigger className="h-8 w-20 shrink-0 text-xs" {...props}>
        <SelectValue placeholder="Mode" />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem key={format} className="text-xs" value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

type PercentageInputProps = ComponentProps<typeof Input>;

const PercentageInput = ({ className, ...props }: PercentageInputProps) => {
  return (
    <div className="relative">
      <Input
        readOnly
        type="text"
        {...props}
        className={cn(
          "h-8 w-[3.25rem] rounded-l-none bg-secondary px-2 text-xs shadow-none",
          className
        )}
      />
      <span className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
        %
      </span>
    </div>
  );
};

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerFormat = ({
  className,
  ...props
}: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness, alpha / 100);

  if (mode === "hex") {
    const hex = color.hex();

    return (
      <div
        className={cn(
          "-space-x-px relative flex w-full items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        <Input
          readOnly
          className="h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none"
          type="text"
          value={hex}
        />
        <PercentageInput value={alpha} />
      </div>
    );
  }

  if (mode === "rgb") {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value));

    return (
      <div
        className={cn(
          "-space-x-px flex items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        {rgb.map((value, index) => (
          <Input
            key={index}
            readOnly
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className
            )}
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} />
      </div>
    );
  }

  if (mode === "css") {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value));

    return (
      <div className={cn("w-full rounded-md shadow-sm", className)} {...props}>
        <Input
          readOnly
          className="h-8 w-full bg-secondary px-2 text-xs shadow-none"
          type="text"
          value={`rgba(${rgb.join(", ")}, ${alpha}%)`}
          {...props}
        />
      </div>
    );
  }

  if (mode === "hsl") {
    const hsl = color
      .hsl()
      .array()
      .map((value) => Math.round(value));

    return (
      <div
        className={cn(
          "-space-x-px flex items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        {hsl.map((value, index) => (
          <Input
            key={index}
            readOnly
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className
            )}
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} />
      </div>
    );
  }

  return null;
};
