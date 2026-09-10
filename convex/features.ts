import { query } from "./_generated/server";

/**
 * Returns a map of all feature toggles.
 * Only returns platformSettings keys that start with "feature:".
 * If a key doesn't exist, the feature is assumed to be enabled by default
 * on the client side.
 */
export const getFlags = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("platformSettings").collect();
    
    const flags: Record<string, boolean> = {};
    
    for (const setting of settings) {
      if (setting.key.startsWith("feature:")) {
        // "true" means enabled, "false" means disabled
        flags[setting.key] = setting.value === "true";
      }
    }
    
    return flags;
  },
});
