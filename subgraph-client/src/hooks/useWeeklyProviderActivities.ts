import useSWRImmutable from 'swr/immutable'
import { fetcher } from '../utility/fetcher'
import { weeklyProviderActivitiesQuery } from '../utility/queries'
import { WeeklyProviderActivity } from '../utility/types'

const useWeeklyProviderActivities = (
  providerAddr: string,
  first: number,
  skip: number
) => {
  const { data, error, isLoading } = useSWRImmutable<{
    weeklyProviderActivities: WeeklyProviderActivity[]
  }>(
    [
      weeklyProviderActivitiesQuery,
      {
        first,
        skip,
        where: {
          providerId: providerAddr,
        },
      },
    ],
    fetcher
  )
  return { data, error, isLoading }
}

export default useWeeklyProviderActivities
