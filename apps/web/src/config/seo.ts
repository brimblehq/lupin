const SITE_URL = "https://brimble.io";
const SITE_NAME = "Brimble";
const DEFAULT_TITLE = "Brimble - The only cloud platform you’ll ever need";
const DEFAULT_DESCRIPTION = "Ship faster with Brimble: the all-in-one platform to deploy, scale, and manage every part of your stack.";
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;
const TWITTER_CREATOR = "@brimblehq";

const KEYWORDS = Array.from(
  new Set([
    "brimble",
    "vercel",
    "vercel alternatives",
    "netlify",
    "netlify alternatives",
    "web hosting",
    "deployment",
    "scaling",
    "developer tools",
    "cloud hosting",
    "web apps",
    "easy deployment",
    "fast hosting",
    "reliable hosting",
    "developer platform",
    "next.js",
    "react",
    "nextjs",
    "nextjs hosting",
    "nextjs deployment",
    "nextjs scaling",
    "nextjs developer tools",
    "nextjs cloud hosting",
    "nextjs web apps",
    "nextjs easy deployment",
    "nextjs fast hosting",
    "nextjs reliable hosting",
    "nextjs developer platform",
    "heroku",
    "heroku alternatives",
    "aws",
    "aws alternatives",
    "google cloud",
    "google cloud alternatives",
    "digitalocean",
    "digitalocean alternatives",
    "cloudflare",
    "cloudflare alternatives",
    "brimble alternatives",
    "brimble web hosting",
    "brimble deployment",
    "brimble scaling",
    "brimble developer tools",
    "brimble cloud hosting",
    "brimble web apps",
    "brimble easy deployment",
    "brimble fast hosting",
    "brimble reliable hosting",
    "brimble developer platform",
    "brimble next.js",
    "brimble react",
    "brimble nextjs",
    "brimble nextjs hosting",
    "brimble nextjs deployment",
    "brimble nextjs scaling",
    "brimble nextjs developer tools",
    "brimble nextjs cloud hosting",
    "brimble nextjs web apps",
    "brimble nextjs easy deployment",
    "brimble nextjs fast hosting",
    "brimble nextjs reliable hosting",
    "brimble nextjs developer platform",
  ]),
);

type SeoHeadInput = {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
};

function getCanonicalUrl(path = "/") {
  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  return new URL(normalizedPath, SITE_URL).toString();
}

function getPageTitle(title?: string) {
  return title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
}

export function buildSeoHead({ title, description = DEFAULT_DESCRIPTION, path = "/", noIndex = false }: SeoHeadInput = {}) {
  const pageTitle = getPageTitle(title);
  const url = getCanonicalUrl(path);
  const robots = noIndex ? "noindex, nofollow" : "index, follow";

  return {
    meta: [
      { title: pageTitle },
      { name: "description", content: description },
      { name: "keywords", content: KEYWORDS.join(", ") },
      { name: "author", content: "Brimble Team" },
      { name: "creator", content: "Brimble Team" },
      { name: "publisher", content: "Brimble" },
      { name: "robots", content: robots },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: DEFAULT_TITLE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: OG_IMAGE_URL },
      { name: "twitter:creator", content: TWITTER_CREATOR },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
