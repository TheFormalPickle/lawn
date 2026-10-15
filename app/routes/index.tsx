import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import Homepage from "./-home";

export const Route = createFileRoute("/")({
  head: () =>
    seoHead({
      title: "Atrium — content workspace",
      description:
        "Client assignments, creative review and a shared content library for the agency.",
      path: "/",
      noIndex: true,
    }),
  component: Homepage,
});
