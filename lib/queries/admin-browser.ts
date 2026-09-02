import { createAdminClient } from '@/lib/api/browser-client';

// Browser: get admin dashboard stats (for Client Component useQuery)
export async function getAdminStats() {
  try {
    const client = createAdminClient();
    const response = await client.getDashboardStats({});

    return {
      totalUsers: response.stats?.totalMembers ?? 0,
      totalPosts: response.stats?.totalPosts ?? 0,
      totalPages: response.stats?.totalPages ?? 0,
      totalComments: response.stats?.totalComments ?? 0,
    };
  } catch {
    return { totalUsers: 0, totalPosts: 0, totalPages: 0, totalComments: 0 };
  }
}
