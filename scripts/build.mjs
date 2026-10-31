import path from 'node:path';
import { build } from 'esbuild';

const outfile = 'dist/index.esm.js';
const outDir = path.dirname(path.resolve(outfile));

// The gallery images are ~700 KB each: inlining them as data URLs would grow the
// bundle by ~1.9 MB. src/ ships with the package, so the bundle keeps the imports
// and points them at src/images for the host bundler to resolve.
const externalImages = {
  name: 'external-images',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /\.(png|svg)$/ }, ({ path: request, resolveDir }) => {
      const relative = path
        .relative(outDir, path.resolve(resolveDir, request))
        .split(path.sep)
        .join('/');
      return { path: relative.startsWith('.') ? relative : `./${relative}`, external: true };
    });
  },
};

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: ['es2020', 'chrome110', 'firefox110', 'safari16'],
  minify: true,
  sourcemap: 'linked',
  // src/ ships with the package, so the map resolves sources without embedding them.
  sourcesContent: false,
  outfile,
  external: [
    'react',
    'react-dom',
    '@superset-ui/core',
    '@superset-ui/chart-controls',
    'echarts/core',
    'echarts/charts',
    'echarts/components',
    'echarts/renderers',
  ],
  plugins: [externalImages],
  logLevel: 'info',
});
