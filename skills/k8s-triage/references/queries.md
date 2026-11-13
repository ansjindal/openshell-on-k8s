# Useful queries (demo namespace)

| Question | Tool | Query |
|---|---|---|
| Are the deployments' replicas available? | prometheus_query | `kube_deployment_status_replicas_available{namespace="demo"}` |
| Did anyone scale something to zero? | prometheus_query | `kube_deployment_spec_replicas{namespace="demo"} == 0` |
| Which containers restart? | prometheus_query | `increase(kube_pod_container_status_restarts_total{namespace="demo"}[15m]) > 0` |
| Which pods wait, and why? | prometheus_query | `kube_pod_container_status_waiting_reason{namespace="demo"}` |
| What errors does shop-app log? | loki_query | `{namespace="demo", app="shop-app"} \|= "error"` |
