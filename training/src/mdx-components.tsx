import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/Terminal";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";
import { ExpectedOutput } from "@/components/ExpectedOutput";
import { Figure } from "@/components/Figure";
import { PolicyExplorer } from "@/components/diagrams/PolicyExplorer";
import { SkillSupplyChain } from "@/components/diagrams/SkillSupplyChain";
import { FleetOrchestration } from "@/components/diagrams/FleetOrchestration";
import { DemoArchitecture } from "@/components/diagrams/DemoArchitecture";
import { Orchestrator } from "@/components/Orchestrator";
import { IncidentLab } from "@/components/IncidentLab";
import { FleetView } from "@/components/FleetView";

const components: MDXComponents = {
  Terminal,
  Callout,
  ExpectedOutput,
  Figure,
  PolicyExplorer,
  SkillSupplyChain,
  FleetOrchestration,
  DemoArchitecture,
  Orchestrator,
  IncidentLab,
  FleetView,
  pre: CodeBlock, // every fenced code block gets a Copy / Run-in-shell toolbar
};

export function useMDXComponents(): MDXComponents {
  return components;
}

export { components as mdxComponents };
