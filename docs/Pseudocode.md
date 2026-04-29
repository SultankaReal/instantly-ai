# Pseudocode: Поток

**Дата:** 2026-04-29 | **Источник:** Specification.md + Solution_Strategy.md

---

## Содержание

1. [Data Structures](#1-data-structures)
2. [Auth Module](#2-auth-module)
3. [Email Account Module](#3-email-account-module)
4. [Warmup Engine](#4-warmup-engine)
5. [Inbox Score Calculator](#5-inbox-score-calculator)
6. [Campaign Engine](#6-campaign-engine)
7. [Unified Inbox + AI Reply Agent](#7-unified-inbox--ai-reply-agent)
8. [YooKassa Billing Module](#8-yookassa-billing-module)
9. [State Machines](#9-state-machines)
10. [Background Jobs (BullMQ)](#10-background-jobs-bullmq)

---

## 1. Data Structures

```typescript
// Core enums
type Plan = 'trial' | 'starter' | 'pro' | 'agency'
type AccountStatus = 'connected' | 'warming' | 'paused' | 'error'
type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'
type SendStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced'
type LeadStatus = 'interested' | 'not_interested' | 'callback' | 'spam'
type ReplyCategory =
  | 'interested' | 'meeting_request' | 'not_now'
  | 'not_interested' | 'unsubscribe' | 'objection'
  | 'question' | 'out_of_office' | 'spam_complaint'
type WarmupEvent = 'sent' | 'received' | 'moved_from_spam' | 'opened' | 'replied'

// Plan limits (flat config — easy to update)
const PLAN_LIMITS: Record<Plan, { accounts: number; campaigns: number }> = {
  trial:   { accounts: 1,         campaigns: 1 },
  starter: { accounts: 3,         campaigns: 5 },
  pro:     { accounts: Infinity,  campaigns: Infinity },
  agency:  { accounts: Infinity,  campaigns: Infinity },
}

// Warmup ramp-up schedule
const WARMUP_RAMP: Array<{ maxDay: number; min: number; max: number }> = [
  { maxDay: 7,  min: 5,   max: 10  },
  { maxDay: 14, min: 20,  max: 40  },
  { maxDay: 21, min: 40,  max: 100 },
  { maxDay: 999,min: 100, max: 200 },
]

// Job type definitions
type WarmupSendJob = {
  accountId: string
  partnerId: string
  partnerEmail: string
}

type EmailSendJob = {
  sendId: string
  campaignId: string
  stepId: string
  contactId: string
  accountId: string
  toEmail: string
  subject: string   // with variables substituted
  bodyHtml: string  // with variables substituted, DOMPurified
}

type InboxScanJob = {
  accountId: string
  since: Date
}

type AIReplyJob = {
  messageId: string
  userId: string
  mode: 'autopilot' | 'draft' | 'manual'
  confidenceThreshold: number
}
```

---

## 2. Auth Module

```typescript
// POST /api/auth/register
async function register(email: string, password: string, fullName?: string): Promise<AuthResult> {
  // 1. Validate inputs
  validate({ email: emailSchema, password: passwordSchema(minLength: 8) })

  // 2. Check uniqueness
  if await db.users.exists({ email }) → throw ConflictError('email_taken')

  // 3. Hash password (bcrypt cost 12 — never lower)
  passwordHash = await bcrypt.hash(password, 12)

  // 4. Create user + start trial
  user = await db.users.create({
    email, passwordHash, fullName,
    plan: 'trial',
    trialEndsAt: now() + 7 days
  })

  // 5. Issue tokens
  return issueTokenPair(user.id)
}

// POST /api/auth/login
async function login(email: string, password: string): Promise<AuthResult> {
  user = await db.users.findByEmail(email)

  // IMPORTANT: always compare even if user not found (constant-time)
  isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)

  // Same error for wrong email AND wrong password (prevent enumeration)
  if !user || !isValid → throw UnauthorizedError('invalid_credentials')

  // Check trial expiry → downgrade to free if expired
  if user.plan === 'trial' && user.trialEndsAt < now() {
    await db.users.update(user.id, { plan: 'free' })  // downgrade: no active campaigns, read-only
    user.plan = 'free'
  }

  return issueTokenPair(user.id)
}

// POST /api/auth/refresh
async function refreshToken(token: string): Promise<{ accessToken: string }> {
  payload = jwt.verify(token, JWT_REFRESH_SECRET)  // throws on invalid/expired
  if payload.type !== 'refresh' → throw UnauthorizedError()

  // Verify token is not blacklisted (still in Redis)
  exists = await redis.get(`refresh:${payload.sub}:${token}`)
  if !exists → throw UnauthorizedError('token_revoked')

  // Issue new access token only (refresh token stays valid until expiry)
  accessToken = jwt.sign({ sub: payload.sub, type: 'access' }, JWT_SECRET, { expiresIn: '15m' })
  return { accessToken }
}

// Token issuance
function issueTokenPair(userId: string): AuthResult {
  accessToken  = jwt.sign({ sub: userId, type: 'access' },  JWT_SECRET, { expiresIn: '15m' })
  refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' })

  // Store refresh token in Redis (for blacklist on logout)
  await redis.set(`refresh:${userId}:${refreshToken}`, '1', { ex: 7 * 24 * 3600 })

  return { accessToken, refreshToken }
}

// POST /api/auth/logout
async function logout(refreshToken: string, userId: string): Promise<void> {
  // Blacklist the specific refresh token
  await redis.del(`refresh:${userId}:${refreshToken}`)
  // Note: access tokens expire naturally after 15 min
}

// Middleware: authenticate
async function authenticate(req): Promise<User> {
  token = extractBearerToken(req.headers.authorization)
  if !token → throw UnauthorizedError()

  payload = jwt.verify(token, JWT_SECRET)  // throws on invalid/expired
  if payload.type !== 'access' → throw UnauthorizedError()

  user = await db.users.findById(payload.sub)
  if !user → throw UnauthorizedError()

  return user
}

// POST /api/auth/forgot-password
async function forgotPassword(email: string): Promise<void> {
  // Always return 200 — do not reveal whether email exists
  user = await db.users.findByEmail(email.toLowerCase().trim())
  if !user → return  // silent: no email sent, no error

  // Rate limit: max 3 reset requests per hour per email
  recentCount = await redis.incr(`reset_rate:${email}`)
  if recentCount === 1 → await redis.expire(`reset_rate:${email}`, 3600)
  if recentCount > 3 → return  // silent rate limit

  token = crypto.randomBytes(32).toString('hex')
  await redis.set(`reset:${token}`, user.id, { ex: 3600 })  // TTL 1h
  await sendEmail(user.email, 'password_reset', { resetLink: `${APP_URL}/reset-password?token=${token}` })
}

// POST /api/auth/reset-password
async function resetPassword(token: string, newPassword: string): Promise<void> {
  userId = await redis.get(`reset:${token}`)
  if !userId → throw BadRequestError('token_expired_or_used')

  if newPassword.length < 8 → throw BadRequestError('password_too_short')

  hash = await bcrypt.hash(newPassword, 12)
  await db.users.update(userId, { passwordHash: hash })
  await redis.del(`reset:${token}`)  // single-use
}
```

---

## 3. Email Account Module

```typescript
// POST /api/accounts
async function connectEmailAccount(userId: string, input: AccountInput): Promise<EmailAccount> {
  user = await db.users.findById(userId)

  // 1. Enforce plan limits
  currentCount = await db.emailAccounts.count({ userId, status: not 'error' })
  limit = PLAN_LIMITS[user.plan].accounts
  if currentCount >= limit → throw ForbiddenError('plan_limit_exceeded', { limit, current: currentCount })

  // 2. Verify SMTP connectivity
  smtpOk = await testSmtp({
    host: input.smtpHost, port: input.smtpPort,
    auth: { user: input.email, pass: input.password }
  })
  if !smtpOk → throw BadRequestError('smtp_connection_failed')

  // 3. Verify IMAP connectivity
  imapOk = await testImap({
    host: input.imapHost, port: input.imapPort,
    auth: { user: input.email, pass: input.password }
  })
  if !imapOk → throw BadRequestError('imap_connection_failed')

  // 4. Encrypt credentials (AES-256-GCM)
  credentialsEnc = await encryptAES256GCM(
    JSON.stringify({ email: input.email, password: input.password }),
    ENCRYPTION_KEY
  )

  // 5. Save account
  account = await db.emailAccounts.create({
    userId,
    email: input.email,
    smtpHost: input.smtpHost, smtpPort: input.smtpPort,
    imapHost: input.imapHost, imapPort: input.imapPort,
    credentialsEnc,
    status: 'connected',
    inboxScore: 0,
    dailyLimit: 50,
    inWarmupPool: false,
  })

  // 6. Async: check DNS records
  await bullmq.dnsCheckQueue.add('check-dns', { accountId: account.id, domain: extractDomain(input.email) })

  return account
}

// POST /api/accounts/:id/warmup/start
async function startWarmup(userId: string, accountId: string): Promise<EmailAccount> {
  account = await db.emailAccounts.findOne({ id: accountId, userId })
  if !account → throw NotFoundError()
  if account.status === 'warming' → return account  // idempotent

  // Add to warmup pool
  account = await db.emailAccounts.update(accountId, {
    status: 'warming',
    inWarmupPool: true,
    warmupStartedAt: now(),
  })

  // Schedule first warmup batch
  await scheduleWarmupJobs(accountId)

  return account
}

// DNS checker async job result
async function processDnsCheck(accountId: string, domain: string): Promise<void> {
  results = await Promise.all([
    checkSpfRecord(domain),
    checkDkimRecord(domain),
    checkDmarcRecord(domain),
  ])

  await db.emailAccounts.update(accountId, {
    dnsSpf: results[0].valid,
    dnsDkim: results[1].valid,
    dnsDmarc: results[2].valid,
    dnsCheckedAt: now(),
  })

  // Alert user if DMARC missing (critical for deliverability)
  if !results[2].valid {
    await createInboxAlert(accountId, 'dmarc_missing',
      'Настройте DMARC запись для вашего домена чтобы улучшить доставляемость')
  }
}
```

---

## 4. Warmup Engine

```typescript
// Warmup Scheduler (cron: every hour, 08:00–22:00 MSK)
async function scheduleWarmupJobs(): Promise<void> {
  // Get all accounts in warmup
  warmingAccounts = await db.emailAccounts.findAll({
    inWarmupPool: true,
    status: 'warming',
  })

  poolAccounts = await db.emailAccounts.findAll({ inWarmupPool: true })

  for account of warmingAccounts {
    daysInWarmup = daysSince(account.warmupStartedAt)
    dailyVolume  = getDailyVolume(daysInWarmup)

    // Spread evenly across remaining hours of day (08:00–22:00 = 14h window)
    remainingHours = hoursUntil(22, timezone: 'Europe/Moscow')
    jobsThisHour   = Math.ceil(dailyVolume / 14)

    for i in range(jobsThisHour) {
      partner = pickRandomPartner(poolAccounts, exclude: account.id)
      if !partner → continue  // pool too small, skip

      delay = randomMs(30_000, 5 * 60_000)  // 30s–5min human-like spread

      await bullmq.warmupQueue.add('warmup-send', {
        accountId: account.id,
        partnerId: partner.id,
        partnerEmail: partner.email,
      }, {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 }
      })
    }
  }
}

// Calculate daily volume based on days in warmup
function getDailyVolume(daysInWarmup: number): number {
  for ramp of WARMUP_RAMP {
    if daysInWarmup <= ramp.maxDay {
      // Random within range for natural variance
      return Math.floor(Math.random() * (ramp.max - ramp.min + 1)) + ramp.min
    }
  }
  return 200  // maintenance mode
}

// Warmup Send Worker (processes WarmupSendJob)
async function processWarmupSend(job: WarmupSendJob): Promise<void> {
  // 1. Load accounts + decrypt credentials
  senderAccount  = await db.emailAccounts.findById(job.accountId)
  partnerAccount = await db.emailAccounts.findById(job.partnerId)
  senderCreds    = await decryptAES256GCM(senderAccount.credentialsEnc, ENCRYPTION_KEY)
  partnerCreds   = await decryptAES256GCM(partnerAccount.credentialsEnc, ENCRYPTION_KEY)

  // 2. Send warmup email (sender → partner)
  subject  = pickRandom(WARMUP_SUBJECTS)    // pool of 20+ templates
  bodyText = generateWarmupBody()           // 3-4 natural sentences, unique per send
  messageId = await sendSmtp({
    from:    senderCreds.email,
    to:      partnerCreds.email,
    subject, bodyText,
    smtp: { host: senderAccount.smtpHost, port: senderAccount.smtpPort, ...senderCreds }
  })

  // 3. Record sent event
  await db.warmupEvents.create({
    accountId: job.accountId,
    eventType: 'sent',
    partnerAccount: partnerCreds.email,
  })

  // 4. Wait 30s–5min (human-like delay before IMAP check)
  await sleep(randomMs(30_000, 5 * 60_000))

  // 5. IMAP: check if email landed in partner's inbox or spam
  imapClient = await connectImap(partnerCreds, {
    host: partnerAccount.imapHost, port: partnerAccount.imapPort
  })

  // Search in INBOX
  inboxMessages = await imapClient.search({ from: senderCreds.email, since: now() - 10min })
  inboxLanded   = inboxMessages.some(m => m.messageId === messageId)

  if inboxLanded {
    // Mark as read (signals engagement to ESP)
    await imapClient.markRead(inboxMessages[0].uid)
    await db.warmupEvents.create({ accountId: job.accountId, eventType: 'received', partnerAccount: partnerCreds.email })

    // 15% chance: generate a reply (increases engagement signals)
    if Math.random() < 0.15 {
      replyBody = generateWarmupReply(bodyText)
      await sendSmtp({ from: partnerCreds.email, to: senderCreds.email, ... })
      await db.warmupEvents.create({ accountId: job.accountId, eventType: 'replied' })
    }
  } else {
    // Search in SPAM
    spamMessages = await imapClient.search({ folder: 'Spam', from: senderCreds.email, since: now() - 10min })
    if spamMessages.length > 0 {
      // Move from Spam to Inbox (critical: ESP sees this as "not spam")
      await imapClient.move(spamMessages[0].uid, 'INBOX')
      await db.warmupEvents.create({ accountId: job.accountId, eventType: 'moved_from_spam' })
    }
  }

  await imapClient.logout()
}
```

---

## 5. Inbox Score Calculator

```typescript
// Cron: every hour
async function recalculateAllInboxScores(): Promise<void> {
  accounts = await db.emailAccounts.findAll({ status: 'warming' })
  await Promise.all(accounts.map(a => recalculateInboxScore(a.id)))
}

async function recalculateInboxScore(accountId: string): Promise<number> {
  // Fetch events for each time window
  events7d  = await db.warmupEvents.findAll({ accountId, since: now() - 7 days })
  events14d = await db.warmupEvents.findAll({ accountId, since: now() - 14 days })
  events30d = await db.warmupEvents.findAll({ accountId, since: now() - 30 days })

  score7d  = calculateInboxRate(events7d)
  score14d = calculateInboxRate(events14d)
  score30d = calculateInboxRate(events30d)

  // Weighted average: recent data matters most
  weightedScore = Math.round(
    score7d  * 0.50 +
    score14d * 0.30 +
    score30d * 0.20
  )

  // Clamp to 0–100
  finalScore = Math.max(0, Math.min(100, weightedScore))

  // Persist
  await db.emailAccounts.update(accountId, { inboxScore: finalScore })
  await db.inboxScoreSnapshots.create({
    accountId,
    score: finalScore,
    provider: 'combined',
    snapshottedAt: now(),
  })

  // Alert if score dropped significantly
  previousScore = await db.inboxScoreSnapshots
    .findLatest({ accountId, before: now() - 24h })?.score ?? finalScore

  if finalScore < 70 && previousScore - finalScore >= 10 {
    await createInboxAlert(accountId, 'score_drop',
      `Inbox Score упал с ${previousScore}% до ${finalScore}%`)
  }

  return finalScore
}

function calculateInboxRate(events: WarmupEvent[]): number {
  sent     = events.filter(e => e.eventType === 'sent').length
  received = events.filter(e => e.eventType === 'received' || e.eventType === 'moved_from_spam').length

  if sent === 0 → return 0
  // moved_from_spam counts as partial success (weight 0.5)
  movedFromSpam = events.filter(e => e.eventType === 'moved_from_spam').length
  inboxDirect   = events.filter(e => e.eventType === 'received').length

  weightedReceived = inboxDirect + (movedFromSpam * 0.5)
  return Math.round((weightedReceived / sent) * 100)
}
```

---

## 6. Campaign Engine

```typescript
// Campaign Scheduler (cron: every minute)
async function scheduleCampaignSends(): Promise<void> {
  now = currentTime()

  // Find campaigns that should be running
  runningCampaigns = await db.campaigns.findAll({ status: 'running' })

  for campaign of runningCampaigns {
    // Check schedule window
    if !isInScheduleWindow(campaign, now) → continue

    // Check daily send limit
    sentToday = await db.emailSends.count({
      campaignId: campaign.id,
      sentAt: { gte: startOfDay() }
    })
    if sentToday >= campaign.dailyLimit → continue

    // Also enforce account-level daily limit
    accountSentToday = await db.emailSends.count({
      accountId: campaign.fromAccountId,
      sentAt: { gte: startOfDay() }
    })
    account = await db.emailAccounts.findById(campaign.fromAccountId)
    if accountSentToday >= account.dailyLimit → continue

    // Find contacts ready for next step
    pendingSends = await getPendingSends(campaign, now)

    for send of pendingSends {
      // Substitute template variables
      contact = await db.contacts.findById(send.contactId)
      step    = await db.campaignSteps.findById(send.stepId)

      subject  = substituteVariables(step.subject,  contact)
      bodyHtml = substituteVariables(step.bodyHtml, contact)

      // Validate no empty variables remain
      if hasUnsubstitutedVariables(subject) || hasUnsubstitutedVariables(bodyHtml) {
        await markSendError(send.id, 'missing_variables')
        continue
      }

      // Append unsubscribe link (38-ФЗ compliance — always)
      bodyHtml = appendUnsubscribeLink(bodyHtml, {
        contactEmail: contact.email,
        campaignId: campaign.id,
        token: generateUnsubscribeToken(contact.email),
      })

      // Enqueue send job
      await bullmq.emailSendQueue.add('send-email', {
        sendId: send.id,
        campaignId: campaign.id,
        stepId: send.stepId,
        contactId: contact.id,
        accountId: campaign.fromAccountId,
        toEmail: contact.email,
        subject,
        bodyHtml,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 }
      })

      await db.emailSends.update(send.id, { status: 'queued' })
    }
  }
}

// Get contacts ready for next sequence step
async function getPendingSends(campaign: Campaign, now: Date): Promise<PendingSend[]> {
  result = []

  // Get all steps for this campaign
  steps = await db.campaignSteps.findAll({ campaignId: campaign.id, orderBy: 'step_number' })

  for step of steps {
    // Contacts who haven't received this step yet AND whose previous step delay has passed
    eligible = await db.contacts.findAll({
      where: {
        userId: campaign.userId,
        status: 'active',
        // Not already sent this step
        NOT: { emailSends: { some: { stepId: step.id } } },
        // Not unsubscribed globally
        NOT: { email: { in: db.unsubscribes.findAll().map(u => u.email) } },
        // Previous step sent (or first step)
        emailSends: step.stepNumber === 1
          ? undefined  // no prerequisite
          : {
              some: {
                stepId: steps[step.stepNumber - 2].id,
                status: 'sent',
                // Delay has passed
                sentAt: { lte: now - step.delayDays * 24 * 3600_000 },
                // No reply received (stop sequence on reply)
                repliedAt: null,
              }
            }
      }
    })

    for contact of eligible {
      send = await db.emailSends.findOrCreate({
        campaignId: campaign.id,
        stepId: step.id,
        contactId: contact.id,
        accountId: campaign.fromAccountId,
        status: 'queued',
      })
      result.push({ ...send, contact, step })
    }
  }

  return result.slice(0, campaign.dailyLimit)  // respect daily limit
}

// Email Send Worker
async function processEmailSend(job: EmailSendJob): Promise<void> {
  account = await db.emailAccounts.findById(job.accountId)
  creds   = await decryptAES256GCM(account.credentialsEnc, ENCRYPTION_KEY)

  // Check contact is still active (may have unsubscribed between queue and process)
  contact = await db.contacts.findById(job.contactId)
  if contact.status !== 'active' {
    await db.emailSends.update(job.sendId, { status: 'skipped' })
    return
  }

  isUnsubscribed = await db.unsubscribes.exists({ email: contact.email })
  if isUnsubscribed {
    await db.emailSends.update(job.sendId, { status: 'skipped' })
    return
  }

  // Send via SMTP
  try {
    messageId = await sendSmtp({
      from:     creds.email,
      to:       job.toEmail,
      subject:  job.subject,
      html:     job.bodyHtml,
      smtp: { host: account.smtpHost, port: account.smtpPort, auth: creds },
      // Tracking pixel for open tracking
      headers: { 'X-Campaign-Id': job.campaignId, 'X-Send-Id': job.sendId }
    })

    await db.emailSends.update(job.sendId, {
      status: 'sent',
      messageId,
      sentAt: now(),
    })
  } catch (smtpError) {
    // If permanent failure (5xx) → mark bounced
    if smtpError.code >= 500 {
      await db.emailSends.update(job.sendId, { status: 'bounced', bouncedAt: now() })
      await db.contacts.update(job.contactId, { status: 'bounced' })
      await db.unsubscribes.upsert({ email: job.toEmail, reason: 'bounce' })
    }
    throw smtpError  // retry on 4xx
  }
}

// Schedule validation helper
function isInScheduleWindow(campaign: Campaign, now: Date): boolean {
  dayName  = getDayName(now, campaign.timezone)  // 'mon', 'tue', etc.
  timeNow  = getLocalTime(now, campaign.timezone) // 'HH:MM'

  return (
    campaign.scheduleDays.includes(dayName) &&
    timeNow >= campaign.scheduleStart &&
    timeNow <= campaign.scheduleEnd
  )
}

// Variable substitution (safe — no eval)
function substituteVariables(template: string, contact: Contact): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if key === 'name'     → return contact.firstName ?? match
    if key === 'company'  → return contact.company ?? match
    if key === 'position' → return contact.position ?? match
    // Custom variables
    return contact.customVars[key] ?? match
  })
}

function hasUnsubstitutedVariables(text: string): boolean {
  return /\{\{\w+\}\}/.test(text)
}
```

---

## 7. Unified Inbox + AI Reply Agent

```typescript
// Inbox Scan Worker (cron: every 5 min)
async function scanInboxForReplies(job: InboxScanJob): Promise<void> {
  account = await db.emailAccounts.findById(job.accountId)
  creds   = await decryptAES256GCM(account.credentialsEnc, ENCRYPTION_KEY)

  imapClient = await connectImap(creds, { host: account.imapHost, port: account.imapPort })

  // Fetch new messages since last scan
  newMessages = await imapClient.search({
    since: job.since ?? account.lastScannedAt ?? now() - 1h,
    NOT: { flagged: 'warmup' },  // skip warmup emails
  })

  for msg of newMessages {
    // Skip if already processed
    if await db.inboxMessages.exists({ accountId: job.accountId, messageId: msg.messageId }) → continue

    // Try to link to a campaign send
    relatedSend = await db.emailSends.findOne({
      messageId: msg.inReplyTo ?? undefined,  // threading
      accountId: job.accountId,
    })

    // Save to unified inbox
    inboxMessage = await db.inboxMessages.create({
      userId:     account.userId,
      accountId:  job.accountId,
      sendId:     relatedSend?.id,
      fromEmail:  msg.from.email,
      fromName:   msg.from.name,
      subject:    msg.subject,
      bodyText:   msg.bodyText,
      bodyHtml:   msg.bodyHtml,  // RAW — sanitize only at render time (iframe)
      receivedAt: msg.date,
    })

    // Update send status if linked
    if relatedSend {
      await db.emailSends.update(relatedSend.id, { status: 'replied', repliedAt: now() })
    }

    // Trigger AI Reply Agent (async)
    user = await db.users.findById(account.userId)
    if user.plan in ['pro', 'agency'] && user.aiReplyEnabled {
      await bullmq.aiReplyQueue.add('ai-reply', {
        messageId: inboxMessage.id,
        userId: account.userId,
        mode: user.aiReplyMode,
        confidenceThreshold: user.aiConfidenceThreshold ?? 85,
      })
    }
  }

  await db.emailAccounts.update(job.accountId, { lastScannedAt: now() })
  await imapClient.logout()
}

// AI Reply Agent Worker
async function processAIReply(job: AIReplyJob): Promise<void> {
  message = await db.inboxMessages.findById(job.messageId)
  account = await db.emailAccounts.findById(message.accountId)

  // Build conversation context
  thread = await buildThreadContext(message)
  campaignContext = message.sendId
    ? await getCampaignContext(message.sendId)
    : null

  // Step 1: Classify reply intent
  classification = await classifyReply(message.bodyText, thread, campaignContext)
  // classification = { category: ReplyCategory, confidence: 0–100, reasoning: string }

  // Step 2: Determine action based on mode and category
  action = determineAction(classification, job.mode, job.confidenceThreshold)

  // Step 3: Execute action
  if action === 'stop_sequence' {
    // Always stop sequence for these categories
    if message.sendId {
      campaignId = (await db.emailSends.findById(message.sendId)).campaignId
      await db.emailSends.updateMany(
        { campaignId, contactId: message.fromEmail, status: 'queued' },
        { status: 'cancelled' }
      )
    }
    if classification.category === 'unsubscribe' {
      await db.contacts.updateByEmail(message.fromEmail, account.userId, { status: 'unsubscribed' })
      await db.unsubscribes.upsert({ email: message.fromEmail, reason: 'manual' })
    }
    await db.inboxMessages.update(job.messageId, {
      leadStatus: classification.category === 'unsubscribe' ? 'spam' : 'not_interested',
      aiCategory: classification.category,
    })
    return
  }

  if action === 'postpone' {
    // Out of office: delay next follow-up by 3 days
    await postponeSequenceFor(message, days: 3)
    await db.inboxMessages.update(job.messageId, { aiCategory: 'out_of_office' })
    return
  }

  // Generate AI draft (for 'draft' or 'autopilot' actions)
  draft = await generateAIReply(message, thread, campaignContext)

  await db.inboxMessages.update(job.messageId, {
    aiDraft: draft,
    aiCategory: classification.category,
    aiConfidence: classification.confidence,
    leadStatus: mapCategoryToLeadStatus(classification.category),
  })

  if action === 'autopilot' {
    // Send immediately without user review
    await sendReply(message, account, draft)
    await db.inboxMessages.update(job.messageId, { aiSentAt: now() })
  }
  // action === 'draft': user sees draft in unified inbox → edits → sends manually
}

// Classification via Claude API
async function classifyReply(
  bodyText: string,
  thread: ThreadMessage[],
  campaignContext: CampaignContext | null
): Promise<Classification> {
  response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: `Классифицируй ответ на холодное письмо. Верни JSON:
      { "category": "<one of: interested|meeting_request|not_now|not_interested|unsubscribe|objection|question|out_of_office|spam_complaint>",
        "confidence": <0-100>,
        "reasoning": "<1 sentence>" }`,
    messages: [
      { role: 'user', content: `Ответ на письмо: "${bodyText.slice(0, 500)}"` }
    ]
  })

  return JSON.parse(response.content[0].text)
}

// Determine what action to take
function determineAction(
  cl: Classification,
  mode: 'autopilot' | 'draft' | 'manual',
  threshold: number
): 'autopilot' | 'draft' | 'stop_sequence' | 'postpone' | 'notify' {
  // Always stop sequence — regardless of mode
  if cl.category in ['unsubscribe', 'spam_complaint', 'not_interested'] {
    return 'stop_sequence'
  }
  // Always postpone out of office
  if cl.category === 'out_of_office' {
    return 'postpone'
  }
  // Manual mode: just notify, create no draft
  if mode === 'manual' {
    return 'notify'
  }
  // Autopilot: auto-send if confidence is high enough and category is safe
  if mode === 'autopilot'
    && cl.confidence >= threshold
    && cl.category in ['interested', 'meeting_request', 'question'] {
    return 'autopilot'
  }
  // Default: create draft for review
  return 'draft'
}

// Generate reply via Claude API
async function generateAIReply(
  message: InboxMessage,
  thread: ThreadMessage[],
  ctx: CampaignContext | null
): Promise<string> {
  threadContext = thread
    .slice(-4)  // last 4 messages for context
    .map(m => `${m.fromEmail}: ${m.bodyText.slice(0, 300)}`)
    .join('\n\n')

  response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `Ты профессиональный менеджер по продажам. Пишешь деловые письма на русском языке.
      Краткость важнее объёма. Не используй обращения "Уважаемый", "С уважением".
      Пиши как живой человек, не как корпоративный шаблон.
      ${ctx ? `Контекст продукта: ${ctx.productDescription}` : ''}`,
    messages: [
      {
        role: 'user',
        content: `История переписки:\n${threadContext}\n\nПоследний ответ:\n${message.bodyText}\n\nНапиши ответ:`
      }
    ]
  })

  return response.content[0].text
}

// GET /unsubscribe?token=xxx (no auth required — 38-ФЗ)
async function handleUnsubscribe(token: string): Promise<void> {
  // Verify token (HMAC-signed email)
  email = verifyUnsubscribeToken(token)  // throws if invalid/expired

  await db.contacts.updateByEmail(email, { status: 'unsubscribed' })
  await db.unsubscribes.upsert({ email, reason: 'link' })
  // Returns: redirect to /unsubscribed confirmation page
}
```

---

## 8. YooKassa Billing Module

```typescript
// POST /api/billing/checkout
async function createCheckout(
  userId: string,
  plan: 'starter' | 'pro' | 'agency',
  period: 'monthly' | 'annual'
): Promise<{ paymentUrl: string; paymentId: string }> {
  user = await db.users.findById(userId)

  amount = getPlanAmount(plan, period)  // in kopecks

  // Create YooKassa payment
  payment = await yooKassa.createPayment({
    amount: { value: (amount / 100).toFixed(2), currency: 'RUB' },
    payment_method_type: 'bank_card',
    confirmation: {
      type: 'redirect',
      return_url: `${APP_URL}/billing/success?plan=${plan}&period=${period}`
    },
    save_payment_method: true,  // for recurring
    description: `Поток ${capitalize(plan)} — ${user.email}`,
    metadata: { userId, plan, period },
    idempotence_key: `checkout-${userId}-${Date.now()}`,
  })

  return {
    paymentUrl: payment.confirmation.confirmation_url,
    paymentId: payment.id,
  }
}

// POST /api/billing/webhook (YooKassa webhook — critical path)
async function handleYooKassaWebhook(rawBody: Buffer, signature: string): Promise<void> {
  // 1. Verify signature (SHA-256 HMAC) — ALWAYS verify, never skip
  isValid = verifyYooKassaSignature(rawBody, signature, YOOKASSA_WEBHOOK_SECRET)
  if !isValid → throw UnauthorizedError('invalid_signature')

  event = JSON.parse(rawBody.toString())

  // 2. Idempotency: skip if already processed
  if await db.paymentEvents.exists({ yookassaEventId: event.object.id }) {
    return  // already handled, return 200 OK
  }

  // 3. Record event for audit trail
  await db.paymentEvents.create({
    userId: event.object.metadata.userId,
    eventType: event.event,
    yookassaEventId: event.object.id,
    amount: parseFloat(event.object.amount.value) * 100,
    payload: event,
  })

  // 4. Process by event type
  switch event.event {
    case 'payment.succeeded':
      await handlePaymentSucceeded(event.object)
      break

    case 'payment.canceled':
      await handlePaymentCanceled(event.object)
      break

    case 'refund.succeeded':
      await handleRefundSucceeded(event.object)
      break
  }
}

async function handlePaymentSucceeded(payment: YooKassaPayment): Promise<void> {
  { userId, plan, period } = payment.metadata

  // Calculate billing period
  now      = currentDate()
  periodEnd = period === 'annual'
    ? addMonths(now, 12)
    : addMonths(now, 1)

  // Upsert subscription
  await db.subscriptions.upsert(
    { userId },
    {
      plan,
      status: 'active',
      yookassaPaymentId: payment.id,
      yookassaPaymentMethodId: payment.payment_method?.id,
      amount: parseFloat(payment.amount.value) * 100,
      billingPeriod: period,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelledAt: null,
    }
  )

  // Activate plan on user
  await db.users.update(userId, { plan, trialEndsAt: null })
}

// Recurring billing (cron: daily at 09:00 MSK)
async function processRecurringBilling(): Promise<void> {
  // Find subscriptions due for renewal
  dueSubscriptions = await db.subscriptions.findAll({
    status: 'active',
    currentPeriodEnd: { lte: now() + 24h },
    yookassaPaymentMethodId: { not: null },
  })

  for sub of dueSubscriptions {
    try {
      // Charge saved payment method
      payment = await yooKassa.createPayment({
        amount: { value: (sub.amount / 100).toFixed(2), currency: 'RUB' },
        payment_method_id: sub.yookassaPaymentMethodId,
        capture: true,
        description: `Поток ${sub.plan} — renewal`,
        metadata: { userId: sub.userId, plan: sub.plan, period: sub.billingPeriod },
        idempotence_key: `renewal-${sub.id}-${formatDate(now())}`,
      })

      // If payment created → webhook will activate it
      // Just mark as pending renewal
      await db.subscriptions.update(sub.id, { renewalAttemptAt: now() })

    } catch (err) {
      // Always persist attempt count BEFORE branching
      newAttempts = (sub.renewalAttempts ?? 0) + 1
      if newAttempts >= 3 {
        // 3 failures → mark past_due and downgrade user plan
        await db.subscriptions.update(sub.id, {
          status: 'past_due',
          renewalAttempts: newAttempts,
          renewalAttemptAt: now(),
        })
        await db.users.update(sub.userId, { plan: 'free' })
        await sendEmail(sub.userId, 'billing_failed')
      } else {
        await db.subscriptions.update(sub.id, {
          renewalAttempts: newAttempts,
          renewalAttemptAt: now(),
        })
      }
    }
  }
}

// POST /api/billing/cancel
async function cancelSubscription(userId: string): Promise<{ accessUntil: string }> {
  sub = await db.subscriptions.findOne({ userId, status: 'active' })
  if !sub → throw NotFoundError('no_active_subscription')

  await db.subscriptions.update(sub.id, {
    status: 'cancelled',
    cancelledAt: now(),
  })

  // Access continues until end of paid period
  // Schedule a job to downgrade user.plan at currentPeriodEnd
  await downgradePlanQueue.add({ userId, newPlan: 'free' }, { delay: sub.currentPeriodEnd - now() })

  return { accessUntil: sub.currentPeriodEnd.toISOString() }
}

function getPlanAmount(plan: string, period: string): number {
  const PRICES: Record<string, Record<string, number>> = {
    starter: { monthly: 199000, annual: 159000 },  // kopecks
    pro:     { monthly: 499000, annual: 399000 },
    agency:  { monthly: 999000, annual: 799000 },
  }
  return PRICES[plan][period]
}
```

---

## 9. State Machines

### Email Account State Machine

```
                  ┌─────────┐
                  │connected│◄─────────────────────┐
                  └────┬────┘                       │
                       │ startWarmup()              │ error resolved
                       ▼                            │
                  ┌─────────┐    error (SMTP/IMAP)  │
                  │ warming │──────────────────────►│error│
                  └────┬────┘                       └─────┘
                       │ stopWarmup()
                       ▼
                  ┌─────────┐
                  │ paused  │
                  └────┬────┘
                       │ startWarmup()
                       └──────────────────────────────────►│warming│
```

### Campaign State Machine

```
draft ──► running ──► paused ──► running
  │          │                      │
  │          └──────────────────────┘
  │          │
  │          └──► completed  (all contacts sent all steps)
  │
  └──► deleted
```

### Email Send State Machine

```
queued ──► [worker picks up]
              │
              ├──► sent ──► opened (pixel tracked)
              │       │
              │       └──► replied (IMAP detected)
              │
              ├──► bounced (permanent 5xx)
              │
              └──► skipped (contact unsubscribed)
```

### Subscription State Machine

```
none ──► trial ──────────────────────────────► [trial expired → limited trial]
              │
              └──► active ──► cancelled (access until period_end)
                      │
                      └──► past_due ──► trial (after 3 failed renewals)
                                 │
                                 └──► active (on successful renewal)
```

---

## 10. Background Jobs (BullMQ)

```typescript
// Queue definitions and worker registration

const QUEUES = {
  warmup:    new Queue('warmup',    { connection: redis }),
  emailSend: new Queue('email-send',{ connection: redis }),
  inboxScan: new Queue('inbox-scan',{ connection: redis }),
  aiReply:   new Queue('ai-reply',  { connection: redis }),
  dnsCheck:  new Queue('dns-check', { connection: redis }),
  billing:   new Queue('billing',   { connection: redis }),
}

// Workers
new Worker('warmup',     processWarmupSend,       { concurrency: 10, connection: redis })
new Worker('email-send', processEmailSend,         { concurrency: 20, connection: redis })
new Worker('inbox-scan', scanInboxForReplies,      { concurrency: 5,  connection: redis })
new Worker('ai-reply',   processAIReply,           { concurrency: 5,  connection: redis })
new Worker('dns-check',  processDnsCheck,          { concurrency: 10, connection: redis })
new Worker('billing',    processRecurringBilling,  { concurrency: 1,  connection: redis })

// Recurring schedules (BullMQ's built-in cron)
QUEUES.warmup.add('schedule', {}, {
  repeat: { pattern: '0 8-22 * * *' },  // every hour, 08:00–22:00 MSK
  jobId: 'warmup-scheduler',
})
QUEUES.inboxScan.add('scan-all', {}, {
  repeat: { pattern: '*/5 * * * *' },   // every 5 min
  jobId: 'inbox-scan-all',
})
QUEUES.billing.add('process-renewals', {}, {
  repeat: { pattern: '0 9 * * *' },     // daily at 09:00 MSK
  jobId: 'billing-renewals',
})

// Retry configuration (all queues)
const RETRY_CONFIG = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },  // 1min, 2min, 4min
}

// Observability
new QueueEvents('warmup').on('failed', ({ jobId, failedReason }) => {
  logger.error('Warmup job failed', { jobId, failedReason })
  metrics.increment('warmup.job.failed')
})
```

---

## Key Invariants

```
SECURITY:
  ✓ Email credentials NEVER stored in plaintext — always AES-256-GCM
  ✓ All API responses filter by userId — no cross-tenant data leak
  ✓ Unsubscribe token is HMAC-signed — cannot be forged
  ✓ YooKassa webhook signature verified BEFORE any DB write
  ✓ AI-generated HTML is NOT stored — only bodyText draft (user reviews)
  ✓ Incoming email bodyHtml rendered in <iframe sandbox> — not injected raw

IDEMPOTENCY:
  ✓ Warmup send: skip if messageId already in warmup_events
  ✓ Billing webhook: skip if yookassaEventId already in payment_events
  ✓ Campaign send: skip if contact already has active send for this step
  ✓ Unsubscribe: db.unsubscribes.upsert (never duplicate)

RATE LIMITS:
  ✓ warmup: ≤200 emails/day per account, ≥30s between sends
  ✓ campaigns: ≤200 emails/day per account (shared with warmup)
  ✓ AI Reply: max 500 Claude API calls/day (configurable)
  ✓ inbox scan: max 5 concurrent IMAP connections

38-ФЗ COMPLIANCE:
  ✓ Every campaign email includes unsubscribe link (appended server-side)
  ✓ Unsubscribe link works without authentication (GET with token)
  ✓ Global unsubscribe list checked BEFORE every email send
  ✓ Stopped sequences cannot re-activate for unsubscribed contacts
```
