import { request } from 'graphql-request'

export const fetcher = <T>([url, query, variables]: [
  string,
  string,
  Record<string, any> | undefined
]): Promise<T> => request(url, query, variables)
