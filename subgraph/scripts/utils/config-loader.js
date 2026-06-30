const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_NETWORK = "mainnet";

/**
 * Gets the network name from command line arguments or environment variable
 * @param {string} defaultNetwork - The default network to use if none specified
 * @returns {string} The network name
 */
function getNetworkFromArgs(defaultNetwork = DEFAULT_NETWORK) {
  const args = process.argv.slice(2);
  const networkArgs = args.filter((arg) => !arg.startsWith("--"));
  return process.env.NETWORK || networkArgs[0] || defaultNetwork;
}

/**
 * Gets the absolute path to a template file
 * @param {string} templateName - The template filename
 * @returns {string} The absolute path to the template
 */
function getTemplatePath(templateName) {
  return path.join(__dirname, "..", "..", "templates", templateName);
}

/**
 * Loads and validates network configuration from config/network.json
 * @param {string} network - The network name to load
 * @returns {Object} The network configuration object
 */
function loadNetworkConfig(network = DEFAULT_NETWORK) {
  const configPath = path.join(__dirname, "..", "..", "config", "network.json");
  let networkConfig;

  try {
    const configContent = fs.readFileSync(configPath, "utf8");
    networkConfig = JSON.parse(configContent);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`Error: Configuration file not found at: ${configPath}`);
      console.error("Please ensure config/network.json exists in your project.");
      process.exit(1);
    }
    if (error instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in configuration file: ${configPath}`);
      console.error("Please check that config/network.json contains valid JSON.");
      console.error(`JSON Error: ${error.message}`);
      process.exit(1);
    }
    console.error(`Error reading configuration file: ${configPath}`);
    console.error(`File Error: ${error.message}`);
    process.exit(1);
  }

  if (!networkConfig.networks) {
    console.error("Error: Invalid configuration structure. Missing 'networks' object in config/network.json");
    console.error('Expected structure: { "networks": { "calibration": {...}, "mainnet": {...} } }');
    process.exit(1);
  }

  if (!networkConfig.networks[network]) {
    console.error(`Error: Network '${network}' not found in config/network.json`);
    console.error(`Available networks: ${Object.keys(networkConfig.networks).join(", ")}`);
    process.exit(1);
  }

  return networkConfig.networks[network];
}

module.exports = {
  loadNetworkConfig,
  getNetworkFromArgs,
  getTemplatePath,
  DEFAULT_NETWORK,
};
