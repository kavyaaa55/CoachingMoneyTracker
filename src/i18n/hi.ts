import type { Messages } from "./en";

export const hi: Messages = {
  appName: "फ़ीस ट्रैकर",
  tagline: "बिना फ़ोन किए जानें कि कितना और कब देना है।",
  status: {
    paid: "भुगतान हो गया",
    dueToday: "आज देय",
    dueIn: (days) => `${days} दिन में देय`,
    overdue: (days) => `${days} दिन की देरी`,
    partPaid: "आंशिक भुगतान",
  },
};
