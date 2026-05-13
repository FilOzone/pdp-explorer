#!/usr/bin/env node

/**
 * Generates subgraph.yaml from network configuration
 * Usage: node generate-config.js [network]
 * Environment: NETWORK=mainnet node generate-config.js
 */

const fs = require("fs");
const path = require("path");
const mustache = require("mustache");
const {
  loadNetworkConfig,
  getNetworkFromArgs,
  getTemplatePath,
} = require("./utils/config-loader");

const network = getNetworkFromArgs();
const selectedConfig = loadNetworkConfig(network);

const templatePath = getTemplatePath("subgraph.template.yaml");
let templateContent;

try {
  templateContent = fs.readFileSync(templatePath, "utf8");
} catch (error) {
  console.error(`Error: Failed to read subgraph template at: ${templatePath}`);
  console.error(`Template Error: ${error.message}`);
  process.exit(1);
}

const yamlContent = mustache.render(templateContent, selectedConfig);

const outputPath = path.join(__dirname, "..", "subgraph.yaml");

try {
  fs.writeFileSync(outputPath, yamlContent);
  console.log(
    `✅ Generated subgraph.yaml for ${network} network at: ${outputPath}`
  );
} catch (error) {
  console.error(`Error: Failed to write subgraph.yaml to: ${outputPath}`);
  console.error(`Write Error: ${error.message}`);
  process.exit(1);
}
