const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const reactPlugin = react.default || react;

module.exports = defineConfig({
  plugins: [reactPlugin()],
  server: {
    port: 4173,
    strictPort: true
  },
  preview: {
    port: 4174,
    strictPort: true
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"]
  }
});
