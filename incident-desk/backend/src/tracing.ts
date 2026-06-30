/**
 * OpenTelemetry tracing → Tempo (OTLP HTTP). Each RCA run becomes a trace:
 *   rca.run  → agent.<role>[.<source>]  (with step events)  → … → sender
 * Tempo is deployed in the monitoring namespace and wired into Grafana as a datasource, so a run's
 * trace ID deep-links into Grafana Explore. (Mirrors the amdocs-claw Tempo/OTel setup.)
 */
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { trace } from "@opentelemetry/api";

const url = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  ?? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://tempo.monitoring.svc.cluster.local:4318"}/v1/traces`;

const provider = new NodeTracerProvider({
  resource: new Resource({ "service.name": process.env.OTEL_SERVICE_NAME ?? "incident-desk" }),
});
provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({ url })));
provider.register();

export const tracer = trace.getTracer("incident-desk");
console.log(`otel tracing → ${url}`);
