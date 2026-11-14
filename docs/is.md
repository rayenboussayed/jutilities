# `jutilities/is`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/is.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/is.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/is.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/is.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { isAsyncFunction, isAsyncGeneratorFunction, isEmpty, isEmptyArray, isEmptyRecord, isEmptyString, isFunction, isGeneratorFunction, isNil, isNull, isObject, isPromise, isRawMemberApplication, isRecord, isThenable, isUndefined } from "jutilities/is";
```
## Functions

<dl>
<dt><a href="#isAsyncFunction">isAsyncFunction(fn)</a> ⇒</dt>
<dd><p>Async function check via the function&#39;s constructor name.</p>
<p>Caveat: relies on <code>AsyncFunction</code> constructor names, which can be lost by
transpilers/minifiers that lower <code>async</code> functions.</p>
</dd>
<dt><a href="#isAsyncGeneratorFunction">isAsyncGeneratorFunction(fn)</a> ⇒</dt>
<dd><p>Async generator function check via the function&#39;s constructor name.</p>
</dd>
<dt><a href="#isEmpty">isEmpty(value)</a> ⇒</dt>
<dd><p>Aggregated emptiness check: <code>null</code>/<code>undefined</code>, the empty string, an empty
array, or a record with no keys all count as &quot;empty&quot;.</p>
<p>Note: falsy primitives such as <code>0</code>, <code>false</code>, and <code>NaN</code> are NOT empty; values
without enumerable own keys (like a <code>Date</code>) are.</p>
</dd>
<dt><a href="#isEmptyArray">isEmptyArray(value)</a> ⇒</dt>
<dd><p>Checks whether a value is an actual array with no elements.
Array-likes and non-arrays (including <code>null</code>/<code>undefined</code>) yield <code>false</code>.</p>
</dd>
<dt><a href="#isEmptyRecord">isEmptyRecord(value)</a> ⇒</dt>
<dd><p>Checks whether a record has no enumerable own string keys.</p>
<p>Note: <code>Object.keys</code> ignores symbol keys, and objects without enumerable own
properties count as empty (e.g. <code>new Date()</code> or <code>Object.create(null)</code>).</p>
</dd>
<dt><a href="#isEmptyString">isEmptyString(value)</a> ⇒</dt>
<dd><p>Checks whether a value is the empty string <code>&quot;&quot;</code>.</p>
<p>Note: only string primitives count; boxed strings such as <code>new String(&quot;&quot;)</code>
are not strings, so they yield <code>false</code>.</p>
</dd>
<dt><a href="#isFunction">isFunction(value)</a> ⇒</dt>
<dd><p>Callable check: true when the value is a function.</p>
<p>The narrowing is to <a href="AnyFunction">AnyFunction</a> — a callable signature — so the
checked value can be called directly; <code>typeof value === &quot;function&quot;</code> alone
only narrows to <code>Function</code>, which carries no call signature.</p>
</dd>
<dt><a href="#isGeneratorFunction">isGeneratorFunction(fn)</a> ⇒</dt>
<dd><p>Generator function check via the function&#39;s constructor name.</p>
</dd>
<dt><a href="#isNil">isNil(value)</a> ⇒</dt>
<dd><p>Checks whether a value is either <code>null</code> or <code>undefined</code>.</p>
</dd>
<dt><a href="#isNull">isNull(value)</a> ⇒</dt>
<dd><p>Checks whether a value is exactly <code>null</code>.</p>
</dd>
<dt><a href="#isObject">isObject(value)</a> ⇒</dt>
<dd><p>Checks whether a value behaves like an object (any <code>typeof value === &quot;object&quot;</code> value that is not <code>null</code>). Arrays and class instances match too;
functions and primitives do not.</p>
</dd>
<dt><a href="#isPromise">isPromise(v)</a> ⇒</dt>
<dd><p>Promise check: native <code>Promise</code> instances, or duck-typed thenables that also
expose <code>catch</code> and <code>finally</code>. Thenables missing either method yield <code>false</code>.</p>
</dd>
<dt><a href="#isRawMemberApplication">isRawMemberApplication(rest)</a> ⇒</dt>
<dd><p>Detects a paren-less application of a decorator-converter RESULT (the
decorator factory): legacy (experimentalDecorators) decorators invoke a
member decorator as <code>(target, propertyKey, descriptor)</code>, which arrives as
three positional arguments — an object target, a string/symbol key and a
descriptor-shaped third argument is the misfire fingerprint. Legit option
slots (option bags) cannot mimic all three stripes at those positions, so
this is a safe heuristic guarded by a documented caveat in the package
docs.</p>
</dd>
<dt><a href="#isRecord">isRecord(value)</a> ⇒</dt>
<dd><p>Checks whether a value is a key/value object and not an array.
Arrays are objects, so they are explicitly excluded here.</p>
</dd>
<dt><a href="#isThenable">isThenable(v)</a> ⇒</dt>
<dd><p>Duck-typed thenable check: true when the value has a callable <code>then</code>.</p>
<p>Caveat: a throwing <code>then</code> getter propagates the throw.</p>
</dd>
<dt><a href="#isUndefined">isUndefined(value)</a> ⇒</dt>
<dd><p>Checks whether a value is exactly <code>undefined</code> (also true for <code>void 0</code> and
declared-but-unassigned variables).</p>
</dd>
</dl>

<a name="isAsyncFunction"></a>

## isAsyncFunction(fn) ⇒
Async function check via the function's constructor name.

Caveat: relies on `AsyncFunction` constructor names, which can be lost by
transpilers/minifiers that lower `async` functions.

**Kind**: global function  
**Returns**: `true` when the function is declared with `async`.  

| Param | Description |
| --- | --- |
| fn | The function to test. |


* * *

<a name="isAsyncGeneratorFunction"></a>

## isAsyncGeneratorFunction(fn) ⇒
Async generator function check via the function's constructor name.

**Kind**: global function  
**Returns**: `true` when the function is an `async function*` declaration.  

| Param | Description |
| --- | --- |
| fn | The function to test. |


* * *

<a name="isEmpty"></a>

## isEmpty(value) ⇒
Aggregated emptiness check: `null`/`undefined`, the empty string, an empty
array, or a record with no keys all count as "empty".

Note: falsy primitives such as `0`, `false`, and `NaN` are NOT empty; values
without enumerable own keys (like a `Date`) are.

**Kind**: global function  
**Returns**: `true` when the value is nil, an empty string, an empty array, or
an empty record.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isEmptyArray"></a>

## isEmptyArray(value) ⇒
Checks whether a value is an actual array with no elements.
Array-likes and non-arrays (including `null`/`undefined`) yield `false`.

**Kind**: global function  
**Returns**: `true` when the value is an empty `Array`.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isEmptyRecord"></a>

## isEmptyRecord(value) ⇒
Checks whether a record has no enumerable own string keys.

Note: `Object.keys` ignores symbol keys, and objects without enumerable own
properties count as empty (e.g. `new Date()` or `Object.create(null)`).

**Kind**: global function  
**Returns**: `true` when the value is a record with zero `Object.keys` entries.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isEmptyString"></a>

## isEmptyString(value) ⇒
Checks whether a value is the empty string `""`.

Note: only string primitives count; boxed strings such as `new String("")`
are not strings, so they yield `false`.

**Kind**: global function  
**Returns**: `true` when the value is a string primitive of length 0.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isFunction"></a>

## isFunction(value) ⇒
Callable check: true when the value is a function.

The narrowing is to [AnyFunction](AnyFunction) — a callable signature — so the
checked value can be called directly; `typeof value === "function"` alone
only narrows to `Function`, which carries no call signature.

**Kind**: global function  
**Returns**: `true` when the value is callable.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isGeneratorFunction"></a>

## isGeneratorFunction(fn) ⇒
Generator function check via the function's constructor name.

**Kind**: global function  
**Returns**: `true` when the function is a `function*` declaration.  

| Param | Description |
| --- | --- |
| fn | The function to test. |


* * *

<a name="isNil"></a>

## isNil(value) ⇒
Checks whether a value is either `null` or `undefined`.

**Kind**: global function  
**Returns**: `true` when the value is `null` or `undefined`.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isNull"></a>

## isNull(value) ⇒
Checks whether a value is exactly `null`.

**Kind**: global function  
**Returns**: `true` when the value is `null`.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isObject"></a>

## isObject(value) ⇒
Checks whether a value behaves like an object (any `typeof value ===
"object"` value that is not `null`). Arrays and class instances match too;
functions and primitives do not.

**Kind**: global function  
**Returns**: `true` when the value is a non-null object.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isPromise"></a>

## isPromise(v) ⇒
Promise check: native `Promise` instances, or duck-typed thenables that also
expose `catch` and `finally`. Thenables missing either method yield `false`.

**Kind**: global function  
**Returns**: `true` when the value can be treated as a real promise.  

| Param | Description |
| --- | --- |
| v | The value to test. |


* * *

<a name="isRawMemberApplication"></a>

## isRawMemberApplication(rest) ⇒
Detects a paren-less application of a decorator-converter RESULT (the
decorator factory): legacy (experimentalDecorators) decorators invoke a
member decorator as `(target, propertyKey, descriptor)`, which arrives as
three positional arguments — an object target, a string/symbol key and a
descriptor-shaped third argument is the misfire fingerprint. Legit option
slots (option bags) cannot mimic all three stripes at those positions, so
this is a safe heuristic guarded by a documented caveat in the package
docs.

**Kind**: global function  
**Returns**: `true` when the rest looks like a raw decoration invocation.  

| Param | Description |
| --- | --- |
| rest | The rest arguments a factory received. |


* * *

<a name="isRecord"></a>

## isRecord(value) ⇒
Checks whether a value is a key/value object and not an array.
Arrays are objects, so they are explicitly excluded here.

**Kind**: global function  
**Returns**: `true` when the value is a non-array object.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *

<a name="isThenable"></a>

## isThenable(v) ⇒
Duck-typed thenable check: true when the value has a callable `then`.

Caveat: a throwing `then` getter propagates the throw.

**Kind**: global function  
**Returns**: `true` when the value exposes a callable `then` property.  

| Param | Description |
| --- | --- |
| v | The value to test. |


* * *

<a name="isUndefined"></a>

## isUndefined(value) ⇒
Checks whether a value is exactly `undefined` (also true for `void 0` and
declared-but-unassigned variables).

**Kind**: global function  
**Returns**: `true` when the value is `undefined`.  

| Param | Description |
| --- | --- |
| value | The value to test. |


* * *


