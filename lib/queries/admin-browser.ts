import { createAdminClient } from '@/lib/api/browser/secure-admin';

// Browser: get admin dashboard stats (for Client Component useQuery)
export async function getAdminStats() {
  const client = createAdminClient();
  const response = await client.getDashboardStats({});
  return {
    totalUsers: response.stats?.totalMembers ?? 0,
    totalPosts: response.stats?.totalPosts ?? 0,
    totalPages: response.stats?.totalPages ?? 0,
    totalComments: response.stats?.totalComments ?? 0,
  };
}
