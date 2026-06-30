// OpenTelemetry auto-instrumentation (http + pg) → Tempo via OTLP/HTTP.
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { Resource } = require("@opentelemetry/resources");

const sdk = new NodeSDK({
  resource: new Resource({ "service.name": process.env.OTEL_SERVICE_NAME || "orders-api" }),
  traceExporter: new OTLPTraceExporter({
    url: (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://tempo.monitoring.svc.cluster.local:4318") + "/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
});
sdk.start();
