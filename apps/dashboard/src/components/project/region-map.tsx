import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Plus, Minus } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Theme } from "@/types/enums";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface RegionLocation {
  country: string;
  coords: [number, number];
  label: string;
}

const REGION_LOCATIONS: Record<string, RegionLocation> = {
  "eu-central": { country: "Germany", coords: [10.4515, 51.1657], label: "Frankfurt, DE" },
  "eu-west": { country: "Ireland", coords: [-8.2439, 53.4129], label: "Dublin, IE" },
  "eu-north": { country: "Sweden", coords: [18.6435, 60.1282], label: "Stockholm, SE" },
  "us-east": { country: "United States of America", coords: [-77.0369, 38.9072], label: "Virginia, US" },
  "us-west": { country: "United States of America", coords: [-122.4194, 37.7749], label: "California, US" },
  "us-central": { country: "United States of America", coords: [-95.7129, 37.7749], label: "Texas, US" },
  "ap-south": { country: "India", coords: [72.8777, 19.076], label: "Mumbai, IN" },
  "ap-southeast": { country: "Singapore", coords: [103.8198, 1.3521], label: "Singapore" },
  "ap-northeast": { country: "Japan", coords: [139.6917, 35.6895], label: "Tokyo, JP" },
  "ap-east": { country: "Hong Kong", coords: [114.1694, 22.3193], label: "Hong Kong" },
  "me-central": { country: "United Arab Emirates", coords: [55.2708, 25.2048], label: "Dubai, AE" },
  "af-south": { country: "South Africa", coords: [18.4241, -33.9249], label: "Cape Town, ZA" },
  "af-west": { country: "Nigeria", coords: [3.3792, 6.5244], label: "Lagos, NG" },
  "sa-east": { country: "Brazil", coords: [-46.6333, -23.5505], label: "São Paulo, BR" },
  "ca-central": { country: "Canada", coords: [-79.3832, 43.6532], label: "Toronto, CA" },
  "au-southeast": { country: "Australia", coords: [151.2093, -33.8688], label: "Sydney, AU" },
};

function parseRegion(regionText: string): { id: string; country?: string; label: string } {
  // Examples: "eu-central (Germany)", "eu-central", "us-east (United States)"
  const trimmed = regionText.trim();
  const match = trimmed.match(/^([\w-]+)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { id: match[1], country: match[2], label: trimmed };
  }
  return { id: trimmed, label: trimmed };
}

export function RegionMap({ regionText }: { regionText: string }) {
  const { theme } = useTheme();
  const isDark = theme === Theme.Dark;
  const stroke = isDark ? "#3b6cf3" : "#9bb6ee";

  const { activeCountry, marker } = useMemo(() => {
    const parsed = parseRegion(regionText);
    const lookup = REGION_LOCATIONS[parsed.id.toLowerCase()];
    return {
      activeCountry: lookup?.country ?? parsed.country,
      marker: lookup,
    };
  }, [regionText]);

  const initialCenter: [number, number] = marker ? marker.coords : [0, 25];
  const initialZoom = marker ? 3 : 1;
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<[number, number]>(initialCenter);

  function handleZoomIn() {
    setZoom((z) => Math.min(z * 1.5, 8));
  }
  function handleZoomOut() {
    setZoom((z) => Math.max(z / 1.5, 1));
  }
  function handleReset() {
    setZoom(initialZoom);
    setCenter(initialCenter);
  }

  return (
    <div className="flex flex-1 flex-col overflow-clip rounded-lg">
      <div className="flex h-10 items-center justify-between border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-3 text-sm tracking-[-0.02px]">
        <span className="text-dash-text-strong">Serving region</span>
        <span className="font-mono text-xs text-dash-text-faded">{regionText}</span>
      </div>
      <div className="relative flex w-full items-center justify-center bg-dash-bg-elevated px-4 py-6">
        <div className="w-full" style={{ maxHeight: 360 }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 130, center: [0, 25] }}
            width={980}
            height={420}
            style={{ width: "100%", height: "auto", cursor: "grab" }}
            className="active:cursor-grabbing"
          >
            <ZoomableGroup
              center={center}
              zoom={zoom}
              minZoom={1}
              maxZoom={8}
              onMoveEnd={(pos) => {
                setZoom(pos.zoom);
                setCenter(pos.coordinates as [number, number]);
              }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const name = geo.properties?.name as string | undefined;
                    const isActive = !!activeCountry && name === activeCountry;
                    const fill = isActive ? "#006fff" : isDark ? "#243049" : "#dde3ee";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: {
                            fill,
                            stroke,
                            strokeWidth: 0.5,
                            outline: "none",
                          },
                          hover: {
                            fill,
                            stroke,
                            strokeWidth: 0.5,
                            outline: "none",
                          },
                          pressed: {
                            fill,
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
              {marker && (
                <Marker coordinates={marker.coords}>
                  <circle r={5 / Math.sqrt(zoom)} fill="#006fff" stroke="#ffffff" strokeWidth={1.5 / Math.sqrt(zoom)} />
                  <g transform={`translate(0, ${-14 / Math.sqrt(zoom)}) scale(${1 / Math.sqrt(zoom)})`}>
                    <rect x={-marker.label.length * 3.4} y={-12} width={marker.label.length * 6.8} height={16} rx={3} fill="#006fff" />
                    <text
                      textAnchor="middle"
                      y={0}
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        fontSize: "9px",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        fill: "#ffffff",
                        textTransform: "uppercase",
                      }}
                    >
                      {marker.label}
                    </text>
                  </g>
                </Marker>
              )}
            </ZoomableGroup>
          </ComposableMap>
        </div>
        <div className="absolute right-4 top-4 flex flex-col overflow-clip rounded-lg border-[0.5px] border-dash-border bg-dash-bg shadow-[0px_2px_6px_-2px_rgba(0,0,0,0.18)]">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 8}
            aria-label="Zoom in"
            className="flex size-7 items-center justify-center text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
          <div className="h-px bg-dash-border" />
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            aria-label="Zoom out"
            className="flex size-7 items-center justify-center text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="absolute bottom-4 right-4 rounded-lg border-[0.5px] border-dash-border bg-dash-bg px-2 py-1 text-[10px] font-medium text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
