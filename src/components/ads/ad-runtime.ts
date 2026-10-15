/**
 * What the JuicyAds loader told us on this page.
 *
 * Module state, not React state: the loader is mounted once in the root layout while
 * the slots are scattered across pages, and a fetch that failed is a fact about the
 * page rather than about any one component. An ad blocker refusing the request lands
 * here too, which is what lets every slot decide the same way without a round trip.
 */
export const adRuntime = {
  /** The JuicyAds zone loader errored or was blocked. */
  juicyLoaderFailed: false,
  /** The JuicyAds native script errored or was blocked. */
  juicyNativeFailed: false,
};
