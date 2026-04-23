import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "brimble:product-tour-completed";

export function hasCompletedTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "true" }));
  } catch {
    // ignore
  }
}

type PopoverSide = "top" | "right" | "bottom" | "left" | "over";

interface TourStepDef {
  tourId: string;
  title: string;
  description: string;
  side?: PopoverSide;
}

const steps: TourStepDef[] = [
  {
    tourId: "home",
    title: "Home",
    description: "Your command center — recent activity, usage, and quick links to your top projects.",
    side: "right",
  },
  {
    tourId: "projects",
    title: "Projects",
    description: "Every app you've deployed lives here. Open one to manage deploys, env vars, and logs.",
    side: "right",
  },
  {
    tourId: "domains",
    title: "Domains",
    description: "Connect and manage custom domains for your projects from one place.",
    side: "right",
  },
  {
    tourId: "scaling",
    title: "Scaling",
    description: "Tune auto-scaling, instance sizes, and resource limits for your services.",
    side: "right",
  },
  {
    tourId: "discover",
    title: "Discover",
    description: "Browse add-ons and integrations to extend what your projects can do.",
    side: "right",
  },
  {
    tourId: "docs",
    title: "Documentation",
    description: "Guides, API references, and troubleshooting — everything you need to ship faster.",
    side: "right",
  },
];

export function startProductTour(): void {
  const activeSteps: DriveStep[] = steps
    .filter((step) => document.querySelector(`[data-tour-item="${step.tourId}"]`))
    .map((step) => ({
      element: `[data-tour-item="${step.tourId}"]`,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? "right",
        align: "start",
      },
    }));

  if (activeSteps.length === 0) return;

  const instance = driver({
    showProgress: true,
    allowClose: true,
    stagePadding: 4,
    stageRadius: 6,
    popoverClass: "brimble-tour-popover",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Done",
    progressText: "{{current}} of {{total}}",
    steps: activeSteps,
    onDestroyed: () => markTourCompleted(),
  });

  instance.drive();
}
