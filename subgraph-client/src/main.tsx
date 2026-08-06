import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./router/routes";
import "./styles/index.css";
import { SWRConfig } from "swr";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Toaster } from "@/components/ui/toaster";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { fetcher } from "@/utility/fetcher";

// biome-ignore lint/style/noNonNullAssertion: #root is always present in index.html
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        errorRetryCount: 2,
        errorRetryInterval: 5000,
        onError: (err) => console.error("GraphQL SWR error:", err),
      }}
    >
      <BrowserRouter>
        <NetworkProvider>
          <ProgressBar />
          <AppRoutes />
          <Toaster />
        </NetworkProvider>
      </BrowserRouter>
    </SWRConfig>
  </React.StrictMode>,
);
