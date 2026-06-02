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

const MOBILE_NAV_EVENT = "brimble:set-mobile-nav";

function setMobileNav(open: boolean): void {
  window.dispatchEvent(new CustomEvent(MOBILE_NAV_EVENT, { detail: { open } }));
}

function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 767.98px)").matches;
}

// The same `data-tour-item` exists in both the desktop sidebar (hidden on mobile)
// and the mobile nav menu, so resolve to the element that is actually rendered
// and visible rather than relying on the selector (which would match the hidden one).
function findVisibleTourTarget(tourId: string): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>(`[data-tour-item="${tourId}"]`);
  for (const element of elements) {
    if (element.offsetParent === null) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

function buildSteps(mobile: boolean): DriveStep[] {
  return steps.flatMap((step) => {
    const element = findVisibleTourTarget(step.tourId);
    if (!element) return [];
    return [
      {
        element,
        popover: {
          title: step.title,
          description: step.description,
          side: mobile ? "bottom" : (step.side ?? "right"),
          align: "start" as const,
        },
      },
    ];
  });
}

function runTour(activeSteps: DriveStep[], onDestroyed: () => void): void {
  if (activeSteps.length === 0) {
    onDestroyed();
    return;
  }

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
    onDestroyed,
  });

  instance.drive();
}

export function startProductTour(): void {
  if (!isMobileViewport()) {
    runTour(buildSteps(false), () => markTourCompleted());
    return;
  }

  // Mobile: the nav items live behind the hamburger menu, so open it, wait for it
  // to render/animate in, then run the tour against the menu items.
  setMobileNav(true);

  const start = performance.now();
  const waitForMenu = () => {
    if (findVisibleTourTarget("home") || performance.now() - start > 1500) {
      // Small settle delay so the open animation has finished before highlighting.
      window.setTimeout(() => {
        runTour(buildSteps(true), () => {
          markTourCompleted();
          setMobileNav(false);
        });
      }, 200);
      return;
    }
    requestAnimationFrame(waitForMenu);
  };
  requestAnimationFrame(waitForMenu);
}
