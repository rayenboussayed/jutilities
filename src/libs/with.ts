import type {
  AnyAsyncFunction,
  AnyFunction,
  AnySyncFunction,
} from "../types/type.js";
import type {
  ApplyKind,
  HofFn,
  HofKind,
  KindOf,
  WithSkipHof,
} from "./create-hof.js";

type AnyHof = (fn: any, options?: any) => any;

/**
 * Intersection of every HOF's options, resolved for the concrete wrapped
 * function `TF` (so `parameters` / `result` in each hook are typed from it).
 */
export type MergeOptions<
  Hs extends readonly unknown[],
  TF extends AnyFunction,
> = Hs extends readonly [infer H, ...infer R]
  ? ApplyKind<KindOf<H>, TF> & MergeOptions<R, TF>
  : unknown;

/**
 * The kind of a composed stack: its options are the merged option bags of
 * every layer, resolved for the concrete wrapped function type.
 * @template Hs - The stacked HOF types.
 */
export interface ComposedKind<Hs extends readonly unknown[] = readonly unknown[]>
  extends HofKind {
  options: MergeOptions<Hs, this["fn"]>;
}

/**
 * Composes async HOFs into one. The FIRST hof is the OUTERMOST layer:
 * `withAsync(a, b, c)(fn, o)` === `a(b(c(fn, o), o), o)`.
 * Options are one flat bag shared by all layers (each reads its own keys).
 * `skipHof` is handled once for the whole stack (inner layers never see it),
 * so a per-call predicate runs once per call, not once per layer.
 *
 * The result carries the composed kind as a type-only brand, so a decorator
 * can convert a whole stack (see `jutilities/decorators/method`).
 * @param hofs - The HOFs to stack, outermost first.
 * @returns A fn-first wrapper applying the whole stack.
 */
export function withAsync<const Hs extends readonly HofFn<any, "async">[]>(
  ...hofs: Hs
): HofFn<ComposedKind<Hs>, "async"> {
  const composed = <TF extends AnyAsyncFunction>(
    fn: TF,
    options?: WithSkipHof<MergeOptions<Hs, TF>, TF>,
  ): TF => {
    const { skipHof, ...rest } = (options ?? {}) as {
      skipHof?: boolean | ((...args: Parameters<TF>) => boolean | Promise<boolean>);
    } & Record<string, unknown>;
    if (skipHof === true) return fn;

    const layered = hofs.reduceRight<TF>((acc, hof) => hof(acc, rest), fn);

    if (layered === fn || typeof skipHof !== "function") return layered;

    return async function (this: ThisParameterType<TF>, ...args: Parameters<TF>) {
      return (await skipHof(...args))
        ? fn.apply(this, args)
        : layered.apply(this, args);
    } as TF;
  };

  return composed as unknown as HofFn<ComposedKind<Hs>, "async">;
}

/**
 * Sync counterpart of {@link withAsync}: same ordering and `skipHof` rules,
 * but the per-call predicate is sync and async functions are rejected at
 * compile time via the `AnySyncFunction<TF>` gate.
 * @param hofs - The HOFs to stack, outermost first.
 * @returns A fn-first wrapper applying the whole stack.
 */
export function withSync<const Hs extends readonly HofFn<any, "sync">[]>(
  ...hofs: Hs
): HofFn<ComposedKind<Hs>, "sync"> {
  const composed = <TF extends AnyFunction>(
    fn: AnySyncFunction<TF>,
    options?: WithSkipHof<MergeOptions<Hs, TF>, TF>,
  ): TF => {
    const raw = fn as TF;
    const { skipHof, ...rest } = (options ?? {}) as {
      skipHof?: boolean | ((...args: Parameters<TF>) => boolean);
    } & Record<string, unknown>;
    if (skipHof === true) return raw;

    const layered = hofs.reduceRight<TF>(
      (acc, hof) => (hof as AnyHof)(acc, rest),
      raw,
    );

    if (layered === raw || typeof skipHof !== "function") return layered;

    return function (this: ThisParameterType<TF>, ...args: Parameters<TF>) {
      return skipHof(...args)
        ? raw.apply(this, args)
        : layered.apply(this, args);
    } as TF;
  };

  return composed as unknown as HofFn<ComposedKind<Hs>, "sync">;
}
