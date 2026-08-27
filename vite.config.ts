import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import fs from 'fs';
import { build as viteBuild } from 'vite';

const ENTRIES = {
  'content/contentScript': resolve(__dirname, 'src/content/contentScript.ts'),
  'inject/geometrySpoofer': resolve(__dirname, 'src/inject/geometrySpoofer.ts'),
  'inject/videoAdEngine': resolve(__dirname, 'src/inject/videoAdEngine.ts'),
  'background/serviceWorker': resolve(__dirname, 'src/background/serviceWorker.ts'),
  'popup/popup': resolve(__dirname, 'src/popup/popup.ts'),
};

/**
 * Copy extension manifests, DNR rules, mocks, and styles to dist directory.
 */
function copyExtensionAssets() {
  const distDir = resolve(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json
  const manifestSrc = resolve(__dirname, 'manifest.json');
  const manifestDest = resolve(distDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDest);
  }

  // Copy rules directory
  const rulesSrcDir = resolve(__dirname, 'rules');
  const rulesDestDir = resolve(distDir, 'rules');
  if (fs.existsSync(rulesSrcDir)) {
    if (!fs.existsSync(rulesDestDir)) {
      fs.mkdirSync(rulesDestDir, { recursive: true });
    }
    for (const file of fs.readdirSync(rulesSrcDir)) {
      fs.copyFileSync(resolve(rulesSrcDir, file), resolve(rulesDestDir, file));
    }
  }

  // Copy content styles (ghostQuarantine.css)
  const contentSrcDir = resolve(__dirname, 'src/content');
  const contentDestDir = resolve(distDir, 'content');
  if (fs.existsSync(contentSrcDir)) {
    if (!fs.existsSync(contentDestDir)) {
      fs.mkdirSync(contentDestDir, { recursive: true });
    }
    for (const file of fs.readdirSync(contentSrcDir)) {
      if (file.endsWith('.css')) {
        fs.copyFileSync(resolve(contentSrcDir, file), resolve(contentDestDir, file));
      }
    }
  }

  // Copy popup assets (popup.html, popup.css)
  const popupSrcDir = resolve(__dirname, 'src/popup');
  const popupDestDir = resolve(distDir, 'popup');
  if (fs.existsSync(popupSrcDir)) {
    if (!fs.existsSync(popupDestDir)) {
      fs.mkdirSync(popupDestDir, { recursive: true });
    }
    for (const file of fs.readdirSync(popupSrcDir)) {
      if (file.endsWith('.html') || file.endsWith('.css')) {
        fs.copyFileSync(resolve(popupSrcDir, file), resolve(popupDestDir, file));
      }
    }
  }

  // Copy public/mocks
  const mocksSrcDir = resolve(__dirname, 'public/mocks');
  const mocksDestDir = resolve(distDir, 'mocks');
  if (fs.existsSync(mocksSrcDir)) {
    if (!fs.existsSync(mocksDestDir)) {
      fs.mkdirSync(mocksDestDir, { recursive: true });
    }
    for (const file of fs.readdirSync(mocksSrcDir)) {
      fs.copyFileSync(resolve(mocksSrcDir, file), resolve(mocksDestDir, file));
    }
  }

  // Copy public/icons
  const iconsSrcDir = resolve(__dirname, 'public/icons');
  const iconsDestDir = resolve(distDir, 'icons');
  if (fs.existsSync(iconsSrcDir)) {
    if (!fs.existsSync(iconsDestDir)) {
      fs.mkdirSync(iconsDestDir, { recursive: true });
    }
    for (const file of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(resolve(iconsSrcDir, file), resolve(iconsDestDir, file));
    }
  }

  // Clean up any residual chunk directories
  const chunksDir = resolve(distDir, 'chunks');
  if (fs.existsSync(chunksDir)) {
    fs.rmSync(chunksDir, { recursive: true, force: true });
  }
}

/**
 * Custom Vite plugin to compile all extension scripts as self-contained IIFE files
 * with zero external imports and no code-splitting chunks.
 */
function standaloneIIFEPlugin() {
  return {
    name: 'standalone-iife-plugin',
    apply: 'build' as const,
    async closeBundle() {
      if (process.env.VITE_STANDALONE_BUILD || process.env.VITEST) return;

      process.env.VITE_STANDALONE_BUILD = 'true';
      try {
        for (const [entryName, entryPath] of Object.entries(ENTRIES)) {
          await viteBuild({
            configFile: false,
            publicDir: false,
            build: {
              outDir: 'dist',
              emptyOutDir: false,
              minify: false,
              target: 'es2022',
              rollupOptions: {
                input: { [entryName]: entryPath },
                output: {
                  entryFileNames: '[name].js',
                  format: 'iife',
                  name: 'GhostBlock_' + entryName.replace(/[^a-zA-Z0-9]/g, '_'),
                  extend: true,
                },
              },
            },
          });
        }
        copyExtensionAssets();
      } finally {
        delete process.env.VITE_STANDALONE_BUILD;
      }
    },
  };
}

export default defineConfig({
  plugins: [standaloneIIFEPlugin()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    rollupOptions: {
      input: {
        'content/contentScript': resolve(__dirname, 'src/content/contentScript.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'GhostBlock_content_contentScript',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});

