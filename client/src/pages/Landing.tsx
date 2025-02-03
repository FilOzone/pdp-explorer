import { dummyProviders, dummyProofSets } from '@/data/dummyData'
import { Link } from 'react-router-dom'

export const Landing = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Logo and Search */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold">PDP Explorer</h1>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search for a ProofSet/Provider"
            className="w-full p-2 border rounded-lg pl-10"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
        </div>
      </div>

      {/* Network Wide Metrics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Network Wide Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total ProofSets"
            value={dummyProofSets.metadata.total}
          />
          <MetricCard
            title="# of PDP Providers"
            value={dummyProviders.metadata.total}
          />
          <MetricCard title="Total Data Size" value="1.5 PB" />
          <MetricCard title="Total # of Data Pieces" value="1,234" />
          <MetricCard title="Total # of PDP proofs" value="45,678" />
          <MetricCard title="Total # of Faults" value="23" />
          <MetricCard title="Total Unique Data Size" value="1.2 PB" />
          <MetricCard title="Total # of Unique Pieces" value="987" />
        </div>
      </div>

      {/* Providers Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Providers</h2>
          <Link to="/providers" className="text-blue-500 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Provider</th>
                <th className="p-2 border">ProofSet#</th>
                <th className="p-2 border">Data Size</th>
                <th className="p-2 border">Joined Date</th>
                <th className="p-2 border">Last Seen</th>
                <th className="p-2 border">Fault #</th>
                <th className="p-2 border">Activity</th>
              </tr>
            </thead>
            <tbody>
              {dummyProviders.data.map((provider, index) => (
                <tr key={provider.providerId}>
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">
                    <Link
                      to={`/providers/${provider.providerId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {provider.providerId}
                    </Link>
                  </td>
                  <td className="p-2 border">{provider.activeProofSets}</td>
                  <td className="p-2 border">
                    {(provider.dataSizeStored / 1024 / 1024 / 1024).toFixed(2)}{' '}
                    GB
                  </td>
                  <td className="p-2 border">
                    {new Date(provider.firstSeen).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">
                    {new Date(provider.lastSeen).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">{provider.faults}</td>
                  <td className="p-2 border">📈</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ProofSets Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">ProofSets</h2>
          <Link to="/proofsets" className="text-blue-500 hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Proof Set ID</th>
                <th className="p-2 border">Provider</th>
                <th className="p-2 border">Root #</th>
                <th className="p-2 border">ProofSet Size</th>
                <th className="p-2 border">Proved #</th>
                <th className="p-2 border">Last Proof</th>
                <th className="p-2 border">Next Proof</th>
              </tr>
            </thead>
            <tbody>
              {dummyProofSets.data.map((proofSet, index) => (
                <tr key={proofSet.proofSetId}>
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">
                    <Link
                      to={`/proofsets/${proofSet.proofSetId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {proofSet.proofSetId}
                    </Link>
                  </td>
                  <td className="p-2 border">{proofSet.providerId}</td>
                  <td className="p-2 border">-</td>
                  <td className="p-2 border">
                    {(proofSet.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="p-2 border">{proofSet.proofsSubmitted}</td>
                  <td className="p-2 border">
                    {new Date(proofSet.lastProofReceived).toLocaleDateString()}
                  </td>
                  <td className="p-2 border">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const MetricCard = ({
  title,
  value,
}: {
  title: string
  value: string | number
}) => {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
