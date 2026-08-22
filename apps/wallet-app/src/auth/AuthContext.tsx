import { useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

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
