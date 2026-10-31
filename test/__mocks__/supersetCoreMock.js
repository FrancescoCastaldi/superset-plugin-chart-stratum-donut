class ChartMetadata {
  constructor(config) {
    Object.assign(this, config);
  }
}
class ChartPlugin {
  constructor(config) {
    this.config = config;
  }
  configure(extra) {
    this.config = { ...this.config, ...extra };
    return this;
  }
}

module.exports = {
  Behavior: { InteractiveChart: 'INTERACTIVE_CHART' },
  ChartMetadata,
  ChartPlugin,
  SupersetClient: { get: async () => ({ json: { result: [] } }) },
  buildQueryContext: (formData, build) => ({ queries: build({}), formData }),
  sharedControls: {},
};
