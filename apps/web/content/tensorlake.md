[Home](https://www.tensorlake.ai/) [Blog](https://www.tensorlake.ai/blog) [Pricing](https://www.tensorlake.ai/pricing) [Careers](https://www.tensorlake.ai/careers) [Docs](https://docs.tensorlake.ai/introduction) [GitHub](https://github.com/tensorlakeai/tensorlake) [Slack community](https://join.slack.com/t/tensorlakecloud/shared_invite/zt-32fq4nmib-gO0OM5RIar3zLOBm~ZGqKg)

[Talk to Founder](https://calendly.com/diptanu-tensorlake/tensorlake-meeting) [Dashboard →](https://cloud.tensorlake.ai/login)

# Lightspeed _AI native_ sandboxes.

Stateful compute for durable agentic loops + isolated tool/code execution. Pause mid-run, resume hours later in the exact state you left.

[Get started for free →](https://cloud.tensorlake.ai/login) [Read the docs](https://docs.tensorlake.ai/sandboxes/introduction)

Free tier included. No credit card required.

Copy setup for my agents● RUNNING

Pythonsandbox.pyTypeScriptsandbox.tsCLI~ $ tensorlake

$npm i tensorlake [Get API Key →](https://cloud.tensorlake.ai/login)

```
import { Sandbox } from "tensorlake";

async function main() {
  const sbx = await Sandbox.create();
  const result = await sbx.run("/bin/sh", { args: ["-c", "npm install && npm run build"] });
  console.log(result.stdout);
}
main();
```

CLICK TO COPY

$npx tsx sandbox.tsRAN

✓ sandbox created sbx\_rhcj28c · tensorlake/ubuntu-minimal · 460 ms

✓ npm install (143 pkgs) · 1.7 s

✓ npm run build · compiled in 4.8 s

Startup< 300 ms

Concurrent1M+

FilesystemNear SSD

Uptime99.99%

\[ NO TRADEOFFS \]

### Other sandboxes force a tradeoff. We refuse to make one.

SIZED ON THE FLY, NOT UPFRONTPass CPU, memory, and disk as arguments on every API call. No VM templates to define, no fixed tiers to pick from — ask for 2 vCPU and 8 GB for one job, 32 vCPU and 200 GB for the next.

SNAPSHOT, CLONE, REPLICATETake a point-in-time snapshot of a running sandbox, fork it into N identical clones, and replicate them across the cluster — all with the exact same memory, disk, and process state.

STATEFUL, LIVE MIGRATEDNamed sandboxes live-migrate across hosts and can run forever. Suspend, snapshot, or fork mid-run and resume in the exact same state.

CUSTOMIZABLE RUNTIMESSpin up a minimal sandbox in under 200 ms for latency-sensitive tool calls and agent harnesses — or boot one with systemd to run Docker and virtually any Linux software for RL training environments and coding agents.

AGENT HARNESSES **02 / 06**

## Sandboxes for running agent harnesses.

SDK

**python · typescript**

\[ 02.1 \] · HARNESS MODE

### Run the agent itself inside an isolated, stateful computer.

The sandbox mode for browsing agents, research harnesses, and long-running sessions that need files, bash, packages, and working state — instead of running on the app server.

ISOLATED RUNTIME FOR THE HARNESS

Give the agent its own filesystem, shell, packages, and processes instead of sharing the app server runtime.

STATEFUL BY DEFAULT

Sandbox sleeps on inactivity, wakes instantly when invoked.

BUILT FOR LONG-RUNNING SESSIONS

Near-SSD speed in a VM, 2× faster than Vercel, 5× faster than E2B.

REAL SOFTWARE STACKS

Compile code, run databases, process 5GB files. Bring any Linux stack.

[Read the docs →](https://docs.tensorlake.ai/introduction)

SANDBOX · HARNESS \| ubuntu-minimal$ @anthropic-ai/claude-agent-sdk

Claude Agent SDKclaude.tsOpenAI Agentsopenai.tsPi Coding Agentpi.ts

Copy

```
// Run Claude Code agent inside an isolated sandbox
import { Sandbox } from "tensorlake";

const sbx = await Sandbox.create();
await sbx.exec("npm i -g @anthropic-ai/claude-agent-sdk");
await sbx.exec(
  "claude -p 'Refactor src/**/*.ts for stricter types'"
);
```

BENCHMARKS **03 / 06**

## The fastest sandbox file system.

METHOD

**fio · sqlite · p50**

### SQLite benchmark — 2 vCPU, 4 GB RAM, 100k inserts

[View benchmark on GitHub→](https://github.com/tensorlakeai/sandbox-sqlite-bench)

Tensorlake

2.45s1.0×

Vercel

3.00s1.2×

E2B

3.92s1.6×

Modal

4.66s1.9×

Daytona

5.51s2.2×

FSYNC4.1×

SEQ WRITE2.8×

RAND READ1.9×

COLD START84ms

In our published SQLite benchmark across Tensorlake, Vercel, E2B, Daytona, and Modal, Tensorlake was the fastest across default, fsync, and large-dataset runs. Benchmark setup: 2 vCPU / ~4 GB sandboxes, 3 runs.

ISOLATED TOOL EXECUTION **04 / 06**

## Isolated execution environments for running tools.

PATTERN

**ephemeral · per-call**

\[ 03.1 \] · TOOL MODE

### Create isolated sandboxes only when a tool needs risky or heavy execution.

The pattern for code interpreters, browser helpers, and tool-calling agents that should not run untrusted code inside the harness itself. Keep the harness outside; spin up sandboxes per call.

RUN LLM-GENERATED CODE AWAY FROM THE HARNESS

Execute code, browsers, or system tasks in a separate sandbox so the main agent never shares its runtime.

CONTROL THE NETWORK PER SANDBOX

Predictable throughput means fresh sessions spin up immediately, even when a thousand others are mid-task.

SIZE SANDBOXES DYNAMICALLY AT RUNTIME

Every session gets its own sandbox so untrusted code can't touch system integrity or leak data across sessions.

FIRECRACKER ISOLATION

Hardware virtualization boundary per call. LLMs can't escape the sandbox to touch your data.

[Read the docs →](https://docs.tensorlake.ai/introduction)

SANDBOX · TOOL \| ephemeral$ @anthropic-ai/sdk

Claude tool\_useclaude-tool.tsOpenAI functionopenai-tool.ts

Copy

```
// Claude agent with a Tensorlake sandbox as its code-exec tool
import Anthropic from "@anthropic-ai/sdk";
import { Sandbox } from "tensorlake";

const claude = new Anthropic();
const sbx = await Sandbox.create();

const msg = await claude.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools: [{\
    name: "run_in_sandbox",\
    description: "Run code in an isolated Tensorlake sandbox.",\
    input_schema: { type: "object", properties: { code: { type: "string" } } }\
  }],
  messages: [{ role: "user", content: "Plot fib(20) as a line chart." }],
});

// Dispatch Claude's tool call into the sandbox
const call = msg.content.find(b => b.type === "tool_use");
const out = await sbx.exec(`python -c ${JSON.stringify(call.input.code)}`);
console.log(out.stdout);
```

RL ENVIRONMENTS **05 / 06**

## Infrastructure for RL rollouts and evals.

SCALE

**10k+ envs / fan-out**

\[01\]

#### Prepare once, clone many

Snapshot a warmed environment — deps, weights, data — and clone it thousands of times in parallel. Pay once for setup.

\[02\]

#### Known starting state

Files, packages, processes and seeds are reproducible across every rollout. No flakey drift across workers.

\[03\]

#### Scale rollouts & evals

Fan out to 10k+ concurrent environments. Checkpoint at any step, resume at any step, write to object storage.

\[04\]

#### Dynamic resource alloc

Choose CPU, memory, GPU and image per environment. Rightsize rollouts to minutes of wall-clock.

ORCHESTRATION **06 / 06**

## Sandbox-native orchestration for agents.

LAYER

**endpoints · durability**

\[ 06.1 \] · ORCHESTRATE

### Once sandbox usage turns into a real application, Orchestrate coordinates it.

The layer that adds application endpoints, durability, fan-out, retries, and application-level observability on top of sandbox execution.

APPLICATION ENDPOINTS

Expose sandbox-backed workflows as callable applications instead of stitching together raw VM APIs.

DISTRIBUTED FAN-OUT

Predictable throughput means fresh sessions spin up immediately, even when a thousand others are mid-task.

WAKE ON REQUEST

Dormant sandboxes resume on incoming traffic. Every session gets its own sandbox so nothing leaks across runs.

QUEUES, TIMERS, AND RETRIES

Durable primitives for long-running agentic flows. Application observability baked in.

[Read the docs →](https://docs.tensorlake.ai/introduction)

ORCHESTRATE · APP \| doc-to-md$ tl app deploy

Doc → Markdowndoc\_to\_md.pyCronticker.pyMap-reducepipeline.py

Copy

```
# PDF → Markdown with Claude
from tensorlake.applications import application, function
from anthropic import Anthropic

claude = Anthropic()

@application()
@function()
def to_markdown(pdf_url: str) -> str:
    pdf = fetch(pdf_url)
    msg = claude.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=8192,
        messages=[{"role": "user", "content": [\
            {"type": "document", "source": pdf},\
            {"type": "text", "text": "Convert to clean Markdown."},\
        ]}],
    )
    return msg.content[0].text
```

CUSTOMER SIGNAL **07**

## Used by engineering teams shipping agents in production.

SAMPLE

**n = 14 interviews**

Tensorlake let us ship faster and stay reliable from day one. Complex stateful AI workloads that used to require serious infra engineering are now just long-running functions. As we scale, that means we can stay lean — building product, not managing infrastructure.

AB

Arpan BhattacharyaCEO, The Intelligent Search Company

At SIXT, we're building AI-powered experiences for millions of customers while managing the complexity of enterprise-scale data. Tensorlake gives us the foundation we need — reliable document ingestion that runs securely in our VPC to power our generative AI initiatives.

BD

Boyan DimitrovCTO, Sixt

Tensorlake enabled us to avoid building and operating an in-house OCR pipeline by providing a robust, scalable OCR and document ingestion layer with excellent accuracy and feature coverage.

YS

Yaroslav SklabinskyiPrincipal Software Engineer, Reliant AI

With Tensorlake, we've been able to handle complex document parsing and data formats that many other providers don't support natively, at a throughput that significantly improves our application's UX. The team's responsiveness stands out.

VD

Vincent Di PietroFounder, Novis AI

DEPLOY & TRUST **08**

## Run it in our cloud — or yours.

COMPLIANCE

**SOC 2 · HIPAA**

\[ 08 \] FOR TEAMS OUTGROWING SAAS

### Bring Tensorlake into your cloud.

Run sandboxes and applications inside your own AWS / GCP / Azure account when you need lower egress, stricter network boundaries, dedicated capacity or more predictable performance.

01

**Network boundaries** Keep code and data inside your preferred cloud boundary. VPC peering, private endpoints, IAM-scoped.

02

**Latency control** Compute closer to data. Tighten runtime behavior for latency-sensitive agent workloads.

03

**Reserved capacity** Move from usage-based hosted infra to capacity you plan, reserve, and operate predictably.

\[ 09 \] SECURITY

### Security built for agentic workflows.

LLM-generated code runs in isolated VMs, not shared processes. Full audit trails, per-project data boundaries, and compliance for regulated workloads.

01

**Firecracker isolation** Each tool call and harness runs in its own microVM. No shared kernel, no cross-tenant state.

02

**Tracing & observability** Full traces of every function and tool call — logs, timing, structured execution paths.

03

**SOC 2 Type II · HIPAA** Secure by default for PHI, PII and sensitive documents. Isolated buckets with RBAC and full audit.

▪ THE DOCUMENT DIGEST · WEEKLY

### Subscribe for release notes, benchmarks, deep dives.

Subscribe →

~ 3,400 ENGINEERS. MONTHLY. NO SPAM.

▪ THE INFRASTRUCTURE LAYER FOR AGENTS

## Ship agents faster  with Tensorlake.

$pip install tensorlake #  or:  npm i @tensorlake/sdk

[Get started for free →](https://cloud.tensorlake.ai/login) [Read the docs](https://docs.tensorlake.ai/introduction)
