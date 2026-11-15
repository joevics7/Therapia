import type { MetadataRoute } from "next";
import { SITE } from "@/lib/blog";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/blog"], disallow: ["/admin", "/host", "/api", "/room", "/chat", "/invite", "/dashboard", "/groups", "/login", "/forgot"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
