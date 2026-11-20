import type { AnchorHTMLAttributes, ReactNode } from "react";
import { pathToHash } from "../route";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode };

/** Stand-in for next/link: app paths become hash links. */
export default function Link({ href, children, ...rest }: Props) {
  return (
    <a href={pathToHash(href)} {...rest}>
      {children}
    </a>
  );
}
