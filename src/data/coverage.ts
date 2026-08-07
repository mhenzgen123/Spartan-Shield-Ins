/**
 * Lines of business shown on the homepage coverage grid — spec 5.2.
 *
 * Every card ends in a `tel:` link, never a quote-form link. The strategy is
 * inbound calls to the owners, not form-filled leads in a queue.
 */

export type CoverageIcon = "auto" | "home" | "renters" | "business";

export interface Coverage {
  slug: string;
  title: string;
  icon: CoverageIcon;
  body: string;
  /** Suffix for the "Call about ..." link. */
  callLabel: string;
}

export const coverage: Coverage[] = [
  {
    slug: "auto",
    title: "Auto",
    icon: "auto",
    body: "Full coverage, liability, classic, motorcycle, RV. We re-shop your auto at every renewal instead of letting it drift up 8% a year.",
    callLabel: "auto",
  },
  {
    slug: "home",
    title: "Home",
    icon: "home",
    body: "Homeowners, condo, landlord, dwelling fire. Openly and Safeco give us options most captive agents in this market do not have.",
    callLabel: "home",
  },
  {
    slug: "renters",
    title: "Renters",
    icon: "renters",
    body: "Cheap, fast, and usually bundled with your auto for a discount that covers most of the premium.",
    callLabel: "renters",
  },
  {
    slug: "business",
    title: "Business",
    icon: "business",
    body: "General liability, commercial property, commercial auto, workers comp, BOPs. Small and mid-size Kentucky businesses.",
    callLabel: "business",
  },
];
