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
      ["os-architecture", "/learn/openshell#t-3"], ["os-kernel", "/learn/build-an-agent"],
      ["security", "/learn/build-an-agent"], ["policy-file", "/learn/build-an-agent"],
      ["request-flow", "/learn/inference"], ["audit-signals", "/learn/audit"],
      ["big-picture", "/learn/deploy"], ["sentry", "/learn/next-steps"],
      ["create-sandbox", "/learn/build-an-agent"], ["into-the-sandbox", "/learn/build-an-agent"],
      ["tcp-egress", "/learn/policy"], ["lab-keys", "/learn/inference"], ["lab-audit", "/learn/audit"],
      ["m3-overview", "/learn/m2-overview"], ["m3-check", "/learn/m2-check"],
      ["skills", "/learn/skill-repo"], ["two-harnesses", "/learn/skill-repo"],
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
