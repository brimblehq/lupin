import type { CorsRule } from "@/backend/storage";

interface CorsConfigSectionProps {
  rules: CorsRule[];
  canWrite: boolean;
}

export function CorsConfigSection({ rules, canWrite }: CorsConfigSectionProps) {
  if (rules.length === 0) {
    return (
      <div className="flex flex-col gap-1 border-y-[0.5px] border-dash-border py-8">
        <span className="text-sm text-dash-text-faded">No CORS rules configured</span>
        {canWrite && (
          <span className="text-xs text-dash-text-extra-faded">
            Add at least one rule to let browsers upload to this bucket from your apps.
          </span>
        )}
      </div>
    );
  }

  return (
    <ul className="border-t-[0.5px] border-dash-border">
      {rules.map((rule, index) => (
        <CorsRuleRow key={index} rule={rule} />
      ))}
    </ul>
  );
}

function CorsRuleRow({ rule }: { rule: CorsRule }) {
  return (
    <li className="flex items-center gap-4 border-b-[0.5px] border-dash-border py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs leading-[1.3]">
          <span className="truncate font-mono font-medium text-dash-text-body">
            {rule.allowedOrigins.length === 1 ? rule.allowedOrigins[0] : `${rule.allowedOrigins.length} origins`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs leading-[1.3] text-dash-text-faded">
          {rule.allowedMethods.map((method) => (
            <span
              key={method}
              className="rounded-[3px] border-[0.5px] border-dash-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-dash-text-faded"
            >
              {method}
            </span>
          ))}
          {typeof rule.maxAgeSeconds === "number" && <span className="ml-1">max-age {rule.maxAgeSeconds}s</span>}
        </div>
      </div>
    </li>
  );
}
