# `jutilities/decorators/class`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/decorators/class.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/class.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/decorators/class.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/class.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { decorateClass, resolveEnhancer } from "jutilities/decorators/class";
import type { ClassDecoratorOf, ClassPick, EnhancerFn, EnhancerOptions, EnhancerPair } from "jutilities/decorators/class";
```
## Functions

<dl>
<dt><a href="#decorateClass">decorateClass(enhancers, options)</a> ⇒</dt>
<dd><p>Applies a fn-first HOF (or a sync/async pair of them) to every OWN prototype
method of the decorated class. Constructor, statics, getters/setters and
<code>#private</code> members are left untouched (<code>#private</code> fields are not visible to
property enumeration, but each can still be decorated individually with the
method/getter factories).</p>
<p>The HOF&#39;s option bag (one object, resolved from the HOF&#39;s kind) is declared
ONCE at decorate time and forwarded verbatim to every wrapped method.</p>
<p>Enhancers resolve per method:</p>
<ul>
<li>single HOF: applied to every member (any <code>pick</code> value is informative
only);</li>
<li><code>{ sync?, async? }</code> pair with <code>pick: &quot;detect&quot;</code> (default): <code>async</code>
members take <code>pair.async</code>, others take <code>pair.sync</code>;</li>
<li>pair with <code>pick: &quot;sync&quot;</code> / <code>&quot;async&quot;</code>: every member goes through that
slot; a missing slot throws at decorate time naming the request.</li>
</ul>
<p>A pair slot missing for a detected member also throws at decorate time
naming the member, so partial configurations fail fast.</p>
</dd>
<dt><a href="#resolveEnhancer">resolveEnhancer(enhancers, pick, fn, name)</a> ⇒</dt>
<dd><p>Chooses the HOF for one member under the current pairing mode. Single
enhancers bypass mode selection entirely; pair modes select by <code>pick</code>
(forced) or by the member&#39;s async-ness (detected), and absent pair slots are
fail-fast errors.</p>
</dd>
</dl>

<a name="decorateClass"></a>

## decorateClass(enhancers, options) ⇒
Applies a fn-first HOF (or a sync/async pair of them) to every OWN prototype
method of the decorated class. Constructor, statics, getters/setters and
`#private` members are left untouched (`#private` fields are not visible to
property enumeration, but each can still be decorated individually with the
method/getter factories).

The HOF's option bag (one object, resolved from the HOF's kind) is declared
ONCE at decorate time and forwarded verbatim to every wrapped method.

Enhancers resolve per method:
- single HOF: applied to every member (any `pick` value is informative
  only);
- `{ sync?, async? }` pair with `pick: "detect"` (default): `async`
  members take `pair.async`, others take `pair.sync`;
- pair with `pick: "sync"` / `"async"`: every member goes through that
  slot; a missing slot throws at decorate time naming the request.

A pair slot missing for a detected member also throws at decorate time
naming the member, so partial configurations fail fast.

**Kind**: global function  
**Returns**: A decorator factory whose options are forwarded to every wrapped
member.  
**Cached({**: cacheStore: new Map() })
class Users {
  count() { return 42; }
  async load(id: string) { return await db.user(id); }
}
```  

| Param | Description |
| --- | --- |
| enhancers | A sync/async pair of HOFs. |
| options | Slot resolution options. |
| options.pick | Slot resolution mode: `"sync"`, `"async"`, or `"detect"` (default). |

**Example**  
```ts
// Hoist the factory so each decoration applies it exactly once.
const cached = decorateClass({
  sync: withCacheSync,
  async: withCacheAsync,
});

* * *

<a name="resolveEnhancer"></a>

## resolveEnhancer(enhancers, pick, fn, name) ⇒
Chooses the HOF for one member under the current pairing mode. Single
enhancers bypass mode selection entirely; pair modes select by `pick`
(forced) or by the member's async-ness (detected), and absent pair slots are
fail-fast errors.

**Kind**: global function  
**Returns**: The HOF to apply.  

| Param | Description |
| --- | --- |
| enhancers | The raw user input (a HOF or a sync/async bag). |
| pick | The requested slot resolution mode. |
| fn | The member value being wrapped. |
| name | The member's name, for error messages. |


* * *


