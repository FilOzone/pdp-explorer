# Subgraph Deployment and Client Usage

This guide details the steps required to deploy the provided subgraph to Goldsky and run the accompanying subgraph client application.

## Prerequisites

Before you begin, ensure you have the following installed and set up:

1.  **Node.js and npm/yarn:** The subgraph development and client rely on Node.js. Download and install it from [nodejs.org](https://nodejs.org/). npm is included, or you can install yarn ([yarnpkg.com](https://classic.yarnpkg.com/en/docs/install)).
2.  **Graph CLI:** This command-line tool is essential for interacting with subgraphs (code generation, building). Install it globally:
    ```bash
    npm install -g @graphprotocol/graph-cli
    # or
    yarn global add @graphprotocol/graph-cli
    ```
    Refer to the [Graph CLI documentation](https://github.com/graphprotocol/graph-tooling/tree/main/packages/cli) for more details.
3.  **Goldsky Account:** You need an account on Goldsky to host your subgraph. Sign up at [goldsky.com](https://goldsky.com/).
4.  **Goldsky CLI:** This tool allows you to deploy subgraphs to the Goldsky platform. Follow the installation instructions in the [Goldsky Documentation](https://docs.goldsky.com/introduction).

## Deploying the Subgraph to Goldsky

Follow these steps to build and deploy the subgraph:

1. **Clone the Repository:**
   Clone the repository from GitHub:

   ```bash
   git clone https://github.com/FilOzone/pdp-explorer.git
   ```

2. **Navigate to Subgraph Directory:**
   Open your terminal and change to the `subgraph` directory within the project:

   ```bash
   cd ./pdp-explorer/subgraph
   ```

3. **Install Dependencies:**
   Install the necessary node modules:

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Authenticate with Goldsky:**
   Log in to your Goldsky account using the CLI. Go to settings section of your Goldsky dashboard to get your API key.

   ```bash
   goldsky login
   ```

5. **Generate Code:**
   The Graph CLI uses the `subgraph.yaml` manifest and GraphQL schema (`schema.graphql`) to generate AssemblyScript types.

   ```bash
   graph codegen
   ```

6. **Build the Subgraph:**
   Compile your subgraph code into WebAssembly (WASM).

   ```bash
   graph build
   ```

7. **Deploy to Goldsky:**
   Use the Goldsky CLI to deploy your built subgraph.

   ```bash
   goldsky subgraph deploy <your-subgraph-name>/<version> --path ./
   ```

   - Replace `<your-subgraph-name>` with the desired name for your subgraph deployment on Goldsky (e.g., `my-pdp-explorer`). You can create/manage this name in your Goldsky dashboard.
   - Replace `<version>` with a version identifier (e.g., `v0.0.1`).
   - You can manage your deployments and find your subgraph details in the [Goldsky Dashboard](https://app.goldsky.com/). The deployment command will output the GraphQL endpoint URL for your subgraph upon successful completion. **Copy this URL**, as you will need it for the client.

8. **Tag your subgraph (Optional):**
   Tag the subgraph you deployed in step 6.

   ```bash
   goldsky subgraph tag create <your-subgraph-name>/<version> --tag <tag-name>
   ```

   - Replace `<tag-name>` with a tag name (e.g., `mainnet`).

   Remove the tag when you want to deploy a new version of the subgraph.

   ```bash
   goldsky subgraph tag delete <your-subgraph-name>/<version> --tag <tag-name>
   ```

## Running the Subgraph Client

The `subgraph-client` is a Vite application that queries the deployed subgraph.

1.  **Navigate to Client Directory:**
    Open your terminal and change to the `subgraph-client` directory:

    ```bash
    cd path/to/pdp-explorer/subgraph-client
    ```

2.  **Set Environment Variables:**
    The client needs to know where to find the subgraph. Create a `.env` file in the `subgraph-client` directory with the following content:

    ```dotenv
    VITE_GOLDSKY_PROJECT_ID=<your-goldsky-project-id> # goldsky project id ( subgraph project id )
    VITE_GOLDSKY_PROJECT_NAME=<your-goldsky-project-name> # goldsky project name ( subgraph project name )
    VITE_MAINNET_PDP_VERIFIER= # mainnet pdp verifier contract address
    VITE_MAINNET_PDP_SERVICE= # mainnet pdp simple service contract address
    VITE_CALIBRATION_PDP_VERIFIER= # calibration pdp verifier contract address
    VITE_CALIBRATION_PDP_SERVICE= # calibration pdp simple service contract address
    VITE_GOLDSKY_MAINNET_SUBGRAPH_VERSION= # mainnet subgraph version
    VITE_GOLDSKY_CALIBRATION_SUBGRAPH_VERSION= # calibration subgraph version
    ```

    - Replace `<your-goldsky-project-id>` and `<your-goldsky-project-name>` with the project ID and name from the Goldsky dashboard.

3.  **Install Dependencies:**
    If you haven't already, install the client's dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

4.  **Run in Development Mode:**
    Start the Vite development server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically open the application in your default web browser, usually at `http://localhost:5173` or a similar address shown in the terminal.

## Modifying and Redeploying the Subgraph

If you need to make changes to the subgraph's logic, schema, or configuration, follow these general steps:

1.  **Modify Code:** Edit the relevant files:

    - `schema.graphql`: To change the data structure and entities being stored.
    - `subgraph.yaml`: To update contract addresses, ABIs, start blocks, or event handlers.
    - `src/*.ts`: To alter the logic that processes blockchain events and maps them to the defined schema entities.
    - `utils/index.ts`: If modifying shared utility functions or constants.

2.  **Important Note on PDPVerifier Address:** The handler `handleFaultRecord` in `src/pdp-service.ts` makes a contract call to the PDPVerifier contract. The address for this contract is currently hardcoded in `subgraph/utils/index.ts`:

    ```typescript
    // subgraph/utils/index.ts
    export const PDPVerifierAddress = '0x...' // Example address
    ```

    **If you update the `PDPVerifier` contract address in your `subgraph.yaml` file to index a different deployment, you MUST also update the `PDPVerifierAddress` constant in `subgraph/utils/index.ts` to match the new address.** Failure to do so will result in the `handleFaultRecord` handler calling the wrong contract instance.

3.  **Regenerate Code:** After modifying the schema or manifest, always regenerate the AssemblyScript types:

    ```bash
    graph codegen
    ```

4.  **Rebuild:** Compile the updated subgraph code:

    ```bash
    graph build
    ```

5.  **Redeploy:** Deploy the new version to Goldsky. It's good practice to increment the version number:
    ```bash
    goldsky subgraph deploy <your-subgraph-name>/<new-version> --path ./
    ```
    Replace `<new-version>` (e.g., `v0.0.2`).

**Development Resources:**

- **AssemblyScript:** Subgraph mappings are written in AssemblyScript, a subset of TypeScript that compiles to Wasm. Learn more at [https://www.assemblyscript.org/](https://www.assemblyscript.org/).
- **The Graph Documentation:** The official documentation covers subgraph development in detail: [https://thegraph.com/docs/en/subgraphs/developing/creating/starting-your-subgraph/](https://thegraph.com/docs/en/subgraphs/developing/creating/starting-your-subgraph/).

## Further Information

- **Graph Protocol Documentation:** [https://thegraph.com/docs/en/](https://thegraph.com/docs/en/)
- **Goldsky Documentation:** [https://docs.goldsky.com/](https://docs.goldsky.com/)
