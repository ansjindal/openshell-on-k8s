import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/Terminal";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";
import { EndToEndFlow } from "@/components/diagrams/EndToEndFlow";
import { OpenShellRuntime } from "@/components/diagrams/OpenShellRuntime";
import { OpenShellOnK8s } from "@/components/diagrams/OpenShellOnK8s";
import { PolicyExplorer } from "@/components/diagrams/PolicyExplorer";
import { SandboxFlow } from "@/components/diagrams/SandboxFlow";
import { SecurityLayers } from "@/components/diagrams/SecurityLayers";
import { SkillSupplyChain } from "@/components/diagrams/SkillSupplyChain";
import { FleetOrchestration } from "@/components/diagrams/FleetOrchestration";
import { DemoArchitecture } from "@/components/diagrams/DemoArchitecture";
import { Orchestrator } from "@/components/Orchestrator";
import { IncidentLab } from "@/components/IncidentLab";
import { FleetView } from "@/components/FleetView";

const components: MDXComponents = {
  Terminal,
  Callout,
  EndToEndFlow,
  OpenShellRuntime,
  OpenShellOnK8s,
  PolicyExplorer,
  SandboxFlow,
  SecurityLayers,
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
