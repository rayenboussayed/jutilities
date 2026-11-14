# `jutilities/decorators/hof`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/decorators/hof.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/hof.ts) and run `npm run build` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/decorators/hof.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/hof.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { memberEnhancer } from "jutilities/decorators/hof";
import type { DecoratorGuard, GatedMember, HofOptions, HofOptionsOf } from "jutilities/decorators/hof";
```
<a name="memberEnhancer"></a>

## memberEnhancer(name, hof, options, args) ⇒
The shared skeleton of a member decorator: it validates the factory call
(the paren-less misfire guard), captures the option bag, and returns the
function that enhances one member — checking the member's async-ness against
the guard before handing it to the HOF.

Every member converter (`decorateMethod`, `decorateGetter`) shares this,
so the misfire and guard rules are defined once.

**Kind**: global function  
**Returns**: The function that enhances one member.  

| Param | Description |
| --- | --- |
| name | The converter's name, used in the error messages. |
| hof | The converted HOF. |
| options | The converter's guard options. |
| args | The arguments the decorator factory received. |


* * *


