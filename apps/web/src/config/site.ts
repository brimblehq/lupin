export const siteConfig = {
  name: "Brimble",
  description: "Ship faster with Brimble: the all-in-one platform to deploy, scale, and manage every part of your stack.",
  navLinks: [
    { label: "Pricing", href: "/pricing" },
    { label: "Domains", href: "/domains" },
    { label: "Careers", href: "/careers" },
    { label: "Changelog", href: "/changelog" },
    { label: "FAQ", href: "/faq" },
    { label: "Docs", href: "https://paper.brimble.io" },
    { label: "Status", href: "https://status.brimble.io", status: true },
    // { label: "Talk to Founder", href: "https://cal.com/brimble/15min" },
  ],
  socials: {
    heading: "Follow Brimble",
    description: "Get product updates, release drops, and platform news from our official community channels.",
    links: [
      { label: "X (Twitter)", href: "https://x.com/brimblehq" },
      { label: "Discord", href: "https://discord.com/invite/XBCBwbXQJQ" },
    ],
  },
  hero: {
    heading: "Deploy Full-Stack Apps",
    subtitle:
      "Brimble gives developers the tools to Build, Launch, and Scale Apps — without managing servers or piecing together providers. Deploy full-stack apps, provision databases, and connect to AI models through a single platform.",
    primaryCta: "Get started for free",
    secondaryCta: "Watch video",
  },
  codePreview: {
    heading: "Host apps, databases, domains & MCP servers — all in one place.",
    descriptions: [
      "Deploy full-stack apps and connect custom domains with automatic HTTPS. Provision managed MySQL, Postgres, and Redis databases in seconds.",
      "Integrate with MCP servers and AI models through a unified gateway. Everything your stack needs, from first commit to global scale.",
    ],
  },
  steps: [
    {
      title: "Application Hosting",
      description: "Deploy and scale web apps instantly with zero DevOps setup.",
    },
    {
      title: "Database Hosting",
      description: "Launch production-ready databases in seconds with built-in backups.",
    },
    {
      title: "AI Gateway",
      description: "Connect to powerful AI models through a single, simplified API.",
    },
  ],
  stepsSection: {
    heading: "Simplify Your Deployment Workflow",
    description:
      "From frontend to backend, databases to AI — Brimble handles the infrastructure so you can focus on building. One platform, every layer of your stack.",
  },
  onboarding: {
    heading: "Brimble makes getting online easy and secure.",
    tabs: [
      {
        label: "Import repo",
        step: 1,
        title: "Import your repository",
        description:
          "Connect your GitHub account and import any repo. Brimble auto-detects your framework and build settings so you can deploy with zero configuration.",
      },
      {
        label: "Configure",
        step: 2,
        title: "Configure your build settings",
        description:
          "Set your framework, build command, and environment variables. Brimble auto-detects most settings so you can deploy with zero configuration.",
      },
      {
        label: "Deploy",
        step: 3,
        title: "Deploy to production",
        description:
          "Hit deploy and watch your app go live in seconds. Every push to your main branch triggers an automatic production deployment.",
      },
    ],
  },
  features: {
    heading: "Everything you need to build on the web.",
    items: [
      {
        label: "PLATFORM",
        title: "Instant Deployments",
        description: "Ship full stack apps & MCP servers in seconds. No complex setup is required.",
      },
      {
        title: "Readily available LLMs",
        description: "We provide endpoints to all the popular LLMs. Connect to powerful AI models through a single, simplified API.",
      },
      {
        title: "Provision databases in seconds",
        description: "Provision MySQL, Postgres, Redis and more in seconds. Launch production-ready databases with built-in backups.",
      },
      {
        title: "Usage-Based Pricing",
        description: "Pay only for what you use. No hidden fees, no surprises. Start for free, and upgrade when you're ready.",
      },
    ],
    footer:
      "Ship web apps, APIs, and AI workloads to production in seconds. Brimble auto-detects your framework, provisions databases, and scales with you — no DevOps required.",
  },
  integrations: {
    heading: "Supports all your favorite stacks and frameworks.",
    description:
      "Vue, Angular, Go, Laravel, and beyond — bring whatever you build with. Brimble delivers zero-config deployments for the frameworks and languages your team already uses.",
  },
  domains: {
    heading: "Buy Custom Domains",
    description:
      "Buy custom domains and use them on your projects. Register and manage your domains directly with Brimble — no third-party registrar needed.",
    cta: "Buy domain",
    searchPlaceholder: "Your domain",
    faqs: [
      {
        label: "DOMAINS",
        title: "Can I connect my own domain?",
        description:
          "Yes, you can connect any domain you already own to your Brimble projects. Just update your DNS settings and Brimble handles the rest.",
      },
      {
        title: "Do I get HTTPS with custom domains?",
        description: "Absolutely. Brimble automatically provisions SSL certificates for all custom domains at no extra cost.",
      },
      {
        title: "How do I manage DNS records?",
        description: "Brimble provides a simple DNS management interface where you can add, edit, and delete records for your domains.",
      },
      {
        title: "Can I transfer a domain to Brimble?",
        description:
          "Yes, you can transfer existing domains from other registrars to Brimble. The process is straightforward and we guide you through every step.",
      },
      {
        title: "Do you support subdomains?",
        description:
          "Yes, you can create unlimited subdomains for any domain managed on Brimble, perfect for staging and preview environments.",
      },
      {
        title: "What TLDs are available?",
        description:
          "We support all major TLDs including .com, .io, .dev, .app, .co, and many more. Check availability in the search bar above.",
      },
    ],
    footer:
      "Register and manage your domains directly with Brimble. Automatic HTTPS, DNS management, and seamless integration with your projects.",
  },
  pricing: {
    heading: "Pricing",
    description: "Brimble's pricing is designed to grow with your needs. Start for free, and upgrade when you're ready.",
    personalCta: "Get started",
    teamPlan: {
      pricePerMember: 5,
      pricePerBuild: 7.5,
      cta: "Create a team",
    },
    enterprise: {
      title: "Enterprise",
      description: "Custom solutions for large-scale deployments. Dedicated infrastructure, SLAs, and hands-on onboarding.",
      cta: "Contact us",
    },
    faqs: [
      {
        title: "What kind of apps can I host on Brimble?",
        description:
          "You can host static sites, full-stack web apps, APIs, AI workloads, and more. Brimble supports Next.js, Node.js, Remix, Hono, Docker, Go, Laravel, and many other frameworks.",
      },
      {
        title: "Do I need to configure servers?",
        description: "No. Brimble handles all infrastructure for you — just connect your repo and deploy. No server management required.",
      },
      {
        title: "Does Brimble support backend APIs?",
        description:
          "Yes. You can deploy full-stack applications including backend APIs, serverless functions, and long-running processes.",
      },
      {
        title: "What is Brimble's AI API Gateway?",
        description:
          "Brimble provides a unified API gateway to access popular LLMs. Connect to powerful AI models through a single, simplified endpoint.",
      },
      {
        title: "How does billing work for AI models?",
        description:
          "AI model usage is token-based. Each plan includes a free token allowance, and additional tokens are billed based on usage.",
      },
      {
        title: "Can I still choose specific models?",
        description: "Yes. You have full control over which AI models to use. Our gateway supports all major providers and models.",
      },
    ],
  },
  faq: {
    heading: "Frequently Asked Questions",
    description: "Everything you need to know about Brimble. Can't find what you're looking for? Reach out to our support team.",
    categories: [
      {
        label: "GENERAL",
        items: [
          {
            title: "What is Brimble?",
            description:
              "Brimble is an all-in-one cloud platform that lets developers deploy, scale, and manage full-stack applications — without managing servers or piecing together providers.",
          },
          {
            title: "What kind of apps can I host on Brimble?",
            description:
              "You can host static sites, full-stack web apps, APIs, AI workloads, and more. Brimble supports Next.js, Node.js, Remix, Hono, Docker, Go, Laravel, and many other frameworks.",
          },
          {
            title: "Do I need to configure servers?",
            description:
              "No. Brimble handles all infrastructure for you — just connect your repo and deploy. No server management required.",
          },
          {
            title: "How do I get started?",
            description:
              "Sign up for a free account, connect your GitHub repository, and deploy. Brimble auto-detects your framework and build settings so you can go live in seconds.",
          },
        ],
      },
      {
        label: "DEPLOYMENTS",
        items: [
          {
            title: "How do deployments work?",
            description:
              "Connect your GitHub repo and every push to your main branch triggers an automatic production deployment. You can also deploy manually or set up preview deployments for pull requests.",
          },
          {
            title: "Does Brimble support backend APIs?",
            description:
              "Yes. You can deploy full-stack applications including backend APIs, serverless functions, and long-running processes.",
          },
          {
            title: "Can I deploy Docker containers?",
            description:
              "Yes. Brimble supports Docker-based deployments, giving you full control over your runtime environment and dependencies.",
          },
          {
            title: "What happens if a deployment fails?",
            description:
              "Brimble automatically rolls back to the last successful deployment. You can also manually rollback to any previous deployment from your dashboard.",
          },
        ],
      },
      {
        label: "AI & MODELS",
        items: [
          {
            title: "What is Brimble's AI API Gateway?",
            description:
              "Brimble provides a unified API gateway to access popular LLMs. Connect to powerful AI models through a single, simplified endpoint.",
          },
          {
            title: "How does billing work for AI models?",
            description:
              "AI model usage is token-based. Each plan includes a free token allowance, and additional tokens are billed based on usage.",
          },
          {
            title: "Can I still choose specific models?",
            description: "Yes. You have full control over which AI models to use. Our gateway supports all major providers and models.",
          },
        ],
      },
      {
        label: "DOMAINS & SSL",
        items: [
          {
            title: "Can I connect my own domain?",
            description:
              "Yes, you can connect any domain you already own to your Brimble projects. Just update your DNS settings and Brimble handles the rest.",
          },
          {
            title: "Do I get HTTPS with custom domains?",
            description: "Absolutely. Brimble automatically provisions SSL certificates for all custom domains at no extra cost.",
          },
          {
            title: "Can I buy domains through Brimble?",
            description:
              "Yes. You can search for, register, and manage domains directly from the Brimble dashboard — no third-party registrar needed.",
          },
          {
            title: "Can I transfer a domain to or from Brimble?",
            description:
              "Yes. To transfer a domain in, open Domains → Transfer in, enter your domain and authorization (EPP) code, and confirm. To transfer out, open the domain's settings and request a transfer code to share with your new registrar.",
          },
        ],
      },
      {
        label: "BILLING & PLANS",
        items: [
          {
            title: "Is there a free plan?",
            description:
              "Yes. Brimble's free plan includes automatic HTTPS, static site deployments, 5 projects, 300 build minutes, and 10 GB bandwidth — no credit card required.",
          },
          {
            title: "How does usage-based pricing work?",
            description:
              "You pay only for what you use beyond your plan's included resources. There are no hidden fees or surprises — usage is tracked in real time on your dashboard.",
          },
          {
            title: "Can I upgrade or downgrade anytime?",
            description:
              "Yes. You can switch plans at any time. Upgrades take effect immediately, and downgrades apply at the start of your next billing cycle.",
          },
        ],
      },
    ],
  },
  cta: {
    heading: "Start your free trial today.",
    footer: "Spend little to no time on DevOps and more time building. Super efficient way to host & scale your web app.",
    buttons: {
      primary: "Get started",
      secondary: "Terms & conditions",
      tertiary: "Contact us",
    },
  },
  changelog: {
    eyebrow: "Changelog",
    heading: "What's new",
    description: "Recent updates from the Brimble team.",
    viewAllCta: "View all updates",
    page: {
      heading: "Changelog",
      description: "What we've been shipping. Updated every friday.",
      empty: "No updates yet — check back soon.",
    },
  },
} as const;
