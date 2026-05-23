# Coding Guidelines

These are the rules you follow when writing or modifying code in this codebase. Read them once, apply them always.

## 1. Separation of concerns

Keep functions, types, enums, and classes in their own files (or at minimum, their own clearly-scoped sections). Do not mix concerns.

- One responsibility per unit. A function does one thing; a class models one concept; a type describes one shape.
- Types and enums live in dedicated files (`types.ts`, `enums.ts`, or a `types/` / `enums/` folder) unless they are trivially local to a single consumer.
- Do not co-locate unrelated helpers inside a class or module just because they happen to touch the same data.
- If a file starts doing two jobs, split it.

## 2. Ternaries: short and flat, or not at all

Use a ternary only when it is short, single-line, and obvious at a glance.

```ts
// Good
const label = isActive ? 'on' : 'off';

// Bad — nested
const label = isActive ? (isAdmin ? 'admin-on' : 'user-on') : isAdmin ? 'admin-off' : 'user-off';
```

No nested ternaries. Ever. If branching gets past one level, use `if`/`else` or extract a function. Readability wins over cleverness.

## 3. Stop using `typeof` everywhere

`typeof` is a narrowing tool, not a default check. Do not reach for it when a simple truthy/falsy check is enough.

```ts
// Good
if (!user) return;
if (value) process(value);

// Bad
if (typeof user !== "undefined" && user !== null) { ... }
if (typeof value === "string" && value.length > 0) { ... }  // when you just need truthiness
```

Use `typeof` only when you genuinely need to discriminate primitive types (e.g. inside a union where `string | number` matters). Otherwise, trust truthiness, optional chaining, and nullish coalescing.

## 4. No over-engineered guard rails

Write defenses for realistic failure modes, not hypothetical ones.

- Validate at system boundaries (HTTP input, DB reads, external APIs). Do not re-validate the same data at every internal function call.
- No `assert` chains at the top of every function.
- No wrapping every call in try/catch "just in case" — let errors bubble to a single handler that knows what to do with them.
- If a guard clause is protecting against a case that cannot happen given the types, delete it.
- Prefer types and schemas over runtime paranoia.

The goal is correctness, not defensiveness theatre.

## 5. Follow popular conventions

Use the community standard for the language and ecosystem. Do not invent personal styles.

- **TypeScript/JavaScript**: ESLint + Prettier defaults, camelCase for variables/functions, PascalCase for types/classes, `kebab-case` or `camelCase` file names consistent with the project.
- **Go**: `gofmt`, idiomatic error handling (`if err != nil`), package names short and lowercase, no stutter.
- **Python**: PEP 8, `ruff`/`black` formatting, `snake_case`.
- Match the project's existing style before imposing anything new. When in doubt, grep the codebase and do what it already does.

## 6. Comments: only when they add something

Code should read itself. Comments are for things the code cannot say.

Write a comment when:

- The _why_ is non-obvious (business rule, workaround for an upstream bug, performance-sensitive choice).
- A public API needs a docstring for consumers.
- A `TODO` / `FIXME` with context and ownership.

Do not write a comment when:

- It restates the code (`// increment counter` above `counter++`).
- It narrates obvious control flow (`// loop through users`).
- It was auto-generated boilerplate that nobody reads.

Delete stale comments on sight. A wrong comment is worse than no comment.

## 7. Don't re-invent what already exists

Before writing a helper, check:

1. The language's stdlib.
2. The framework the project uses.
3. Utilities already in this codebase.

Do not write a custom `debounce`, `deepClone`, `groupBy`, UUID generator, date parser, retry loop, or config loader when a well-tested one is already available. Do not introduce a second HTTP client, a second logger, or a second error class when the repo already has one — use what's there.

The only reasons to roll your own: the existing option is genuinely insufficient, or pulling it in costs more than writing it.

## 8. No `any`, no `as unknown as T`

When types get annoying, fix the type — don't escape it.

- `any` is banned except at genuine interop edges (and even then, narrow immediately).
- `as` casts are a last resort. If you're writing `as unknown as T`, the real answer is usually a type guard, a discriminated union, or a schema parse (Zod, etc.).
- `// @ts-ignore` and `// @ts-expect-error` require a comment explaining why.

The type system earns its keep when you respect it.

## 9. Delete dead code

- No commented-out blocks "for reference." Git remembers.
- No unused imports, unused variables, unused parameters (prefix with `_` if the signature forces it).
- No stale feature flags still wired up months after launch.
- No "v2" helper sitting next to the original with no caller.

If it isn't used, it leaves.

## 10. Consistent error handling

Pick one error strategy per layer and stick to it.

- Don't mix `throw`, `Result<T, E>`, `null` returns, and `{ error, data }` tuples in the same module.
- Don't catch errors only to re-throw them unchanged — that's noise.
- Don't swallow errors with empty `catch {}`. If you genuinely want to ignore one, log it or leave a comment saying why.
- Handle errors at the layer that knows what to do with them (usually the HTTP handler or job runner), not at every function on the way down.

## 11. No magic numbers or magic strings

Named constants and enums beat literals scattered through the code.

```ts
// Bad
setTimeout(retry, 86400000);
if (user.status === "active") { ... }

// Good
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(retry, ONE_DAY_MS);
if (user.status === UserStatus.Active) { ... }
```

If a value appears more than once, or its meaning isn't obvious from the number/string alone, name it.

## 12. Async correctness

- Always `await` or explicitly handle the promise. No dangling promises.
- Parallelize independent work with `Promise.all`; don't serialize it in a `for` loop by accident.
- Don't mix `.then()` chains and `await` in the same function — pick one.
- Handle rejections. An unhandled rejection in production is a bug waiting to page you.

## 13. Don't mutate function arguments

Treat inputs as read-only. If you need a modified version, return a new one.

```ts
// Bad
function addTag(user, tag) {
  user.tags.push(tag);
  return user;
}

// Good
function addTag(user, tag) {
  return { ...user, tags: [...user.tags, tag] };
}
```

Hidden mutation through a function call is one of the worst bugs to trace in a large system.

## 14. Respect the codebase's existing patterns

Before introducing something new, look around:

- If the project uses a specific HTTP client, logger, error class, config loader, or validation library — use it.
- If there's an established folder structure, follow it.
- If there's a naming convention in neighboring files, match it.

Don't bring in a new dependency or pattern just because it's what you reached for first. Consistency across the codebase is worth more than any individual preference.

## 15. No hardcoded environment values

URLs, ports, credentials, feature flags, and tunable limits belong in config or environment variables — not in source.

- Secrets never land in the repo. Not even temporarily.
- Defaults for local dev are fine in a `.env.example` or config file, but the real values are injected.
- If a value differs between staging and prod, it's config.

## 16. Validate inputs with a schema, not by hand

When a server fn / route handler / API boundary receives a payload, validate it with **yup** (or zod where already used). Don't write `if (!x.trim()) throw ...` ladders or hand-rolled regex checks beside the handler.

```ts
// Bad — manual labour, easy to drift, no shared error shape
const code = String(payload?.code ?? "").trim();
if (!/^\d{6}$/.test(code)) throw new Error("Enter a valid 6-digit code");
if (!payload?.action) throw new Error("Action required");

// Good — declarative, reusable, errors are uniform
const schema = Yup.object({
  code: Yup.string().required().matches(/^(\d{6}|[A-Za-z0-9]{8})$/, "Enter a 6-digit code or 8-character recovery code"),
  action: Yup.string().trim().required(),
  resourceId: Yup.string().trim().required(),
});
const { code, action, resourceId } = schema.validateSync(payload, { stripUnknown: true });
```

Why:
- One place to read the contract instead of decoding scattered if-statements.
- Error messages are co-located with the rule that produced them.
- Same schema can be reused on the client form, eliminating drift.
- `stripUnknown` prevents accidental field passthrough.

Reach for hand-rolled checks only for trivial single-field guards (`if (!id) throw` is fine).

## 17. No unnecessary fallbacks

Fallbacks for cases that cannot happen are not "safe defaults" — they are bloat. Each one adds a line a future reader has to mentally execute, hides bugs by silently coercing them into wrong-but-plausible data, and lies to the type system about what the contract actually is.

Do not write a fallback when:

- The type already guarantees the value exists (`user.name ?? "Unknown"` on a `name: string` field).
- The value comes from a schema that already validated it.
- The "fallback" branch would only fire in a state your code path cannot produce.
- You are guarding a function's own return value against a possibility its signature rules out.

```ts
// Bad — Volume.name is `string`, the ?? branch is dead code
<span>{volume.name ?? "Untitled volume"}</span>

// Bad — schema already required `email`; the fallback is theatre
const email = parsed.email || "no-email@unknown.local";

// Bad — wrapping a guaranteed-sync call to "protect" callers
try {
  return formatRelativeTime(date);
} catch {
  return "recently";
}
```

```ts
// Good — trust the type, let real bugs surface
<span>{volume.name}</span>
const { email } = schema.validateSync(payload);
return formatRelativeTime(date);
```

Legitimate fallbacks: parsing untrusted input, optional fields the type explicitly marks as `T | undefined`, network responses where partial data is documented behaviour. Outside those, delete the fallback.

A fallback you can't explain in one sentence — "this fires when X happens, and the right user-facing behaviour is Y" — is a fallback that shouldn't exist.

---

## Summary

Clean separation, flat logic, minimal runtime paranoia, community idioms, and comments only where they earn their place. Reuse what exists, respect the type system, delete what's dead, handle errors consistently, and keep configuration out of source. If a change adds complexity without earning it, reject the change.
