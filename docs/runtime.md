# `jutilities/runtime`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/runtime.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/runtime.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/runtime.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/runtime.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { isServer, isBrowser, isBrowserWorker, isServerWorker, createConditionalFn, serverFn, browserFn } from "jutilities/runtime";
```
## Constants

<dl>
<dt><a href="#isServer">isServer</a></dt>
<dd><p><code>true</code> in every non-browser runtime (Node.js and other server runtimes with
no global <code>window</code>).</p>
<p>Browser Web Workers also have no <code>window</code> and report <code>true</code>; pair with
<a href="#isBrowserWorker">isBrowserWorker</a> (or <a href="#isServerWorker">isServerWorker</a>) to tell workers apart
from plain server processes.</p>
</dd>
<dt><a href="#isBrowser">isBrowser</a></dt>
<dd><p><code>true</code> in a classic browser environment (the global <code>window</code> exists).
Browser workers report <code>false</code> — see <a href="#isBrowserWorker">isBrowserWorker</a>.</p>
</dd>
<dt><a href="#isBrowserWorker">isBrowserWorker</a></dt>
<dd><p><code>true</code> inside a browser Web Worker (dedicated, shared, or classic service
worker): no <code>window</code>, but the global scope is <code>self</code> and exposes the
<code>importScripts</code> function.</p>
<p>Module service workers have neither <code>window</code> nor <code>importScripts</code> and report
<code>false</code>; with globals alone they cannot be told apart from plain servers.</p>
</dd>
<dt><a href="#isServerWorker">isServerWorker</a></dt>
<dd><p><code>true</code> inside a Node.js worker thread (<code>worker_threads</code>). Always <code>false</code> in
the browser, in browser Web Workers, and in plain (non-worker) server
processes. Evaluated once at module load.</p>
</dd>
<dt><a href="#serverFn">serverFn</a></dt>
<dd><p>Returns <code>fn</code> on the server, otherwise <code>undefined</code>.</p>
</dd>
<dt><a href="#browserFn">browserFn</a></dt>
<dd><p>Returns <code>fn</code> in the browser, otherwise <code>undefined</code>.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#createConditionalFn">createConditionalFn(condition)</a> ⇒</dt>
<dd><p>Builds a conditional wrapper that returns <code>fn</code> only when <code>condition</code> holds.
Used to create no-op-safe <code>serverFn</code> / <code>browserFn</code> helpers.</p>
</dd>
</dl>

<a name="isServer"></a>

## isServer
`true` in every non-browser runtime (Node.js and other server runtimes with
no global `window`).

Browser Web Workers also have no `window` and report `true`; pair with
[isBrowserWorker](#isBrowserWorker) (or [isServerWorker](#isServerWorker)) to tell workers apart
from plain server processes.

**Kind**: global constant  

* * *

<a name="isBrowser"></a>

## isBrowser
`true` in a classic browser environment (the global `window` exists).
Browser workers report `false` — see [isBrowserWorker](#isBrowserWorker).

**Kind**: global constant  

* * *

<a name="isBrowserWorker"></a>

## isBrowserWorker
`true` inside a browser Web Worker (dedicated, shared, or classic service
worker): no `window`, but the global scope is `self` and exposes the
`importScripts` function.

Module service workers have neither `window` nor `importScripts` and report
`false`; with globals alone they cannot be told apart from plain servers.

**Kind**: global constant  

* * *

<a name="isServerWorker"></a>

## isServerWorker
`true` inside a Node.js worker thread (`worker_threads`). Always `false` in
the browser, in browser Web Workers, and in plain (non-worker) server
processes. Evaluated once at module load.

**Kind**: global constant  

* * *

<a name="serverFn"></a>

## serverFn
Returns `fn` on the server, otherwise `undefined`.

**Kind**: global constant  

* * *

<a name="browserFn"></a>

## browserFn
Returns `fn` in the browser, otherwise `undefined`.

**Kind**: global constant  

* * *

<a name="createConditionalFn"></a>

## createConditionalFn(condition) ⇒
Builds a conditional wrapper that returns `fn` only when `condition` holds.
Used to create no-op-safe `serverFn` / `browserFn` helpers.

**Kind**: global function  
**Returns**: A wrapper mapping `fn` to itself or `undefined`.  

| Param | Description |
| --- | --- |
| condition | Static flag or thunk evaluated once per call. |


* * *


