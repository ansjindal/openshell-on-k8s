import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/Terminal";
import { Callout } from "@/components/Callout";
import { CodeBlock } from "@/components/CodeBlock";
import { ExpectedOutput } from "@/components/ExpectedOutput";
import { BeforeYouStart, Section, Step, Optional, Learned } from "@/components/course/Structure";
import { Output } from "@/components/course/Output";
import { Run } from "@/components/course/Run";
import { Quiz, Q } from "@/components/course/Quiz";
import { LiveDiagram, Diagram } from "@/components/course/LiveDiagram";
import { Fig, FigTour, FigRead } from "@/components/course/Fig";
import { DeckScene } from "@/components/course/DeckScene";
import { ReadScene } from "@/components/course/ReadScene";
import { ScrollBuild } from "@/components/course/ScrollBuild";
import { ModuleLessons } from "@/components/course/ModuleLessons";
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
  BeforeYouStart,
  Section,
  Step,
  Optional,
  Learned,
  Output,
  Run,
  Quiz,
  LiveDiagram,
  Diagram,
  ScrollBuild,
  DeckScene,
  ReadScene,
  Fig,
  FigTour,
  FigRead,
  ModuleLessons,
  Q,
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
