import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useNetwork } from "@/contexts/NetworkContext";
import { Documentation } from "@/pages/Documentation";
import { GasCalculator } from "@/pages/GasCalculator";
import { Landing } from "@/pages/Landing";
import { PieceDetails } from "@/pages/PieceDetails";
import { ProofSetDetails } from "@/pages/ProofSetDetails";
import { ProofSets } from "@/pages/ProofSets";
import { ProviderDetails } from "@/pages/ProviderDetails";
import { Providers } from "@/pages/Providers";
import { ServiceDetails } from "@/pages/ServiceDetails";
import { Services } from "@/pages/Services";

// Redirect component with parameter capture
const CustomRedirect = ({ slug, midPath }: { slug: string; midPath: string }) => {
  const params = useParams();
  const { network } = useNetwork();
  const navigate = useNavigate();

  const target = params[slug];

  useEffect(() => {
    navigate(`/${network}/${midPath}/${target}`, { replace: true });
  }, [network, midPath, target, navigate]);

  return null;
};

const AppRoutes = () => {
  const { network } = useNetwork();

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Root route redirects to network-specific path */}
        <Route path="/" element={<Navigate to={`/${network}`} replace />} />

        {/* Network-specific routes */}
        <Route path="/:network" element={<Landing />} />
        <Route path="/:network/providers" element={<Providers />} />
        <Route path="/:network/providers/:providerId" element={<ProviderDetails />} />
        <Route path="/:network/piece/:cid" element={<PieceDetails />} />
        <Route path="/:network/datasets" element={<ProofSets />} />
        <Route path="/:network/dataset/:dataSetId" element={<ProofSetDetails />} />
        <Route path="/:network/piecesets" element={<ProofSets />} />
        <Route path="/:network/pieceset/:dataSetId" element={<ProofSetDetails />} />
        <Route path="/:network/services" element={<Services />} />
        <Route path="/:network/services/:serviceId" element={<ServiceDetails />} />

        {/* Network-agnostic routes */}
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/documentation/:docId" element={<Documentation />} />
        <Route path="/gas-calculator" element={<GasCalculator />} />

        {/* Legacy routes for backward compatibility */}
        <Route path="/providers" element={<Navigate to={`/${network}/providers`} replace />} />
        <Route path="/providers/:providerId" element={<CustomRedirect slug="providerId" midPath="providers" />} />
        <Route path="/datasets" element={<Navigate to={`/${network}/datasets`} replace />} />
        <Route path="/dataset/:dataSetId" element={<CustomRedirect slug="dataSetId" midPath="dataset" />} />
        <Route path="/piecesets" element={<Navigate to={`/${network}/piecesets`} replace />} />
        <Route path="/pieceset/:dataSetId" element={<CustomRedirect slug="dataSetId" midPath="pieceset" />} />
        <Route path="/services" element={<Navigate to={`/${network}/services`} replace />} />
        <Route path="/services/:serviceId" element={<CustomRedirect slug="serviceId" midPath="services" />} />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to={`/${network}`} replace />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
