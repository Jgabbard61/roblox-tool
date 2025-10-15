/**
 * Professional Error Messages for Law Firm Deployment
 * Section 7.1 Implementation
 */

export const PROFESSIONAL_ERROR_MESSAGES = {
  rate_limited: {
    title: "Service Temporarily Unavailable",
    message:
      "Our verification service is currently experiencing high demand. Please wait a moment and try again.",
    technical: "Rate limit exceeded. The Roblox API has temporarily restricted requests.",
  },
  not_found: {
    title: "User Not Found",
    message:
      "We could not find a Roblox account matching this username. Please verify the spelling and try again.",
    technical: "No results returned from Roblox user search API.",
  },
  verification_failed: {
    title: "Verification Could Not Be Completed",
    message:
      "We were unable to complete the verification process. This may be due to privacy settings or account restrictions.",
    technical: "Unable to retrieve user verification status or description.",
  },
  service_error: {
    title: "Technical Difficulty",
    message:
      "We're experiencing a temporary technical issue. Please try again in a few moments or contact support if the problem persists.",
    technical: "Internal server error or external API failure.",
  },
};

export type ErrorType = keyof typeof PROFESSIONAL_ERROR_MESSAGES;
