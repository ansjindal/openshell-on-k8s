import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // node-pty is a native addon used only by the custom server (server.mjs) at runtime.
  serverExternalPackages: ["node-pty"],
  // Lessons that were renamed or folded into others: old links and open tabs
  // land on the page that now holds their content instead of a 404.
  async redirects() {
    const moved: [string, string][] = [
      ["os-architecture", "/learn/openshell#t-4"], ["os-kernel", "/learn/openshell#t-6"],
      ["security", "/learn/openshell#t-7"], ["policy-file", "/learn/openshell#t-7"],
      ["request-flow", "/learn/openshell#t-8"], ["audit-signals", "/learn/openshell#t-10"],
      ["big-picture", "/learn/openshell#t-12"], ["sentry", "/learn/openshell#t-13"],
      ["m1-overview", "/learn/openshell"], ["m1-check", "/learn/os-check"], ["m0-check", "/learn/os-check"], ["pi-agent", "/learn/agent-on-k8s"],
    ];
    return moved.map(([from, to]) => ({ source: `/learn/${from}`, destination: to, permanent: false }));
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
