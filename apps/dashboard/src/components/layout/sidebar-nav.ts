import { FeatureFlags } from "@/lib/feature-flags";

export const mainNav = [
  { label: "Home", icon: "/icons/home.svg", href: "/", tourId: "home" },
  { label: "Projects", icon: "/icons/project.svg", href: "/projects", tourId: "projects" },
  {
    label: "Domains",
    icon: "/icons/domains.svg",
    href: "/domains",
    flag: FeatureFlags.ENABLE_DOMAINS,
    tourId: "domains",
  },
  {
    label: "Scaling",
    icon: "/icons/scaling.svg",
    href: "/scaling",
    flag: FeatureFlags.ENABLE_AUTO_SCALING,
    tourId: "scaling",
  },
  {
    label: "Volumes & Snapshots",
    icon: "/icons/storage-menu.svg",
    href: "/volumes",
    flag: FeatureFlags.ENABLE_SANDBOX,
  },
  {
    label: "Sandboxes",
    icon: "/icons/sandbox-sidebar.svg",
    href: "/sandboxes",
    flag: FeatureFlags.ENABLE_SANDBOX,
  },
  {
    label: "Buckets",
    icon: "/icons/bucket.svg",
    href: "/buckets",
    flag: FeatureFlags.ENABLE_BUCKETS,
    comingSoon: true,
  },
];

export const moreNav = [
  {
    label: "Documentation",
    icon: "/icons/documentation.svg",
    href: "https://paper.brimble.io",
    external: true,
    tourId: "docs",
  },
  { label: "Discover", icon: "/icons/discover.svg", href: "/addons", tourId: "discover" },
];
