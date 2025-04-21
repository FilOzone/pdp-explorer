import { request } from 'graphql-request'

const PROJECT_ID = import.meta.env.VITE_GOLDSKY_PROJECT_ID
const PROJECT_NAME = import.meta.env.VITE_GOLDSKY_PROJECT_NAME
const NETWORK = import.meta.env.VITE_NETWORK

const SUBGRAPH_URL = `https://api.goldsky.com/api/public/${PROJECT_ID}/subgraphs/${PROJECT_NAME}/${NETWORK}/gn`

export const fetcher = <T>([query, variables]: [
  string,
  Record<string, any> | undefined
]): Promise<T> => request(SUBGRAPH_URL, query, variables)
