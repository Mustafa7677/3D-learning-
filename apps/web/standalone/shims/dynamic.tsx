import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

type Loader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>;

/** Stand-in for next/dynamic (client-only): React.lazy behind Suspense. */
export default function dynamic<P extends object>(loader: Loader<P>, opts?: { loading?: () => ReactNode; ssr?: boolean }) {
  const Lazy = lazy(async () => {
    const m = await loader();
    return { default: "default" in m ? m.default : m };
  });
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <Lazy {...(props as P & JSX.IntrinsicAttributes)} />
      </Suspense>
    );
  };
}
