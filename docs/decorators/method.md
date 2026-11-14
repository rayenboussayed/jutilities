# `jutilities/decorators/method`

<!-- This file is generated. Do not edit by hand — change the JSDoc in [`src/decorators/method.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/method.ts) and run `npm run docs:api` instead. -->

> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [`src/decorators/method.ts`](https://github.com/rayenboussayed/jutilities/blob/main/src/decorators/method.ts). Behavior contracts and quirks are pinned by the tests.

```ts
import { decorateMethod } from "jutilities/decorators/method";
import type { MethodDecoratorOf } from "jutilities/decorators/method";
```
<a name="decorateMethod"></a>

## decorateMethod(hof, options) ⇒
Converts a fn-first HOF into a reusable legacy method decorator factory.
The HOF's first parameter receives the member value; its option bag (one
object, resolved from the HOF's kind) is forwarded verbatim, evaluated once
at decorate time and shared by its wrap.

Only HOFs built by [ createHofSync](../libs/create-hof.ts) /
`createHofAsync` are accepted — they carry the kind the converter needs to
type the option bag, and the flavor that decides which members may be
decorated: a sync HOF preserves the member signature and relies on runtime
guarding (or `require`), while an async HOF takes promise-returning members.

**Kind**: global function  
**Returns**: A decorator factory whose options are forwarded to `hof` exactly
once per decorated member.  
**Cached({**: extraKeys: ["users"] })
  async loadUser(id: string) { return await db.find(id); }
}
```  

| Param | Description |
| --- | --- |
| hof | The fn-first HOF to convert. |
| options | Optional [DecoratorGuard](DecoratorGuard) (`require: "sync"` or `"async"`) checked against the member at decorate time. |

**Example**  
```ts
// Hoist the factory so each decoration applies it exactly once.
const cached = decorateMethod(withCacheAsync);

class Users {
  

* * *


