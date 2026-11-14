# `jutilities/hof/assert`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/hof/assert.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/assert.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/hof/assert.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/hof/assert.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { AssertError, assert, assertNever, assertNotNil, withAssertAsync, withAssertSync, assertGuardConsistency, assertNotRawApplication, assertNotRawMemberApplication } from "jutilities/hof/assert";
import type { AssertKind, OnResultFn, Options } from "jutilities/hof/assert";
```
## Classes

<dl>
<dt><a href="#AssertError">AssertError</a></dt>
<dd><p>Thrown by every invariant guard in this module. Extends <code>TypeError</code> so
consumers filtering on <code>TypeError</code> keep matching guard failures, as the
<code>assert</code> and <code>decorators</code> test suites pin.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#withAssertAsync">withAssertAsync</a> ⇒</dt>
<dd><p>Wraps an async function so every resolution is checked by a validator before
it is returned.</p>
<p>The validator reuses the module&#39;s guards (<code>assert</code>, <code>assertNotNil</code>) and may
itself be sync or async — its return is awaited before the checked result is
returned. Throwing inside <code>onResult</code> surfaces that error instead of the
result; a rejected wrapped call never reaches the validator and propagates
untouched.</p>
</dd>
<dt><a href="#withAssertSync">withAssertSync</a> ⇒</dt>
<dd><p>Wraps a sync function so every call&#39;s result is checked by a validator
before it is returned.</p>
<p>Behavior notes:</p>
<ul>
<li>Call arguments are forwarded verbatim to <code>fn</code> and reported to
<code>options.onResult</code> via <code>parameters</code> (see <a href="OnResultFn">OnResultFn</a>).</li>
<li><code>this</code> is forwarded to <code>fn</code>.</li>
<li>The validator is sync-only here; use <a href="#withAssertAsync">withAssertAsync</a> when the
check needs to await.</li>
</ul>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#assert">assert(condition, message, name)</a></dt>
<dd><p>Enforces a truthy invariant and throws when it fails.</p>
<p>Thrown for every falsy value (<code>false</code>, <code>0</code>, <code>&quot;&quot;</code>, <code>null</code>, <code>undefined</code>,
<code>NaN</code>) — emptiness checks belong to <a href="./is.ts"> isEmpty</a>, truthiness to
this guard.</p>
</dd>
<dt><a href="#assertNever">assertNever(value, message)</a></dt>
<dd><p>Asserts TS exhaustive coverage: call it on a <code>never</code>-typed leftover (e.g. a
<code>switch</code>&#39;s <code>default</code> on a discriminated union) so adding a case without
handling it fails at compile time — and impossible leftovers (e.g. a case
radius widening through casts) fail loudly here.</p>
</dd>
<dt><a href="#assertNotNil">assertNotNil(value, name)</a></dt>
<dd><p>Asserts a non-null, non-undefined value, narrowing it for the rest of the
scope.</p>
<p>Note: falsy-but-non-nil values (<code>0</code>, <code>&quot;&quot;</code>, <code>false</code>, <code>NaN</code>) pass — only
<code>null</code>/<code>undefined</code> fail.</p>
</dd>
<dt><a href="#assertGuardConsistency">assertGuardConsistency(guard, isAsync, factoryName, memberName)</a></dt>
<dd><p>Enforces the sync/async discipline knob of
<a href="./decorators/hof.ts"> DecoratorGuard</a>: compares the member value&#39;s
async-ness against <code>require</code> and throws a readable <code>AssertError</code> naming the
member. Called by every converting decorator before touching the member.</p>
</dd>
<dt><a href="#assertNotRawApplication">assertNotRawApplication(options, factoryName)</a></dt>
<dd><p>Fails fast when a decorator factory was applied paren-less (the class
constructor arrived where the options bag is expected — legacy decorators
evaluate the bare <code>@cached</code> as <code>cached(ctor)</code>). This turns silent member
corruption into a readable <code>AssertError</code> at class-definition time.</p>
</dd>
<dt><a href="#assertNotRawMemberApplication">assertNotRawMemberApplication(rest, factoryName)</a></dt>
<dd><p>Fails fast when a decorator factory received the decorator invocation
itself (paren-less application of the converter result): legacy
decorators invoke member decorators as <code>(target, propertyKey, descriptor)</code>.
Pairs with
<a href="#assertNotRawApplication">assertNotRawApplication</a> so every misfire path throws a readable
<code>AssertError</code> instead of silently wrapping members in decorator machinery.</p>
</dd>
</dl>

<a name="AssertError"></a>

## AssertError
Thrown by every invariant guard in this module. Extends `TypeError` so
consumers filtering on `TypeError` keep matching guard failures, as the
`assert` and `decorators` test suites pin.

**Kind**: global class  

* * *

<a name="withAssertAsync"></a>

## withAssertAsync ⇒
Wraps an async function so every resolution is checked by a validator before
it is returned.

The validator reuses the module's guards (`assert`, `assertNotNil`) and may
itself be sync or async — its return is awaited before the checked result is
returned. Throwing inside `onResult` surfaces that error instead of the
result; a rejected wrapped call never reaches the validator and propagates
untouched.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) whose resolutions are gated by
`options.onResult`.  

| Param | Description |
| --- | --- |
| fn | The async function whose results are gated. |
| options | Options object (`onResult` is required). |
| options.onResult | Validates each call over the awaited `result` and the call arguments, throwing to reject the call (may be async). |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (unvalidated). Defaults to enabled. |


* * *

<a name="withAssertSync"></a>

## withAssertSync ⇒
Wraps a sync function so every call's result is checked by a validator
before it is returned.

Behavior notes:
- Call arguments are forwarded verbatim to `fn` and reported to
  `options.onResult` via `parameters` (see [OnResultFn](OnResultFn)).
- `this` is forwarded to `fn`.
- The validator is sync-only here; use [withAssertAsync](#withAssertAsync) when the
  check needs to await.

**Kind**: global constant  
**Returns**: The wrapped function (typeof `fn`) whose results are gated by
`options.onResult`.  

| Param | Description |
| --- | --- |
| fn | The sync function whose results are gated. |
| options | Options object (`onResult` is required). |
| options.onResult | Validates each call over `result` and the call arguments, throwing to replace the result. |
| options.skipHof | Per-call bypass switch: `true` resolves the wrapper to `fn` itself at wrap time; a function predicate receives the call arguments and a truthy result invokes `fn` raw for that call (unvalidated). Defaults to enabled. |


* * *

<a name="assert"></a>

## assert(condition, message, name)
Enforces a truthy invariant and throws when it fails.

Thrown for every falsy value (`false`, `0`, `""`, `null`, `undefined`,
`NaN`) — emptiness checks belong to [ isEmpty](./is.ts), truthiness to
this guard.

**Kind**: global function  
**Throws**:

- `AssertError` reporting `message` (prefixed by `name` when provided).


| Param | Type | Description |
| --- | --- | --- |
| condition |  | The value to check; anything falsy fails the assertion. |
| message |  | The failure description, thrown as the error message. |
| name | <code>name</code> | Optional prefix prepended as `` `$: ${message}` `` so surface violations can name their subsystem. |


* * *

<a name="assertNever"></a>

## assertNever(value, message)
Asserts TS exhaustive coverage: call it on a `never`-typed leftover (e.g. a
`switch`'s `default` on a discriminated union) so adding a case without
handling it fails at compile time — and impossible leftovers (e.g. a case
radius widening through casts) fail loudly here.

**Kind**: global function  
**Throws**:

- `AssertError` reporting `message` and a rendered preview of `value`
(`JSON.stringify`, falling back to `String(value)`, then to `typeof` when
both throw).


| Param | Description |
| --- | --- |
| value | The unreachable remaining value (typed `never`). |
| message | The failure description, thrown as the error message. |


* * *

<a name="assertNotNil"></a>

## assertNotNil(value, name)
Asserts a non-null, non-undefined value, narrowing it for the rest of the
scope.

Note: falsy-but-non-nil values (`0`, `""`, `false`, `NaN`) pass — only
`null`/`undefined` fail.

**Kind**: global function  
**Throws**:

- `AssertError` reporting that `name` must not be null or undefined.


| Param | Description |
| --- | --- |
| value | The value to check. |
| name | The value's description used in the error message. |


* * *

<a name="assertGuardConsistency"></a>

## assertGuardConsistency(guard, isAsync, factoryName, memberName)
Enforces the sync/async discipline knob of
[ DecoratorGuard](./decorators/hof.ts): compares the member value's
async-ness against `require` and throws a readable `AssertError` naming the
member. Called by every converting decorator before touching the member.

**Kind**: global function  
**Throws**:

- `AssertError` when `require` disagrees with the member's async-ness.


| Param | Description |
| --- | --- |
| guard | The caller-provided guard (may be undefined). |
| isAsync | Whether the member value reports `isAsyncFunction`. |
| factoryName | The reporting decorator's name for the error message. |
| memberName | The decorated member's name for the error message. |


* * *

<a name="assertNotRawApplication"></a>

## assertNotRawApplication(options, factoryName)
Fails fast when a decorator factory was applied paren-less (the class
constructor arrived where the options bag is expected — legacy decorators
evaluate the bare `@cached` as `cached(ctor)`). This turns silent member
corruption into a readable `AssertError` at class-definition time.

**Kind**: global function  
**Throws**:

- `AssertError` naming the factory and the offending misfire.


| Param | Description |
| --- | --- |
| options | The second factory argument. |
| factoryName | The reporting decorator's name for the error message. |


* * *

<a name="assertNotRawMemberApplication"></a>

## assertNotRawMemberApplication(rest, factoryName)
Fails fast when a decorator factory received the decorator invocation
itself (paren-less application of the converter result): legacy
decorators invoke member decorators as `(target, propertyKey, descriptor)`.
Pairs with
[assertNotRawApplication](#assertNotRawApplication) so every misfire path throws a readable
`AssertError` instead of silently wrapping members in decorator machinery.

**Kind**: global function  
**Throws**:

- `AssertError` naming the factory and the offending misfire.


| Param | Description |
| --- | --- |
| rest | The rest arguments a factory received. |
| factoryName | The reporting decorator's name for the error message. |


* * *


