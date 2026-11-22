/**
 * A profile page needs the user, then their posts (which need the user's id),
 * then the comments of each of 8 posts. How the frontend awaits decides how
 * long the page takes: one after another (a waterfall), all comments at once
 * (Promise.all, but HTTP/1.1 opens at most 6 connections to a host), or one
 * batched request for every comment.
 */

export type FetchStrategy = "serial" | "parallel" | "batch";
export const STRATEGIES: FetchStrategy[] = ["serial", "parallel", "batch"];
export const POSTS = 8;
/** Browsers open at most this many HTTP/1.1 connections to one host. */
export const CONN_LIMIT = 6;
export const MS = { user: 120, posts: 150, comment: 110, batch: 160 };

export interface Fetch {
  name: string;
  start: number;
  end: number;
}

export interface WaterfallRun {
  strategy: FetchStrategy;
  fetches: Fetch[];
  total: number;
  requests: number;
}

export function runWaterfall(strategy: FetchStrategy): WaterfallRun {
  const fetches: Fetch[] = [{ name: "GET /user", start: 0, end: MS.user }];
  // Posts depend on the user's id: never parallel with it.
  fetches.push({ name: "GET /user/posts", start: MS.user, end: MS.user + MS.posts });
  let t = MS.user + MS.posts;
  if (strategy === "serial") {
    for (let i = 1; i <= POSTS; i++) {
      fetches.push({ name: `GET /posts/${i}/comments`, start: t, end: t + MS.comment });
      t += MS.comment;
    }
  } else if (strategy === "parallel") {
    // Each connection takes the next waiting request when it is free.
    const free = Array.from({ length: CONN_LIMIT }, () => t);
    for (let i = 1; i <= POSTS; i++) {
      const c = free.indexOf(Math.min(...free));
      fetches.push({ name: `GET /posts/${i}/comments`, start: free[c]!, end: free[c]! + MS.comment });
      free[c]! += MS.comment;
    }
  } else {
    fetches.push({ name: `GET /comments?posts=1..${POSTS}`, start: t, end: t + MS.batch });
  }
  return { strategy, fetches, total: Math.max(...fetches.map((f) => f.end)), requests: fetches.length };
}
