import { useEffect, useState } from 'react'

interface GasMetrics {
  gasHigh: string
  gasLow: string
  gasAvg: string
  pdpHigh: string
  pdpLow: string
  pdpAvg: string
  profitHigh: string
  profitLow: string
  profitAvg: string
  profitUSDHigh: string
  profitUSDLow: string
  profitUSDAvg: string
  profitUSDMonthHigh: string
  profitUSDMonthLow: string
  profitUSDMonthAvg: string
}

export const GasCalculator = () => {
  const [dealPrice, setDealPrice] = useState<number>(2)
  const [filPrice, setFilPrice] = useState<number>(5)
  const [roots, setRoots] = useState<number>(100)
  const [proofSize, setProofSize] = useState<number>(1024)
  const [proofCount, setProofCount] = useState<number>(1)
  const [dayCount, setDayCount] = useState<number>(7)
  const [metrics, setMetrics] = useState<GasMetrics>({
    gasHigh: '0',
    gasLow: '0',
    gasAvg: '0',
    pdpHigh: '0',
    pdpLow: '0',
    pdpAvg: '0',
    profitHigh: '0',
    profitLow: '0',
    profitAvg: '0',
    profitUSDHigh: '0',
    profitUSDLow: '0',
    profitUSDAvg: '0',
    profitUSDMonthHigh: '0',
    profitUSDMonthLow: '0',
    profitUSDMonthAvg: '0',
  })

  const gasUnitsMap = {
    100: 140000000,
    1000: 150000000,
    10000: 160000000,
    100000: 170000000,
  }

  const baseFees = {
    High: 1e-10,
    Low: 1e-16,
    Avg: 5.56e-12,
  }

  const sci = (n: number) => {
    return Number(n).toExponential(2).replace('E', 'e')
  }

  useEffect(() => {
    calculate()
  }, [dealPrice, filPrice, roots, proofSize, proofCount, dayCount])

  const calculate = () => {
    const gasUnits = gasUnitsMap[roots as keyof typeof gasUnitsMap]
    const bytes = proofSize * 1024 ** 3
    const rewardUSD = dealPrice / (30 * 2 ** 40)
    const rewardFIL = rewardUSD / filPrice

    const upperBound = 0.05 * bytes * rewardFIL
    const lowerBound = 0.04 * bytes * rewardFIL
    const onePercent = 0.01 * bytes * rewardFIL

    const newMetrics: Partial<GasMetrics> = {}

    for (const tier in baseFees) {
      const baseFee = baseFees[tier as keyof typeof baseFees]

      const gasFeeSingle = baseFee * gasUnits + 1e-7 * Math.log10(gasUnits / roots)
      // Calculate proofs per day based on X proofs per Y days
      const proofsPerDay = proofCount / Math.max(1, dayCount)
      const gasFee = gasFeeSingle * proofsPerDay

      let pdpFee = 0
      if (gasFee > upperBound) {
        pdpFee = 0
      } else if (gasFee > lowerBound) {
        pdpFee = upperBound - gasFee
      } else {
        pdpFee = onePercent
      }

      pdpFee *= proofsPerDay
      const profit = rewardFIL * bytes - gasFee - pdpFee

      newMetrics[`gas${tier}` as keyof GasMetrics] = sci(gasFee)
      newMetrics[`pdp${tier}` as keyof GasMetrics] = sci(pdpFee)
      newMetrics[`profit${tier}` as keyof GasMetrics] = sci(profit)

      const profitUSD = profit * filPrice
      const profitUSDMonth = profitUSD * 30

      newMetrics[`profitUSD${tier}` as keyof GasMetrics] = profitUSD.toFixed(4)
      newMetrics[`profitUSDMonth${tier}` as keyof GasMetrics] = profitUSDMonth.toFixed(4)
    }

    setMetrics({ ...metrics, ...newMetrics })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">PDP Gas & Costs Calculator</h1>
          <p className="text-gray-600 mb-6">
            Calculate gas costs, fees, and profitability of Filecoin PDP based on your parameters
          </p>
        </div>

        <div className="p-4 border rounded-lg mb-6 bg-white">
          <p className="text-sm text-gray-700 mb-3">
            This calculator provides insights into the gas costs, fees, and profitability of Filecoin PDP
            based on on-chain activity. Adjust the values to see how different parameters affect profitability across various network conditions.
          </p>
          <details className="mt-2">
            <summary className="text-sm font-medium text-blue-600 cursor-pointer">More information about gas consumption</summary>
            <div className="mt-3 text-sm text-gray-600">
              <p className="mb-2">Gas consumption estimates are based on empirical measurements:</p>
              <ul className="list-disc pl-6 mb-3 space-y-1">
                <li><code className="bg-gray-50 px-1 rounded border">ProvePossession</code> for a proofset of 100 roots costs approximately 140M gas units.</li>
                <li>ProofSet size does not significantly impact gas usage.</li>
                <li>Increasing the number of roots increases cost by ~10M per 10x more roots.</li>
              </ul>
              <p className="text-xs text-gray-500">
                Data sources: 
                <a href="https://docs.google.com/spreadsheets/d/1zQ8jLi_JnQk0l89ql3qRpBZjHay8IwmVte3rQi2lvvc/edit?gid=0#gid=0" target="_blank" className="text-blue-500 hover:underline ml-1">
                  PDP Verifier empirical gas data
                </a>,
                <a href="https://filecoinproject.slack.com/archives/C0717TGU7V2/p1741801843702789" target="_blank" className="text-blue-500 hover:underline ml-1">
                  Filecoin Slack discussion
                </a>
              </p>
            </div>
          </details>
        </div>

        <h2 className="text-xl font-semibold mb-4">Parameters</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Gas Units Table */}
          <div className="border rounded-lg shadow-sm overflow-hidden bg-white">
            <div className="border-b p-3 bg-gray-50">
              <h3 className="text-base font-medium">Gas Units</h3>
            </div>
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border-b text-left text-xs font-medium text-gray-600">Roots</th>
                  <th className="p-2 border-b text-right text-xs font-medium text-gray-600">Gas Units</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 border-b text-xs text-gray-800">100 roots</td>
                  <td className="p-2 border-b text-xs text-right text-gray-800 font-mono">140,000,000</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 border-b text-xs text-gray-800">1,000 roots</td>
                  <td className="p-2 border-b text-xs text-right text-gray-800 font-mono">150,000,000</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 border-b text-xs text-gray-800">10,000 roots</td>
                  <td className="p-2 border-b text-xs text-right text-gray-800 font-mono">160,000,000</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 text-xs text-gray-800">100,000 roots</td>
                  <td className="p-2 text-xs text-right text-gray-800 font-mono">170,000,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Base Fee Table */}
          <div className="border rounded-lg shadow-sm overflow-hidden bg-white">
            <div className="border-b p-3 bg-gray-50">
              <h3 className="text-base font-medium">Base Fee Scenarios</h3>
            </div>
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border-b text-left text-xs font-medium text-gray-600">Network Condition</th>
                  <th className="p-2 border-b text-right text-xs font-medium text-gray-600">Base Fee</th>
                  <th className="p-2 border-b text-right text-xs font-medium text-gray-600">FIL Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 border-b text-xs text-gray-800 flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                    30-day average
                  </td>
                  <td className="p-2 border-b text-xs text-right text-gray-800">~5.5 picoFIL</td>
                  <td className="p-2 border-b text-xs text-right text-gray-800 font-mono">5.56e-12</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 border-b text-xs text-gray-800 flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                    Low congestion
                  </td>
                  <td className="p-2 border-b text-xs text-right text-gray-800">100 attoFIL</td>
                  <td className="p-2 border-b text-xs text-right text-gray-800 font-mono">1e-16</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="p-2 text-xs text-gray-800 flex items-center">
                    <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                    High congestion
                  </td>
                  <td className="p-2 text-xs text-right text-gray-800">0.1 nanoFIL</td>
                  <td className="p-2 text-xs text-right text-gray-800 font-mono">1e-10</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">Gas Fee & Profitability Calculator</h2>
        
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* Left column: Inputs - Made narrower */}
          <div className="w-full lg:w-1/4 flex-shrink-0">
            <div className="border rounded-lg shadow-sm overflow-hidden bg-white h-full">
              <div className="border-b p-3 bg-gray-50">
                <h3 className="text-base font-medium">Inputs</h3>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Deal price ($/TiB/month)
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-1">$</span>
                    <input 
                      type="number" 
                      className="block w-full rounded p-1 border text-sm" 
                      value={dealPrice} 
                      onChange={e => setDealPrice(parseFloat(e.target.value))} 
                      min="0" 
                      step="0.1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    FIL price (USD)
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-1">$</span>
                    <input 
                      type="number" 
                      className="block w-full rounded p-1 border text-sm" 
                      value={filPrice} 
                      onChange={e => setFilPrice(parseFloat(e.target.value))} 
                      min="0" 
                      step="0.1"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Number of roots
                  </label>
                  <select 
                    className="block w-full rounded p-1 border text-sm"
                    value={roots}
                    onChange={e => setRoots(parseInt(e.target.value))}
                  >
                    <option value="100">100</option>
                    <option value="1000">1,000</option>
                    <option value="10000">10,000</option>
                    <option value="100000">100,000</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    ProofSet size (GiB)
                  </label>
                  <div className="flex items-center">
                    <input 
                      type="number" 
                      className="block w-full rounded p-1 border text-sm" 
                      value={proofSize}
                      onChange={e => setProofSize(parseFloat(e.target.value))}
                      min="0" 
                      step="0.01"
                    />
                    <span className="text-gray-500 ml-1 text-xs">GiB</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Proving Frequency
                  </label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      className="block w-16 rounded p-1 border text-sm" 
                      value={proofCount}
                      onChange={e => setProofCount(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1" 
                      step="1"
                    />
                    <span className="text-xs text-gray-600">proof(s) per</span>
                    <input 
                      type="number" 
                      className="block w-16 rounded p-1 border text-sm" 
                      value={dayCount}
                      onChange={e => setDayCount(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1" 
                      step="1"
                    />
                    <span className="text-xs text-gray-600">day(s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Results - Wider */}
          <div className="w-full lg:w-3/4 flex-grow">
            <div className="border rounded-lg shadow-sm overflow-hidden bg-white h-full">
              <div className="border-b p-3 bg-gray-50">
                <h3 className="text-base font-medium">Results</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 border-b text-left text-xs font-medium text-gray-600 w-1/5">Metric</th>
                      <th className="p-2 border-b text-left text-xs font-medium text-gray-600 w-1/5">
                        <div className="flex items-center">
                          <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                          30d average
                        </div>
                      </th>
                      <th className="p-2 border-b text-left text-xs font-medium text-gray-600 w-1/5">
                        <div className="flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                          Low congestion
                        </div>
                      </th>
                      <th className="p-2 border-b text-left text-xs font-medium text-gray-600 w-1/5">
                        <div className="flex items-center">
                          <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                          High congestion
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 border-b text-xs text-gray-800">
                        {proofCount === 1 && dayCount === 1 
                          ? "Daily gas fee (FIL)" 
                          : `Gas fee per day (FIL, for ${proofCount} proof${proofCount > 1 ? 's' : ''} per ${dayCount} day${dayCount > 1 ? 's' : ''})`}
                      </td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.gasAvg}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.gasLow}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.gasHigh}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 border-b text-xs text-gray-800">
                        {proofCount === 1 && dayCount === 1 
                          ? "Daily PDP proof fee (FIL)" 
                          : `PDP proof fee per day (FIL, for ${proofCount} proof${proofCount > 1 ? 's' : ''} per ${dayCount} day${dayCount > 1 ? 's' : ''})`}
                      </td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.pdpAvg}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.pdpLow}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.pdpHigh}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 border-b text-xs text-gray-800">Daily profit (FIL)</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.profitAvg}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.profitLow}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">{metrics.profitHigh}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 border-b text-xs text-gray-800">Daily profit (USD)</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">${metrics.profitUSDAvg}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">${metrics.profitUSDLow}</td>
                      <td className="p-2 border-b text-xs text-gray-800 font-mono">${metrics.profitUSDHigh}</td>
                    </tr>
                    <tr className="hover:bg-gray-50 bg-gray-100">
                      <td className="p-2 text-xs font-medium text-gray-800">Monthly profit (USD)</td>
                      <td className="p-2 text-sm font-bold text-gray-800">
                        ${parseFloat(metrics.profitUSDMonthAvg).toFixed(2)}
                      </td>
                      <td className="p-2 text-sm font-bold text-gray-800">
                        ${parseFloat(metrics.profitUSDMonthLow).toFixed(2)}
                      </td>
                      <td className="p-2 text-sm font-bold text-gray-800">
                        ${parseFloat(metrics.profitUSDMonthHigh).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}