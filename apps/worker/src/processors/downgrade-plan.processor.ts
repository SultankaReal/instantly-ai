import { Job } from 'bullmq'
import { prisma } from '../lib/prisma'

type DowngradePlanJob = {
  userId: string
  newPlan: string
}

export async function downgradePlanProcessor(job: Job<DowngradePlanJob>): Promise<void> {
  const { userId, newPlan } = job.data

  await prisma.user.update({
    where: { id: userId },
    data: { plan: newPlan },
  })
}
