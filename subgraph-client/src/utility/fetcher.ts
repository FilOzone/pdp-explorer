import { ClientError, request } from "graphql-request";

export const fetcher = async <T>([url, query, variables]: [string, string, Record<string, unknown> | undefined]): Promise<T> => {
  try {
    return await request<T>(url, query, variables);
  } catch (error) {
    // Graph Node still reports indexing_error when subgraphError: allow returns data.
    // Accept that warning only; transport and other GraphQL failures must still surface.
    if (error instanceof ClientError) {
      const { data, errors, status } = error.response;
      if (status >= 200 && status < 300 && data != null && errors?.length && errors.every(({ message }) => message === "indexing_error")) {
        return data as T;
      }
    }
    throw error;
  }
};
