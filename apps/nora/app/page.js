import { HomeDashboard } from '@/components/HomeDashboard'
import { getHomeDashboardData } from '@/lib/home/dashboard'

export default async function HomePage() {
  const data = await getHomeDashboardData()

  return <HomeDashboard data={data} />
}
