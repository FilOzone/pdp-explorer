#!/usr/bin/env node

/**
 * Generates TypeScript constants file from network configuration
 * Usage: node generate-constants.js [network]
 * Environment: NETWORK=mainnet node generate-constants.js
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

/**
 * Validates that required contracts exist in the configuration
 * @param {Object} config - The network configuration object
 * @param {string} network - The network name for error messages
 */
function validateRequiredContracts(config, network) {
  const requiredContracts = ["PDPVerifier"];
  for (const contract of requiredContracts) {
    if (!config[contract] || !config[contract].address) {
      console.error(
        `Error: Missing or invalid '${contract}' configuration for network '${network}'`
      );
      console.error(
        `Each contract must have an 'address' field in config/network.json`
      );
      process.exit(1);
    }
  }
}

validateRequiredContracts(selectedConfig, network);

const templatePath = getTemplatePath("constants.template.ts");
let templateContent;

try {
  templateContent = fs.readFileSync(templatePath, "utf8");
} catch (error) {
  console.error(`Error: Failed to read constants template at: ${templatePath}`);
  console.error(`Template Error: ${error.message}`);
  process.exit(1);
}

const templateData = {
  network,
  timestamp: new Date().toISOString(),
  ...selectedConfig,
};

const constantsContent = mustache.render(templateContent, templateData);

const generatedDir = path.join(__dirname, "..", "src", "generated");
const outputPath = path.join(generatedDir, "constants.ts");

try {
  fs.mkdirSync(generatedDir, { recursive: true });

  fs.writeFileSync(outputPath, constantsContent);
  console.log(
    `✅ Generated constants for ${network} network at: ${outputPath}`
  );
} catch (error) {
  console.error(`Error: Failed to write constants file to: ${outputPath}`);
  console.error(`Write Error: ${error.message}`);
  console.error("Please check directory permissions and available disk space.");
  process.exit(1);
}
