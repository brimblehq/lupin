export type SandboxStatus = "ACTIVE" | "STOPPED" | "BUILDING" | "FAILED";

export interface Sandbox {
  id: string;
  slug: string;
  name: string;
  description?: string;
  template: string;
  templateLogo?: string;
  region: string;
  status: SandboxStatus;
  cpu: number;
  memoryGb: number;
  diskGb: number;
  publicUrl: string;
  internalUrl: string;
  createdAt: string;
  lastActiveAt: string;
  autoStop: boolean;
  idleTimeoutMins: number;
  envVars: { key: string; value: string }[];
}

export const SANDBOX_TEMPLATES: { id: string; label: string; icon?: string }[] = [
  { id: "python-3.12", label: "Python 3.12" },
  { id: "node-22", label: "Node.js 22" },
  { id: "bun-1", label: "Bun 1.x" },
  { id: "deno-2", label: "Deno 2" },
  { id: "ubuntu-24", label: "Ubuntu 24.04" },
];

export const SANDBOX_REGIONS: { id: string; label: string }[] = [
  { id: "us-east-1", label: "US East (N. Virginia)" },
  { id: "us-west-2", label: "US West (Oregon)" },
  { id: "eu-west-1", label: "Europe (Ireland)" },
  { id: "eu-central-1", label: "Europe (Frankfurt)" },
  { id: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { id: "af-south-1", label: "Africa (Cape Town)" },
];

export const IDLE_TIMEOUTS: { id: string; label: string; minutes: number }[] = [
  { id: "10m", label: "10 minutes", minutes: 10 },
  { id: "30m", label: "30 minutes", minutes: 30 },
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "4h", label: "4 hours", minutes: 240 },
  { id: "never", label: "Never", minutes: 0 },
];

export const DESTROY_TIMEOUTS: { id: string; label: string; minutes: number }[] = [
  { id: "7d", label: "7 days", minutes: 10080 },
  { id: "30d", label: "30 days", minutes: 43200 },
  { id: "60d", label: "60 days", minutes: 86400 },
  { id: "90d", label: "90 days", minutes: 129600 },
];

export const SNAPSHOT_FREQUENCIES: { id: string; label: string }[] = [
  { id: "manual", label: "Manual only" },
  { id: "hourly", label: "Every hour" },
  { id: "6h", label: "Every 6 hours" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
];

export const MOCK_SANDBOXES: Sandbox[] = [
  {
    id: "sbx_01H8X9Y2Z",
    slug: "research-agent",
    name: "research-agent",
    description: "LangGraph agent that scrapes and summarises competitor releases.",
    template: "AI Agent (Python + LangGraph)",
    region: "US East (N. Virginia)",
    status: "ACTIVE",
    cpu: 2,
    memoryGb: 4,
    diskGb: 20,
    publicUrl: "https://research-agent-7f2k.brimble.run",
    internalUrl: "research-agent-7f2k.sandbox.internal:8080",
    createdAt: "Apr 14, 2026",
    lastActiveAt: "2 minutes ago",
    autoStop: true,
    idleTimeoutMins: 30,
    envVars: [
      { key: "OPENAI_API_KEY", value: "sk-•••••••••••" },
      { key: "TAVILY_API_KEY", value: "tvly-•••••••" },
    ],
  },
  {
    id: "sbx_01H8X9Y3A",
    slug: "pdf-extractor",
    name: "pdf-extractor",
    description: "Pulls structured fields out of vendor invoices.",
    template: "Python 3.12",
    region: "Europe (Ireland)",
    status: "BUILDING",
    cpu: 1,
    memoryGb: 2,
    diskGb: 10,
    publicUrl: "https://pdf-extractor-2k9m.brimble.run",
    internalUrl: "pdf-extractor-2k9m.sandbox.internal:8080",
    createdAt: "Apr 22, 2026",
    lastActiveAt: "Building now",
    autoStop: true,
    idleTimeoutMins: 10,
    envVars: [],
  },
  {
    id: "sbx_01H8X9Y4B",
    slug: "scraper-staging",
    name: "scraper-staging",
    template: "Node.js 22",
    region: "US West (Oregon)",
    status: "STOPPED",
    cpu: 0.5,
    memoryGb: 1,
    diskGb: 5,
    publicUrl: "https://scraper-staging-1d3p.brimble.run",
    internalUrl: "scraper-staging-1d3p.sandbox.internal:8080",
    createdAt: "Apr 9, 2026",
    lastActiveAt: "3 days ago",
    autoStop: true,
    idleTimeoutMins: 60,
    envVars: [{ key: "PROXY_URL", value: "https://proxy.internal:3128" }],
  },
  {
    id: "sbx_01H8X9Y5C",
    slug: "embedding-worker",
    name: "embedding-worker",
    description: "Bulk-embeds support tickets nightly.",
    template: "Bun 1.x",
    region: "Europe (Frankfurt)",
    status: "ACTIVE",
    cpu: 4,
    memoryGb: 8,
    diskGb: 40,
    publicUrl: "https://embedding-worker-9c7t.brimble.run",
    internalUrl: "embedding-worker-9c7t.sandbox.internal:8080",
    createdAt: "Mar 28, 2026",
    lastActiveAt: "12 minutes ago",
    autoStop: false,
    idleTimeoutMins: 0,
    envVars: [
      { key: "DB_URL", value: "postgres://•••" },
      { key: "QDRANT_URL", value: "https://qdrant.internal" },
    ],
  },
  {
    id: "sbx_01H8X9Y6D",
    slug: "image-classifier",
    name: "image-classifier",
    template: "Python 3.12",
    region: "Asia Pacific (Mumbai)",
    status: "FAILED",
    cpu: 2,
    memoryGb: 4,
    diskGb: 20,
    publicUrl: "https://image-classifier-3a8f.brimble.run",
    internalUrl: "image-classifier-3a8f.sandbox.internal:8080",
    createdAt: "Apr 18, 2026",
    lastActiveAt: "1 hour ago",
    autoStop: true,
    idleTimeoutMins: 30,
    envVars: [],
  },
  {
    id: "sbx_01H8X9Y7E",
    slug: "ubuntu-playground",
    name: "ubuntu-playground",
    description: "General sandbox for one-off shell experiments.",
    template: "Ubuntu 24.04",
    region: "Africa (Cape Town)",
    status: "STOPPED",
    cpu: 1,
    memoryGb: 2,
    diskGb: 10,
    publicUrl: "https://ubuntu-playground-5q1v.brimble.run",
    internalUrl: "ubuntu-playground-5q1v.sandbox.internal:8080",
    createdAt: "Apr 2, 2026",
    lastActiveAt: "5 days ago",
    autoStop: true,
    idleTimeoutMins: 10,
    envVars: [],
  },
];

export type TerminalLineLevel = "stdout" | "stderr" | "command" | "system";

export interface TerminalLine {
  id: string;
  level: TerminalLineLevel;
  text: string;
}

export const MOCK_TERMINAL_LINES: TerminalLine[] = [
  { id: "1", level: "system", text: "Connected to sandbox · runtime ready in 1.2s" },
  { id: "2", level: "command", text: "python main.py --task 'summarise weekly report'" },
  { id: "3", level: "stdout", text: "INFO  Loading model gpt-4o-mini" },
  { id: "4", level: "stdout", text: "INFO  Tools registered: web_search, fetch, write_memo" },
  { id: "5", level: "stdout", text: "STEP  ▸ web_search('vercel changelog april 2026')" },
  { id: "6", level: "stdout", text: "STEP  ◂ 8 results returned in 412ms" },
  { id: "7", level: "stdout", text: "STEP  ▸ fetch('https://vercel.com/changelog')" },
  { id: "8", level: "stderr", text: "WARN  retrying in 800ms (attempt 1/3)" },
  { id: "9", level: "stdout", text: "STEP  ◂ 14.3kB fetched, parsing markdown" },
  { id: "10", level: "stdout", text: "STEP  ▸ write_memo('Summary', body=…)" },
  { id: "11", level: "stdout", text: "DONE  Wrote summary to /workspace/output/2026-04-26.md" },
  { id: "12", level: "system", text: "Process exited with code 0 · 6.4s" },
];

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export const MOCK_LOG_ENTRIES: LogEntry[] = [
  { id: "1", timestamp: "12:04:01", level: "info", message: "Sandbox started · template=ai-agent region=us-east-1" },
  { id: "2", timestamp: "12:04:02", level: "info", message: "Mounting persistent disk /workspace (20GB)" },
  { id: "3", timestamp: "12:04:03", level: "debug", message: "Python venv resolved to /opt/venv" },
  { id: "4", timestamp: "12:04:09", level: "info", message: "Agent runtime listening on :8080" },
  { id: "5", timestamp: "12:05:11", level: "info", message: "Inbound request POST /run from 102.89.4.21" },
  { id: "6", timestamp: "12:05:12", level: "warn", message: "Rate limit warning: tavily 4/5 requests used in window" },
  { id: "7", timestamp: "12:05:18", level: "info", message: "Job 8c1d completed in 6.4s" },
  { id: "8", timestamp: "12:07:42", level: "error", message: "Tool call failed: fetch timeout after 8s" },
  { id: "9", timestamp: "12:07:43", level: "info", message: "Retry succeeded on attempt 2" },
  { id: "10", timestamp: "12:09:00", level: "debug", message: "Idle timer reset · 30 min" },
];

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  content?: string;
}

export const MOCK_FILE_TREE: FileNode = {
  name: "workspace",
  path: "/workspace",
  type: "dir",
  children: [
    {
      name: "main.py",
      path: "/workspace/main.py",
      type: "file",
      content: `from agent import build_agent\nfrom dotenv import load_dotenv\n\nload_dotenv()\n\ndef main():\n    agent = build_agent()\n    result = agent.run("summarise weekly report")\n    print(result)\n\nif __name__ == "__main__":\n    main()\n`,
    },
    {
      name: "agent.py",
      path: "/workspace/agent.py",
      type: "file",
      content: `from langgraph.graph import StateGraph\nfrom tools import web_search, fetch, write_memo\n\ndef build_agent():\n    graph = StateGraph()\n    graph.add_node("search", web_search)\n    graph.add_node("fetch", fetch)\n    graph.add_node("write", write_memo)\n    graph.add_edge("search", "fetch")\n    graph.add_edge("fetch", "write")\n    return graph.compile()\n`,
    },
    {
      name: "tools",
      path: "/workspace/tools",
      type: "dir",
      children: [
        {
          name: "web_search.py",
          path: "/workspace/tools/web_search.py",
          type: "file",
          content: `import os\nimport httpx\n\nAPI = "https://api.tavily.com/search"\n\ndef web_search(query: str):\n    res = httpx.post(API, json={\n        "query": query,\n        "api_key": os.environ["TAVILY_API_KEY"],\n    })\n    res.raise_for_status()\n    return res.json()["results"]\n`,
        },
        {
          name: "fetch.py",
          path: "/workspace/tools/fetch.py",
          type: "file",
          content: `import httpx\n\ndef fetch(url: str) -> str:\n    return httpx.get(url, timeout=8).text\n`,
        },
      ],
    },
    {
      name: "output",
      path: "/workspace/output",
      type: "dir",
      children: [
        {
          name: "2026-04-26.md",
          path: "/workspace/output/2026-04-26.md",
          type: "file",
          content: `# Weekly summary — Apr 26 2026\n\n- Vercel shipped fluid-compute v2 with cold-start improvements.\n- Cloudflare AI Gateway now supports prompt caching.\n- Replit Agent left beta.\n`,
        },
      ],
    },
    {
      name: "requirements.txt",
      path: "/workspace/requirements.txt",
      type: "file",
      content: `langgraph==0.2.41\nhttpx==0.27.2\npython-dotenv==1.0.1\n`,
    },
  ],
};
