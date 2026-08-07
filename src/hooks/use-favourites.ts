"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiClientError } from "@/lib/api-client";

/**
 * Which dishes and products the signed-in customer has saved.
 *
 * Every heart on a page shares one query, so a menu of forty cards costs a
 * single request. Guests get a 401, which is an answer rather than a failure —
 * the hook reports them as signed out and the hearts turn into a sign-in link.
 */

export interface FavouriteTarget {
  menuItemId?: string;
  productId?: string;
}

interface FavouriteIds {
  menuItemIds: string[];
  productIds: string[];
}

const QUERY_KEY = ["account", "favourite-ids"] as const;
const EMPTY: FavouriteIds = { menuItemIds: [], productIds: [] };

export function useFavourites() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<FavouriteIds>("/api/account/favourites?view=ids"),
    retry: false,
    staleTime: 60_000,
  });

  const isSignedOut = query.error instanceof ApiClientError && query.error.status === 401;
  const ids = query.data ?? EMPTY;

  const mutation = useMutation({
    mutationFn: (target: FavouriteTarget) =>
      api.post<{ favourited: boolean }>("/api/account/favourites", target),

    // The heart flips immediately and rolls back if the server disagrees —
    // waiting on a round trip to fill in an outline reads as a broken tap.
    onMutate: async (target) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<FavouriteIds>(QUERY_KEY);
      queryClient.setQueryData<FavouriteIds>(QUERY_KEY, (current) =>
        toggleIn(current ?? EMPTY, target),
      );
      return { previous };
    },
    onError: (_error, _target, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    /** False for guests, and while we don't yet know. */
    isSignedIn: query.isSuccess,
    isSignedOut,
    isLoading: query.isLoading,
    isFavourite(target: FavouriteTarget) {
      return target.menuItemId
        ? ids.menuItemIds.includes(target.menuItemId)
        : Boolean(target.productId && ids.productIds.includes(target.productId));
    },
    toggle: mutation.mutateAsync,
  };
}

function toggleIn(ids: FavouriteIds, target: FavouriteTarget): FavouriteIds {
  if (target.menuItemId) {
    return { ...ids, menuItemIds: without(ids.menuItemIds, target.menuItemId) };
  }
  if (target.productId) {
    return { ...ids, productIds: without(ids.productIds, target.productId) };
  }
  return ids;
}

function without(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}
