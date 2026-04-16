# @console-one/walker

Path-based tree walker framework with a JSONPath walker implementation. Register handlers against dotted paths (`@.user.name`, `@.tags.0`), then walk a value and receive per-path callbacks when each registered path is found.

Use this when:
- You need to extract values from a nested structure by path.
- You want to react to multiple paths in a single pass (O(n) over the tree, not O(n × paths)).
- You want to plug in your own walker for non-JSON structures (extend `Walker`).

## Install

```bash
npm install @console-one/walker
```

## Usage

### `loadAll` — synchronous bulk extraction

Quickest way to pull several paths out of an object in one pass:

```ts
import { JSONPathWalker } from '@console-one/walker'

const walker = new JSONPathWalker(false)
const results = walker.loadAll(
  ['@.apple', '@.carrot.count', '@.mango.color'],
  {
    apple:  { color: 'red' },
    carrot: { color: 'orange' },
    mango:  { color: 'orange' },
  }
)
// results[0] → { color: 'red' }
// results[1] → undefined (carrot.count doesn't exist)
// results[2] → 'orange'
```

### `walk` + `Handler` — callback-per-match

For reactive/evaluative patterns where you want to be notified on each match:

```ts
import { JSONPathWalker, Handler } from '@console-one/walker'

const walker = new JSONPathWalker(false)  // errorOnUnfound = false

walker.addHandler('@.user.name', new Handler(
  (value) => console.log('name is', value),
  (err)   => console.error('name lookup failed', err),
))

walker.addHandler('@.user.roles.0', new Handler(
  (value) => console.log('primary role', value),
  (err)   => {}
))

walker.walk({
  user: {
    name: 'Andrew',
    roles: ['admin', 'editor']
  }
})
// → name is Andrew
// → primary role admin
```

Multiple handlers can be registered against the same path and all fire in order of registration.

### `errorOnUnfound`

```ts
const strict  = new JSONPathWalker(true)   // missing paths → error handler
const lenient = new JSONPathWalker(false)  // missing paths → complete() only
```

### Integration with `@console-one/subscription`

`addHandler` also accepts a `Subscription<any>` in place of a `Handler`. When the path resolves, the subscription receives the value via `resolve()`; when it's unfound, it receives `resolve(null)` or `reject(error)` depending on `errorOnUnfound`.

```ts
import { Subscription } from '@console-one/subscription'

const sub = new Subscription<any>()
walker.addHandler('@.item', sub)
sub.subscribe((value) => { /* ... */ })
walker.walk({ item: 'hello' })
```

### `WalkerFactory`

Lookup by type name:

```ts
import { WalkerFactory } from '@console-one/walker'
const walker = WalkerFactory.create('json')
```

Currently `'json'` is the only supported type. To add a new walker type, extend the `Walker` interface and register it via the factory (PR welcome).

## API

### `JSONPathWalker(errorOnUnfound?: boolean)`

| Method | Description |
|---|---|
| `loadAll(paths, item)` | One-shot: resolve several paths into an array of values in parallel. Returns `undefined` for missing paths. |
| `addHandler(path, handler)` | Register a `Handler` or `Subscription<any>` for a path. Returns `this`. |
| `walk(item, unfound?, currentpath?)` | Walk a value, firing handlers as paths resolve. `unfound` and `currentpath` are used internally during recursion; omit them for top-level calls. |
| `type` | `'json'` |

### `Handler`

```ts
new Handler(success, error, complete?)
```

A plain value container — no magic. Passed into `walker.addHandler(path, handler)`.

### `PipedHandler<K, V, Version>`

A richer handler shape used by consumers that need to key items by id and track per-version state. Stores `success`, `error`, `complete`, and `unsubscribe` callbacks. `cancel()` invokes `unsubscribe`. Not used by the built-in `JSONPathWalker`; exported for external walkers.

### `Walker` interface

```ts
interface Walker {
  type: string
  addHandler(path: string, handler: Handler | Subscription<any>): Walker
  walk(item: any, unfound?: Set<string>, currentpath?: string): void
}
```

Implement this if you want to write a walker for a structure other than JSON (XML, YAML AST, Protobuf, etc.).

### `WalkerFactory`

```ts
WalkerFactory.create(type: 'json'): Walker
```

## Dependencies

- [`@console-one/multimap`](../multimap) — `ListMultimap` is used to hold multiple handlers per path.
- [`@console-one/subscription`](../subscription) — supported as a first-class handler shape; optional at the call site.

## Fixed during extraction

The source had one latent bug surfaced by tests:

- **`handler.hasOwnProperty('complete')` incorrectly triggered for handlers constructed without a `complete` callback.** Because `Handler`'s `public complete?: () => void` constructor parameter assigns to the instance even when the caller passes nothing, `hasOwnProperty('complete')` returned `true` even when `complete` was `undefined`. The walker then called `handler.complete()` and crashed. Fixed: the check is now `typeof (handler as Handler).complete === 'function'`, which matches the actual contract.

If you were relying on the broken behavior, you can't have been — the old code crashed.

## Tests

```bash
npm test
```

15 tests covering `loadAll`, single-pass walks, multiple handlers per path, nested + array traversal, error vs. lenient unfound handling, and factory construction.
