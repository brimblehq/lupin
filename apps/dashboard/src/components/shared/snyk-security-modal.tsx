import { useState } from "react";
import { Modal, ModalHeader, ModalCancelButton } from "./modal";
import { ChevronRight, ChevronDown, ShieldAlert } from "lucide-react";

export interface SnykSecurityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vulnerabilities: any[];
}

export function SnykSecurityModal({ open, onOpenChange, vulnerabilities }: SnykSecurityModalProps) {
  const [expandedSeverities, setExpandedSeverities] = useState<Set<string>>(new Set(["critical", "high"]));

  const toggleSeverity = (severity: string) => {
    setExpandedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const grouped = {
    critical: vulnerabilities?.filter((v) => v.severity === "critical") || [],
    high: vulnerabilities?.filter((v) => v.severity === "high") || [],
    medium: vulnerabilities?.filter((v) => v.severity === "medium") || [],
    low: vulnerabilities?.filter((v) => v.severity === "low") || [],
  };

  const severities = [
    { key: "critical", label: "Critical", color: "text-[#fc391e]" },
    { key: "high", label: "High", color: "text-[#ff7a00]" },
    { key: "medium", label: "Medium", color: "text-[#ffb020]" },
    { key: "low", label: "Low", color: "text-[#a3a3a3]" },
  ];

  const total = vulnerabilities?.length || 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={600}>
      <ModalHeader title="Security Scan Results" description={`Found ${total} vulnerabilities in your dependencies.`} />
      <div className="flex flex-col p-4 max-h-[60vh] overflow-y-auto">
        {total === 0 && (
          <div className="text-sm text-dash-text-faded text-center py-4">No vulnerabilities found.</div>
        )}
        {severities.map(({ key, label, color }) => {
          const items = grouped[key as keyof typeof grouped] || [];
          if (items.length === 0) return null;
          
          const isExpanded = expandedSeverities.has(key);
          
          return (
            <div key={key} className="mb-2 border border-dash-border rounded-md overflow-hidden">
              <button
                className="flex items-center justify-between w-full p-3 bg-dash-bg-elevated hover:bg-dash-bg-elevated/80 transition-colors text-left"
                onClick={() => toggleSeverity(key)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-dash-text-faded" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-dash-text-faded" />
                  )}
                  <ShieldAlert className={`w-4 h-4 ${color}`} />
                  <span className="font-medium text-sm text-dash-text-strong">
                    {label} ({items.length})
                  </span>
                </div>
              </button>
              
              {isExpanded && (
                <div className="flex flex-col gap-2 p-3 bg-dash-bg">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1 pb-2 border-b border-dash-border last:border-0 last:pb-0">
                      <span className="font-medium text-sm text-dash-text-strong">{item.title}</span>
                      <div className="flex items-center gap-2 text-xs text-dash-text-faded">
                        <span className="bg-dash-bg-elevated px-1.5 py-0.5 rounded">pkg: {item.packageName}</span>
                        <span className="bg-dash-bg-elevated px-1.5 py-0.5 rounded">v{item.version}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end p-4 border-t border-dash-border">
        <ModalCancelButton />
      </div>
    </Modal>
  );
}
