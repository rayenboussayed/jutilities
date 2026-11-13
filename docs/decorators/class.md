# `jutilities/decorators/class`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/decorators/class.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/class.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/decorators/class.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/class.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { decorateClass, resolveEnhancer } from "jutilities/decorators/class";
import type { ClassDecoratorOf, ClassPick, EnhancerFn, EnhancerOptions, EnhancerPair } from "jutilities/decorators/class";
```
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


