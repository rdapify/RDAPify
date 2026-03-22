/**
 * Pre-built Grafana dashboard template for RDAPify.
 *
 * Import and use `RDAPIFY_GRAFANA_DASHBOARD` as the JSON input for the
 * Grafana "Import dashboard" UI (or POST it to the Grafana HTTP API).
 * The dashboard expects a Prometheus data source named `Prometheus`.
 *
 * @module infrastructure/monitoring/GrafanaDashboard
 */

/**
 * Grafana dashboard JSON template for RDAPify metrics.
 *
 * @example
 * ```typescript
 * import { RDAPIFY_GRAFANA_DASHBOARD } from 'rdapify';
 * import * as fs from 'fs';
 *
 * fs.writeFileSync('rdapify-dashboard.json',
 *   JSON.stringify(RDAPIFY_GRAFANA_DASHBOARD, null, 2));
 * // Then import the file in Grafana → Dashboards → Import
 * ```
 */
export const RDAPIFY_GRAFANA_DASHBOARD = {
  __inputs: [
    {
      name: 'DS_PROMETHEUS',
      label: 'Prometheus',
      description: '',
      type: 'datasource',
      pluginId: 'prometheus',
      pluginName: 'Prometheus',
    },
  ],
  __requires: [
    { type: 'grafana', id: 'grafana', name: 'Grafana', version: '9.0.0' },
    { type: 'datasource', id: 'prometheus', name: 'Prometheus', version: '1.0.0' },
    { type: 'panel', id: 'timeseries', name: 'Time series', version: '' },
    { type: 'panel', id: 'stat', name: 'Stat', version: '' },
    { type: 'panel', id: 'gauge', name: 'Gauge', version: '' },
  ],
  annotations: { list: [{ builtIn: 1, datasource: { type: 'grafana', uid: '-- Grafana --' }, enable: true, hide: true, iconColor: 'rgba(0, 211, 255, 1)', name: 'Annotations & Alerts', type: 'dashboard' }] },
  description: 'RDAPify RDAP client metrics — query rates, cache performance, and error tracking',
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 1,
  id: null,
  links: [],
  liveNow: false,
  panels: [
    // ---- Row 1: Overview stats ----
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'thresholds' }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] }, unit: 'short' }, overrides: [] },
      gridPos: { h: 4, w: 4, x: 0, y: 0 },
      id: 1,
      options: { colorMode: 'background', graphMode: 'area', justifyMode: 'auto', orientation: 'auto', reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, textMode: 'auto' },
      title: 'Total Queries',
      type: 'stat',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_queries_total', legendFormat: 'Queries', refId: 'A' }],
    },
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'thresholds' }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'red', value: null }, { color: 'orange', value: 0.8 }, { color: 'green', value: 0.95 }] }, unit: 'percentunit', max: 1, min: 0 }, overrides: [] },
      gridPos: { h: 4, w: 4, x: 4, y: 0 },
      id: 2,
      options: { colorMode: 'background', graphMode: 'none', justifyMode: 'auto', orientation: 'auto', reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, textMode: 'auto' },
      title: 'Success Rate',
      type: 'stat',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_success_rate', legendFormat: 'Success Rate', refId: 'A' }],
    },
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'thresholds' }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'red', value: null }, { color: 'orange', value: 0.3 }, { color: 'green', value: 0.7 }] }, unit: 'percentunit', max: 1, min: 0 }, overrides: [] },
      gridPos: { h: 4, w: 4, x: 8, y: 0 },
      id: 3,
      options: { colorMode: 'background', graphMode: 'none', justifyMode: 'auto', orientation: 'auto', reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, textMode: 'auto' },
      title: 'Cache Hit Rate',
      type: 'stat',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_cache_hit_rate', legendFormat: 'Cache Hit Rate', refId: 'A' }],
    },
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'thresholds' }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'orange', value: 500 }, { color: 'red', value: 2000 }] }, unit: 'ms' }, overrides: [] },
      gridPos: { h: 4, w: 4, x: 12, y: 0 },
      id: 4,
      options: { colorMode: 'value', graphMode: 'area', justifyMode: 'auto', orientation: 'auto', reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, textMode: 'auto' },
      title: 'Avg Response Time',
      type: 'stat',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_response_time_avg_ms', legendFormat: 'Avg', refId: 'A' }],
    },
    // ---- Row 2: Response time breakdown ----
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'palette-classic' }, custom: { axisCenteredZero: false, axisColorMode: 'text', axisLabel: '', axisPlacement: 'auto', barAlignment: 0, drawStyle: 'line', fillOpacity: 10, gradientMode: 'none', hideFrom: { legend: false, tooltip: false, viz: false }, lineInterpolation: 'linear', lineWidth: 1, pointSize: 5, scaleDistribution: { type: 'linear' }, showPoints: 'auto', spanNulls: false, stacking: { group: 'A', mode: 'none' }, thresholdsStyle: { mode: 'off' } }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'red', value: 80 }] }, unit: 'ms' }, overrides: [] },
      gridPos: { h: 8, w: 12, x: 0, y: 4 },
      id: 5,
      options: { legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true }, tooltip: { mode: 'single', sort: 'none' } },
      title: 'Response Time Percentiles',
      type: 'timeseries',
      targets: [
        { datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_response_time_p50_ms', legendFormat: 'P50', refId: 'A' },
        { datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_response_time_p90_ms', legendFormat: 'P90', refId: 'B' },
        { datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_response_time_p99_ms', legendFormat: 'P99', refId: 'C' },
      ],
    },
    // ---- Row 2: Queries by type ----
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'palette-classic' }, custom: { axisCenteredZero: false, axisColorMode: 'text', axisLabel: '', axisPlacement: 'auto', barAlignment: 0, drawStyle: 'line', fillOpacity: 10, gradientMode: 'none', hideFrom: { legend: false, tooltip: false, viz: false }, lineInterpolation: 'linear', lineWidth: 1, pointSize: 5, scaleDistribution: { type: 'linear' }, showPoints: 'auto', spanNulls: false, stacking: { group: 'A', mode: 'none' }, thresholdsStyle: { mode: 'off' } }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] }, unit: 'short' }, overrides: [] },
      gridPos: { h: 8, w: 12, x: 12, y: 4 },
      id: 6,
      options: { legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true }, tooltip: { mode: 'single', sort: 'none' } },
      title: 'Queries by Type',
      type: 'timeseries',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_queries_by_type_total', legendFormat: '{{type}}', refId: 'A' }],
    },
    // ---- Row 3: Errors ----
    {
      datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
      fieldConfig: { defaults: { color: { mode: 'palette-classic' }, custom: { axisCenteredZero: false, axisColorMode: 'text', axisLabel: '', axisPlacement: 'auto', barAlignment: 0, drawStyle: 'bars', fillOpacity: 80, gradientMode: 'none', hideFrom: { legend: false, tooltip: false, viz: false }, lineInterpolation: 'linear', lineWidth: 1, pointSize: 5, scaleDistribution: { type: 'linear' }, showPoints: 'auto', spanNulls: false, stacking: { group: 'A', mode: 'normal' }, thresholdsStyle: { mode: 'off' } }, mappings: [], thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] }, unit: 'short' }, overrides: [] },
      gridPos: { h: 8, w: 24, x: 0, y: 12 },
      id: 7,
      options: { legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true }, tooltip: { mode: 'single', sort: 'none' } },
      title: 'Errors by Type',
      type: 'timeseries',
      targets: [{ datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' }, expr: 'rdapify_errors_by_type_total', legendFormat: '{{error_type}}', refId: 'A' }],
    },
  ],
  refresh: '30s',
  schemaVersion: 38,
  style: 'dark',
  tags: ['rdapify', 'rdap'],
  templating: { list: [] },
  time: { from: 'now-1h', to: 'now' },
  timepicker: {},
  timezone: '',
  title: 'RDAPify',
  uid: 'rdapify-dashboard',
  version: 1,
  weekStart: '',
} as const;
