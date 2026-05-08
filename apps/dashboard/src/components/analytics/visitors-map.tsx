import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { AnimatePresence, motion } from "motion/react";
import { SegmentedToggle } from "@/components/observability/segmented-toggle";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { Theme } from "@/types/enums";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 alpha-2 → full topojson country `name` (covers the most common entries
// returned by Umami; missing entries fall through with no highlight).
const ISO2_TO_NAME: Record<string, string> = {
  US: "United States of America",
  GB: "United Kingdom",
  NG: "Nigeria",
  CA: "Canada",
  MX: "Mexico",
  BW: "Botswana",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BR: "Brazil",
  AR: "Argentina",
  IN: "India",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  AU: "Australia",
  NZ: "New Zealand",
  ZA: "South Africa",
  KE: "Kenya",
  EG: "Egypt",
  TR: "Turkey",
  RU: "Russia",
  PL: "Poland",
  SE: "Sweden",
  FI: "Finland",
  NO: "Norway",
  DK: "Denmark",
  IE: "Ireland",
  PT: "Portugal",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  TH: "Thailand",
  ID: "Indonesia",
  PH: "Philippines",
  MY: "Malaysia",
  VN: "Vietnam",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
};

export interface CountryVisitor {
  code: string;
  visitors: number;
}

function buildCountryMap(countries: CountryVisitor[]): {
  byName: Record<string, number>;
  max: number;
} {
  const byName: Record<string, number> = {};
  let max = 0;
  for (const c of countries) {
    const name = ISO2_TO_NAME[c.code.toUpperCase()];
    if (!name) continue;
    byName[name] = (byName[name] ?? 0) + c.visitors;
    if (byName[name] > max) max = byName[name];
  }
  return { byName, max };
}

function fillFor(visitors: number | undefined, max: number, isDark: boolean): string {
  if (!visitors || max <= 0) return isDark ? "#243049" : "#dde3ee";
  const intensity = Math.min(1, visitors / max);
  const alpha = 0.25 + intensity * 0.65;
  return `rgba(255, 122, 0, ${alpha})`;
}

function FlatMap({ countries }: { countries: CountryVisitor[] }) {
  const { theme } = useTheme();
  const isDark = theme === Theme.Dark;
  const stroke = isDark ? "#3b6cf3" : "#9bb6ee";
  const { byName, max } = buildCountryMap(countries);
  const [tooltip, setTooltip] = useState<{
    name: string;
    visitors: number;
    x: number;
    y: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapperRef} className="relative flex h-full w-full items-center justify-center" onMouseLeave={() => setTooltip(null)}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 145, center: [0, 25] }}
        width={980}
        height={460}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name = geo.properties?.name as string | undefined;
              const visitors = name ? byName[name] : undefined;
              const fill = fillFor(visitors, max, isDark);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={(e: React.MouseEvent) => {
                    if (!name) return;
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    setTooltip({
                      name,
                      visitors: visitors ?? 0,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseMove={(e: React.MouseEvent) => {
                    if (!name) return;
                    const rect = wrapperRef.current?.getBoundingClientRect();
                    setTooltip({
                      name,
                      visitors: visitors ?? 0,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    default: {
                      fill,
                      stroke,
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: "rgba(255, 122, 0, 0.95)",
                      stroke,
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: {
                      fill: "rgba(255, 122, 0, 1)",
                      stroke,
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-md border border-[#141414] bg-gradient-to-b from-[#434343] to-[#232323] px-2.5 py-1 shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <div className="flex flex-col gap-0.5 text-xs leading-5 tracking-[-0.019px] text-white">
            <span className="font-medium">{tooltip.name}</span>
            <span className="text-[10px] text-white/60">
              {tooltip.visitors} visitor{tooltip.visitors === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const SIZE = 600;

const COUNTRY_LATLNG: Record<string, [number, number]> = {
  US: [37.7749, -95.7129],
  GB: [55.3781, -3.436],
  NG: [9.082, 8.6753],
  CA: [56.1304, -106.3468],
  MX: [23.6345, -102.5528],
  BW: [-22.3285, 24.6849],
  DE: [51.1657, 10.4515],
  FR: [46.6034, 1.8883],
  ES: [40.4637, -3.7492],
  IT: [41.8719, 12.5674],
  NL: [52.1326, 5.2913],
  BR: [-14.235, -51.9253],
  AR: [-38.4161, -63.6167],
  IN: [20.5937, 78.9629],
  CN: [35.8617, 104.1954],
  JP: [36.2048, 138.2529],
  KR: [35.9078, 127.7669],
  AU: [-25.2744, 133.7751],
  NZ: [-40.9006, 174.886],
  ZA: [-30.5595, 22.9375],
  KE: [-0.0236, 37.9062],
  EG: [26.8206, 30.8025],
  TR: [38.9637, 35.2433],
  RU: [61.524, 105.3188],
  PL: [51.9194, 19.1451],
  SE: [60.1282, 18.6435],
  FI: [61.9241, 25.7482],
  NO: [60.472, 8.4689],
  DK: [56.2639, 9.5018],
  IE: [53.4129, -8.2439],
  PT: [39.3999, -8.2245],
  CH: [46.8182, 8.2275],
  AT: [47.5162, 14.5501],
  BE: [50.5039, 4.4699],
  SG: [1.3521, 103.8198],
  HK: [22.3193, 114.1694],
  TW: [23.6978, 120.9605],
  TH: [15.87, 100.9925],
  ID: [-0.7893, 113.9213],
  PH: [12.8797, 121.774],
  MY: [4.2105, 101.9758],
  VN: [14.0583, 108.2772],
  AE: [23.4241, 53.8478],
  SA: [23.8859, 45.0792],
  IL: [31.0461, 34.8516],
};

function Globe({ countries }: { countries: CountryVisitor[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const { theme } = useTheme();
  const isDark = theme === Theme.Dark;

  const topCountries = [...countries]
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8)
    .filter((c) => COUNTRY_LATLNG[c.code.toUpperCase()]);

  const labelMarkers = topCountries.map((c) => {
    const code = c.code.toUpperCase();
    return {
      id: `country-${code.toLowerCase()}`,
      location: COUNTRY_LATLNG[code]!,
      label: ISO2_TO_NAME[code] ?? code,
      visitors: c.visitors,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: SIZE * 2,
      height: SIZE * 2,
      phi: 0,
      theta: 0.2,
      dark: isDark ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: isDark ? 6 : 4,
      baseColor: isDark ? [0.82, 0.83, 0.88] : [0.4, 0.42, 0.48],
      markerColor: [0.024, 0.435, 1],
      glowColor: isDark ? [0.13, 0.14, 0.18] : [0.86, 0.87, 0.92],
      markers: labelMarkers.map((m) => ({
        location: m.location,
        size: 0.04,
        id: m.id,
      })),
    } as any);

    function animate() {
      if (pointerInteracting.current === null) {
        phiRef.current += 0.003;
      }
      (globe as any).update({
        phi: phiRef.current + pointerInteractionMovement.current,
      });
      frame = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      globe.destroy();
    };
  }, [isDark, labelMarkers]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        style={{
          height: "100%",
          maxWidth: "100%",
          position: "relative",
          aspectRatio: "1 / 1",
        }}
      >
        <canvas
          ref={canvasRef}
          width={SIZE * 2}
          height={SIZE * 2}
          onPointerDown={(e) => {
            pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
            if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
          }}
          onPointerUp={() => {
            pointerInteracting.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = "grab";
          }}
          onPointerOut={() => {
            pointerInteracting.current = null;
            if (canvasRef.current) canvasRef.current.style.cursor = "grab";
          }}
          onMouseMove={(e) => {
            if (pointerInteracting.current !== null) {
              const delta = e.clientX - pointerInteracting.current;
              pointerInteractionMovement.current = delta / 200;
            }
          }}
          onTouchMove={(e) => {
            if (pointerInteracting.current !== null && e.touches[0]) {
              const delta = e.touches[0].clientX - pointerInteracting.current;
              pointerInteractionMovement.current = delta / 100;
            }
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "grab",
            contain: "layout paint size",
            touchAction: "none",
          }}
        />
      </div>
      {topCountries.length > 0 && (
        <div className="absolute left-4 top-4 hidden flex-col gap-1.5 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg/80 px-3 py-2.5 backdrop-blur-sm sm:flex">
          <span className="text-[9px] font-medium uppercase tracking-[1px] text-dash-text-faded">Top countries</span>
          {topCountries.slice(0, 6).map((c) => {
            const name = ISO2_TO_NAME[c.code.toUpperCase()] ?? c.code;
            return (
              <SimpleTooltip
                key={c.code}
                side="right"
                content={
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{name}</span>
                    <span className="text-[10px] text-white/60">
                      {c.visitors} visitor{c.visitors === 1 ? "" : "s"}
                    </span>
                  </div>
                }
              >
                <div className="flex cursor-default items-center justify-between gap-3 text-xs">
                  <span className="text-dash-text-body">{name}</span>
                  <span className="text-dash-text-faded">{c.visitors}</span>
                </div>
              </SimpleTooltip>
            );
          })}
        </div>
      )}
      {labelMarkers.map((m) => (
        <div
          key={m.id}
          style={
            {
              position: "absolute",
              positionAnchor: `--cobe-${m.id}`,
              bottom: "anchor(top)",
              left: "anchor(center)",
              translate: "-50% 0",
              marginBottom: "8px",
              padding: "0.2rem 0.5rem",
              background: "#006fff",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              borderRadius: "3px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              opacity: `var(--cobe-visible-${m.id}, 0)`,
              transition: "opacity 0.3s",
            } as React.CSSProperties
          }
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}

export function VisitorsMap({ countries = [] }: { countries?: CountryVisitor[] }) {
  const [mode, setMode] = useState<"Map" | "Globe">("Map");

  return (
    <div className="flex flex-col rounded-[4px] border-[0.5px] border-dash-border">
      <div className="flex flex-col gap-2 border-b-[0.5px] border-dash-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-dash-text-strong">Where your visitors are</h3>
          <p className="text-xs font-light text-dash-text-faded">
            {mode === "Map" ? "Geographic distribution over the last 7 days" : "Drag to rotate · last 7 days"}
          </p>
        </div>
        <SegmentedToggle options={["Map", "Globe"]} value={mode} onChange={(v) => setMode(v as "Map" | "Globe")} />
      </div>
      <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden bg-dash-bg-elevated px-4 py-6 sm:h-[460px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full w-full items-center justify-center"
          >
            {mode === "Map" ? <FlatMap countries={countries} /> : <Globe countries={countries} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
