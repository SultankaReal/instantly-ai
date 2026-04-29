import { Job } from 'bullmq'
import { promises as dns } from 'dns'
import { prisma } from '../lib/prisma'

type DnsCheckJob = {
  accountId: string
  domain: string
}

type DnsCheckResult = {
  valid: boolean
  record: string | null
}

async function checkSpfRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const records = await dns.resolveTxt(domain)
    const spfRecord = records
      .flat()
      .find((r) => r.startsWith('v=spf1'))
    return {
      valid: spfRecord !== undefined,
      record: spfRecord ?? null,
    }
  } catch {
    return { valid: false, record: null }
  }
}

async function checkDkimRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const dkimDomain = `default._domainkey.${domain}`
    const records = await dns.resolveTxt(dkimDomain)
    const dkimRecord = records.flat().find((r) => r.includes('v=DKIM1') || r.includes('p='))
    return {
      valid: dkimRecord !== undefined,
      record: dkimRecord ?? null,
    }
  } catch {
    return { valid: false, record: null }
  }
}

async function checkDmarcRecord(domain: string): Promise<DnsCheckResult> {
  try {
    const dmarcDomain = `_dmarc.${domain}`
    const records = await dns.resolveTxt(dmarcDomain)
    const dmarcRecord = records.flat().find((r) => r.startsWith('v=DMARC1'))
    return {
      valid: dmarcRecord !== undefined,
      record: dmarcRecord ?? null,
    }
  } catch {
    return { valid: false, record: null }
  }
}

export async function dnsCheckProcessor(job: Job<DnsCheckJob>): Promise<void> {
  const { accountId, domain } = job.data

  // Check all DNS records in parallel
  const [spfResult, dkimResult, dmarcResult] = await Promise.all([
    checkSpfRecord(domain),
    checkDkimRecord(domain),
    checkDmarcRecord(domain),
  ])

  // Update email_accounts with DNS check results
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      dnsSpf: spfResult.valid,
      dnsDkim: dkimResult.valid,
      dnsDmarc: dmarcResult.valid,
      dnsCheckedAt: new Date(),
    },
  })

  // Alert user if DMARC missing (critical for deliverability)
  if (!dmarcResult.valid) {
    await prisma.inboxAlert.create({
      data: {
        accountId,
        alertType: 'dmarc_missing',
        message:
          'Настройте DMARC запись для вашего домена чтобы улучшить доставляемость',
        resolvedAt: null,
      },
    })
  }

  // Alert if SPF missing
  if (!spfResult.valid) {
    await prisma.inboxAlert.create({
      data: {
        accountId,
        alertType: 'spf_missing',
        message: 'Настройте SPF запись для вашего домена чтобы предотвратить попадание в спам',
        resolvedAt: null,
      },
    })
  }

  // Alert if DKIM missing
  if (!dkimResult.valid) {
    await prisma.inboxAlert.create({
      data: {
        accountId,
        alertType: 'dkim_missing',
        message: 'Настройте DKIM подпись для вашего домена чтобы улучшить доставляемость',
        resolvedAt: null,
      },
    })
  }
}
