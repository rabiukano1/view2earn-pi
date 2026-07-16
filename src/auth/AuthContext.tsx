import { useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

// Single source for the signed-in user. Convex Auth owns the session; this maps
// it to our app user row (api.users.me). Screens call useAuth().userId.
export function useAuth(): {
  userId: Id<'users'> | null;
  ready: boolean;
  isAuthenticated: boolean;
} {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip');
  return {
    userId: (me?._id ?? null) as Id<'users'> | null,
    ready: !isLoading,
    isAuthenticated,
  };
}
