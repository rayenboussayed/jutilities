export type MaybePromise<T> = Promise<T> | T;

export type Prettier<T extends object> = NonNullable<{
  [K in keyof T]: T[K];
}>;

export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

export type AnyFunction = (...args: any) => any;

export type AnyAsyncFunction = (...args: any) => Promise<any>;

export type AnySyncFunction<T extends AnyFunction = AnyFunction> =
  ReturnType<T> extends
    | Promise<any>
    | Generator<any, any, any>
    | AsyncGenerator<any, any, any>
    ? never
    : T;

export type AnyGeneratorFunction = (...args: any) => Generator<any, any, any>;

export type AnyAsyncGeneratorFunction = (
  ...args: any
) => AsyncGenerator<any, any, any>;
