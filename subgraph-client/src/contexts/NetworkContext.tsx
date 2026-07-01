import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useLocalStorage from "@/hooks/useLocalStorage";

export type Network = "mainnet" | "calibration";

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  subgraphUrl: string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [network, setNetwork] = useLocalStorage<Network>("pdp-network", "mainnet");
  const location = useLocation();
  const navigate = useNavigate();

  const getSubgraphUrl = (network: Network): string => {
    const urls = {
      mainnet: import.meta.env.VITE_SUBGRAPH_URL_MAINNET,
      calibration: import.meta.env.VITE_SUBGRAPH_URL_CALIBRATION,
    };

    const url = urls[network];

    if (!url) {
      throw new Error(`Missing environment variable: VITE_SUBGRAPH_URL_${network.toUpperCase()}`);
    }

    return url;
  };

  const subgraphUrl = getSubgraphUrl(network);

  // Handle network parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const networkParam = params.get("network")?.toLowerCase();

    if (networkParam && (networkParam === "mainnet" || networkParam === "calibration") && networkParam !== network) {
      setNetwork(networkParam);

      // Remove the network parameter from URL after processing
      params.delete("network");
      const newSearch = params.toString() ? `?${params.toString()}` : "";
      const newPath = location.pathname + newSearch + location.hash;
      navigate(newPath, { replace: true });
    }
  }, [location.search, location.hash, location.pathname, network, setNetwork, navigate]);

  // Handle network-specific paths
  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split("/");

    // If the path already starts with a network identifier, update local state
    if ((pathParts[1] === "mainnet" || pathParts[1] === "calibration") && pathParts[1] !== network) {
      setNetwork(pathParts[1] as Network);
    }
  }, [location.pathname, network, setNetwork]);

  const value = useMemo(() => ({ network, setNetwork, subgraphUrl }), [network, setNetwork, subgraphUrl]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
