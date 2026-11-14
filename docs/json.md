# `jutilities/json`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/json.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/json.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/json.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/json.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { Json, isTagged, typedArray, superjson } from "jutilities/json";
import type { JsonHandler, JsonStringified, Tagged, TypedArrayCtor } from "jutilities/json";
```
## Classes

<dl>
<dt><a href="#Json">Json</a></dt>
<dd><p>Configurable JSON-like (de)serializer with a registry of typed handlers.</p>
<p>Handlers apply on top of native <code>JSON.stringify</code>/<code>JSON.parse</code>: values that
match a handler&#39;s <code>isApplicable</code> are wrapped into <code>{ __type, value }</code>
envelopes and restored on parse. Parse calls the user reviver only for
non-envelope values (envelope children included); keys that resolve to
<code>undefined</code> are re-assigned afterwards.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#typedArray">typedArray</a> ⇒</dt>
<dd><p>Builds a JSON handler for any typed array family over <code>ArrayBuffer</code> views.</p>
<p>Stringifies the viewed slice to base64 (honoring <code>byteOffset</code>/<code>byteLength</code>);
parse allocates a fresh backing buffer from base64 and reinterprets it at
element alignment — the returned view is therefore always a <code>byteOffset: 0</code>
view covering the whole (fresh) buffer, and its total byte length must be
divisible by <code>BYTES_PER_ELEMENT</code>.</p>
</dd>
<dt><a href="#superjson">superjson</a></dt>
<dd><p>The batteries-included <code>Json</code> instance with all built-in handlers
pre-registered.</p>
<p>Handler coverage (registration order — first match wins):
<code>undefined</code>, non-finite/<code>-0</code> numbers, <code>bigint</code>, globally-registered symbols
(only <code>Symbol.for</code> keys round-trip), boxed <code>Number</code>/<code>String</code>/<code>Boolean</code>,
invalid dates, <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>Buffer</code> (Node only — guarded with
<code>typeof window === &quot;undefined&quot;</code>), all typed arrays (10 ctors),
<code>DataView</code>, <code>ArrayBuffer</code>, <code>Error</code> (preserves name/message/stack/cause plus
own enumerable props, but NOT subclasses of <code>Error</code> — which always rebuild
as plain <code>Error</code>), <code>RegExp</code>, <code>URL</code>, <code>URLSearchParams</code>, <code>Headers</code>, `Function.</p>
<p>Caveats (locked by tests):</p>
<ul>
<li><code>ArrayBuffer</code>/<code>DataView</code>/typed-array <code>parse</code> views cover a fresh, exactly
sized buffer — the decoded bytes are copied out of Node&#39;s shared pool.</li>
<li><code>SharedArrayBuffer</code> is deliberately NOT handled.</li>
<li>The <code>Error</code> handler matches via <code>Error.isError</code> (needs Node 24).</li>
</ul>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#isTagged">isTagged(v, type)</a> ⇒</dt>
<dd><p>Type guard for the <code>{ __type, value }</code> envelope of a given handler key.</p>
</dd>
</dl>

<a name="Json"></a>

## Json
Configurable JSON-like (de)serializer with a registry of typed handlers.

Handlers apply on top of native `JSON.stringify`/`JSON.parse`: values that
match a handler's `isApplicable` are wrapped into `{ __type, value }`
envelopes and restored on parse. Parse calls the user reviver only for
non-envelope values (envelope children included); keys that resolve to
`undefined` are re-assigned afterwards.

**Kind**: global class  

* [Json](#Json)
    * [.handlers](#Json+handlers)
    * [.addHandler(type, handler)](#Json+addHandler) ⇒
    * [.parse(text, reviver)](#Json+parse) ⇒
    * [.removeHandler(type)](#Json+removeHandler) ⇒
    * [.stringify(value, replacer, space)](#Json+stringify) ⇒


* * *

<a name="Json+handlers"></a>

### json.handlers
The handler registry keyed by `__type` license plate. Managed through
[addHandler](addHandler) / [removeHandler](removeHandler); internal to the class — the
registry is not part of the public surface.

**Kind**: instance property of [<code>Json</code>](#Json)  

* * *

<a name="Json+addHandler"></a>

### json.addHandler(type, handler) ⇒
Registers (or replaces) the handler for a `__type` key.

Registration order matters: the first matching handler wins, and
re-adding an existing key replaces it in place (the Map keeps its
original insertion order).

**Kind**: instance method of [<code>Json</code>](#Json)  
**Returns**: This instance, for chaining.  

| Param | Description |
| --- | --- |
| type | The `__type` license plate this handler claims. |
| handler | The stringify/parse/isApplicable triple. |


* * *

<a name="Json+parse"></a>

### json.parse(text, reviver) ⇒
Parses JSON text produced by this class (or any JSON), restoring envelopes
through registered handlers.

The user reviver is invoked only for values no handler claimed — including
envelope children — never for the envelope value itself. Keys whose parsed
result is `undefined` are restored after parsing (a reviver returning
`undefined` would otherwise delete them), so `undefined` round-trips.

**Kind**: instance method of [<code>Json</code>](#Json)  
**Returns**: The rebuilt value, typed as `T`.  

| Param | Description |
| --- | --- |
| text | JSON text (plain string or [JsonStringified](JsonStringified)). |
| reviver | Optional per-key transform for values no handler claimed (same signature as `JSONHandler.parse`). |


* * *

<a name="Json+removeHandler"></a>

### json.removeHandler(type) ⇒
Deletes the handler registered under a `__type` key.

Removing an unknown/already-removed key is a silent no-op.

**Kind**: instance method of [<code>Json</code>](#Json)  
**Returns**: This instance, for chaining.  

| Param | Description |
| --- | --- |
| type | The `__type` key to remove. |


* * *

<a name="Json+stringify"></a>

### json.stringify(value, replacer, space) ⇒
Serializes a value like `JSON.stringify`, but with handler envelopes.

Handlers are matched against the raw (pre-`toJSON`) value; non-matching
values fall through to the optional user replacer.

**Kind**: instance method of [<code>Json</code>](#Json)  
**Returns**: The JSON text, branded as [JsonStringified](JsonStringified) of `T`.  

| Param | Description |
| --- | --- |
| value | The value to serialize. |
| replacer | Optional per-key replacer for values no handler claimed (same signature as `JSONHandler.stringify`). |
| space | Pretty-printing spacer, forwarded to `JSON.stringify`. |


* * *

<a name="typedArray"></a>

## typedArray ⇒
Builds a JSON handler for any typed array family over `ArrayBuffer` views.

Stringifies the viewed slice to base64 (honoring `byteOffset`/`byteLength`);
parse allocates a fresh backing buffer from base64 and reinterprets it at
element alignment — the returned view is therefore always a `byteOffset: 0`
view covering the whole (fresh) buffer, and its total byte length must be
divisible by `BYTES_PER_ELEMENT`.

**Kind**: global constant  
**Returns**: A handler tagging values as that typed array.  

| Param | Description |
| --- | --- |
| Ctor | The typed array constructor (e.g. `Uint8Array`). |


* * *

<a name="superjson"></a>

## superjson
The batteries-included `Json` instance with all built-in handlers
pre-registered.

Handler coverage (registration order — first match wins):
`undefined`, non-finite/`-0` numbers, `bigint`, globally-registered symbols
(only `Symbol.for` keys round-trip), boxed `Number`/`String`/`Boolean`,
invalid dates, `Date`, `Map`, `Set`, `Buffer` (Node only — guarded with
`typeof window === "undefined"`), all typed arrays (10 ctors),
`DataView`, `ArrayBuffer`, `Error` (preserves name/message/stack/cause plus
own enumerable props, but NOT subclasses of `Error` — which always rebuild
as plain `Error`), `RegExp`, `URL`, `URLSearchParams`, `Headers`, `Function.

Caveats (locked by tests):
- `ArrayBuffer`/`DataView`/typed-array `parse` views cover a fresh, exactly
  sized buffer — the decoded bytes are copied out of Node's shared pool.
- `SharedArrayBuffer` is deliberately NOT handled.
- The `Error` handler matches via `Error.isError` (needs Node 24).

**Kind**: global constant  

* * *

<a name="isTagged"></a>

## isTagged(v, type) ⇒
Type guard for the `{ __type, value }` envelope of a given handler key.

**Kind**: global function  
**Returns**: `true` when `v` is a record with this `__type` and a `value`
property.  

| Param | Description |
| --- | --- |
| v | The candidate value. |
| type | The exact `__type` value to match. |


* * *


