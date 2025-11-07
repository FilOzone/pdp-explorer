import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MetricItem } from '@/components/shared/MetricItem'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { formatDataSize } from '@/utility/helper'
import { Service, DataSet, ProviderLink } from '@/utility/types'
import useGraphQL from '@/hooks/useGraphQL'
import { serviceDetailsQuery, serviceProvidersQuery } from '@/utility/queries'
import { CopyableText } from '@/components/shared/CopyableText'
import { ProofSetsTable } from '@/components/ProofSets/ProofSetsTable'
import { ProvidersTable } from '@/components/Providers/ProvidersTable'
import GoBackLink from '@/components/go-back'

const ITEMS_PER_PAGE = 10

export const ServiceDetails = () => {
  const { serviceId } = useParams<{ serviceId: string }>()
  const [currentProofSetsPage, setCurrentProofSetsPage] = useState(1)
  const [currentProvidersPage, setCurrentProvidersPage] = useState(1)
  const [activeTab, setActiveTab] = useState('providers')

  // Define types for GraphQL responses
  interface ServiceDetailsResponse {
    service: Service & {
      dataSets: DataSet[]
    }
  }

  interface ServiceProvidersResponse {
    service: Service & {
      providerLinks: ProviderLink[]
    }
  }

  // Fetch service details and proof sets
  const {
    data: serviceData,
    error: serviceError,
    isLoading: serviceLoading,
  } = useGraphQL<ServiceDetailsResponse>(
    serviceDetailsQuery,
    {
      serviceId,
      first: ITEMS_PER_PAGE,
      skip: (currentProofSetsPage - 1) * ITEMS_PER_PAGE,
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  )

  // Fetch service providers
  const {
    data: providersData,
    error: providersError,
    isLoading: providersLoading,
  } = useGraphQL<ServiceProvidersResponse>(
    serviceProvidersQuery,
    {
      serviceId,
      first: ITEMS_PER_PAGE,
      skip: (currentProvidersPage - 1) * ITEMS_PER_PAGE,
    },
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  )

  const service = serviceData?.service
  const dataSets = service?.dataSets || []
  const providerLinks = providersData?.service?.providerLinks || []

  // Transform providerLinks to providers format expected by ProvidersTable
  const providers = providerLinks.map((link) => link.provider)

  // Calculate total pages
  const totalProofSets = service?.totalProofSets
    ? parseInt(service.totalProofSets)
    : 0
  const totalProofSetsPages = Math.max(
    1,
    Math.ceil(totalProofSets / ITEMS_PER_PAGE)
  )

  const totalProviders = service?.totalProviders
    ? parseInt(service.totalProviders)
    : 0
  const totalProvidersPages = Math.max(
    1,
    Math.ceil(totalProviders / ITEMS_PER_PAGE)
  )

  if (serviceError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Service</AlertTitle>
        <AlertDescription>
          Could not load service details. Error:{' '}
          {serviceError.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <GoBackLink />
      </div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Service Contract Details</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          <CopyableText value={service?.address || ''} />
        </p>

        {/* Service Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Service Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {serviceLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded"></div>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded"></div>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricItem
                  title="Total Data Sets"
                  value={parseInt(
                    service?.totalProofSets || '0'
                  ).toLocaleString()}
                />
                <MetricItem
                  title="Total Providers"
                  value={parseInt(
                    service?.totalProviders || '0'
                  ).toLocaleString()}
                />
                <MetricItem
                  title="Total Data Size"
                  value={formatDataSize(service?.totalDataSize || '0')}
                />
                <MetricItem
                  title="Total Pieces"
                  value={parseInt(service?.totalRoots || '0').toLocaleString()}
                />
                <MetricItem
                  title="Faulted Pieces"
                  value={parseInt(
                    service?.totalFaultedRoots || '0'
                  ).toLocaleString()}
                />
                <MetricItem
                  title="Faulted Periods"
                  value={parseInt(
                    service?.totalFaultedPeriods || '0'
                  ).toLocaleString()}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Data Sets and Providers */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="proofsets">Data Sets</TabsTrigger>
          </TabsList>

          <TabsContent value="providers">
            <div className="border rounded">
              <ProvidersTable
                providers={providers}
                isLoading={providersLoading}
                error={providersError}
                searchQuery=""
              />
            </div>

            {totalProvidersPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={currentProvidersPage}
                  totalPages={totalProvidersPages}
                  onPageChange={setCurrentProvidersPage}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="proofsets">
            <div className="border rounded">
              <ProofSetsTable
                dataSets={dataSets}
                isLoading={serviceLoading}
                error={serviceError}
                searchQuery=""
              />
            </div>

            {totalProofSetsPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  currentPage={currentProofSetsPage}
                  totalPages={totalProofSetsPages}
                  onPageChange={setCurrentProofSetsPage}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ServiceDetails
