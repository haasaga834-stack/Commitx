import { createFileRoute, redirect } from "@tanstack/react-router";

/** /support is a common guess for the help page; keep it as a permanent alias. */
export const Route = createFileRoute("/support")({
  beforeLoad: () => {
    throw redirect({ to: "/contact", statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "CommitX Support" },
      { name: "description", content: "Get help with CommitX accounts, sessions and Cx Coins." },
      { property: "og:title", content: "CommitX Support" },
      { property: "og:description", content: "Get help with CommitX accounts, sessions and Cx Coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
