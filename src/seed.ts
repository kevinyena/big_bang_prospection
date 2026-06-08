import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;
const businessId = '8490ff47-45cf-4b96-b149-aa1961280032';

async function seed() {
  if (!connectionString) {
    console.error('DATABASE_URL env variable is missing.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL Database.');

    // 1. Ensure business_stats exists
    await client.query(`
      INSERT INTO public."business_stats" (
        business_id, subscribers_total, subscribers_30d, subscribers_7d, subscribers_today,
        revenue_today_cents, revenue_7d_cents, revenue_30d_cents, revenue_all_cents, updated_at
      )
      VALUES ($1, 142, 38, 12, 2, 9900, 29700, 99900, 489000, NOW())
      ON CONFLICT (business_id) DO UPDATE SET
        subscribers_total = 142,
        subscribers_30d = 38,
        revenue_30d_cents = 99900,
        revenue_all_cents = 489000,
        updated_at = NOW();
    `, [businessId]);
    console.log('Seeded business_stats.');

    // 2. Clear previous seed messages to avoid bloating
    await client.query(`DELETE FROM public."email_messages" WHERE business_id = $1`, [businessId]);
    await client.query(`DELETE FROM public."x_messages" WHERE business_id = $1`, [businessId]);
    await client.query(`DELETE FROM public."prospection_sends" WHERE campaign_id = $1`, [businessId]); // using businessId as campaign_id for simplicity
    console.log('Cleared old seed messages.');

    // 3. Get or create a mailbox for the business
    let mailboxId;
    await client.query("DELETE FROM public.\"mailboxes\" WHERE business_id = $1 AND email_address != 'grace@sideloot.xyz'", [businessId]);
    const mbRes = await client.query("SELECT id FROM public.\"mailboxes\" WHERE business_id = $1 AND email_address = 'grace@sideloot.xyz' LIMIT 1", [businessId]);
    if (mbRes.rows.length > 0) {
      mailboxId = mbRes.rows[0].id;
    } else {
      const mbInsert = await client.query(`
        INSERT INTO public."mailboxes" (id, business_id, email_address, position_id, local_part, status)
        VALUES (gen_random_uuid(), $1, 'grace@sideloot.xyz', 'sales_rep', 'grace', 'active')
        RETURNING id
      `, [businessId]);
      mailboxId = mbInsert.rows[0].id;
    }
    console.log('Using mailbox_id:', mailboxId);

    // 4. Get or create a lead to reference
    let leadId;
    const leadRes = await client.query('SELECT id FROM public."leads" WHERE business_id = $1 LIMIT 1', [businessId]);
    if (leadRes.rows.length > 0) {
      leadId = leadRes.rows[0].id;
    } else {
      leadId = '8490ff47-45cf-4b96-b149-aa19612800ff';
      await client.query(`
        INSERT INTO public."leads" (id, business_id, full_name, email, source, status)
        VALUES ($1, $2, 'Dr. Richard Lenoir', 'dentist1@richardlenoir.fr', 'manual', 'new')
      `, [leadId, businessId]);
      
      await client.query(`
        INSERT INTO public."leads" (id, business_id, full_name, email, source, status)
        VALUES ('8490ff47-45cf-4b96-b149-aa19612800fe', $1, 'Dr. Rosenzweig', 'dentist3@rosenzweig.com', 'manual', 'new')
      `, [businessId]);
    }
    console.log('Referencing lead_id:', leadId);

    // Create a thread
    const threadId = 'a1f33f24-3ada-4dd6-9343-87da30c84845';
    await client.query(`DELETE FROM public."email_threads" WHERE business_id = $1`, [businessId]);
    await client.query(`
      INSERT INTO public."email_threads" (id, business_id, mailbox_id, lead_id, subject, inbound_count, outbound_count, unread)
      VALUES ($1, $2, $3, $4, $5, 1, 2, false)
    `, [threadId, businessId, mailboxId, leadId, "Optimisez vos réservations avec l'IA"]);

    const threadId2 = 'b2f33f24-3ada-4dd6-9343-87da30c84845';
    await client.query(`
      INSERT INTO public."email_threads" (id, business_id, mailbox_id, lead_id, subject, inbound_count, outbound_count, unread)
      VALUES ($1, $2, $3, $4, $5, 1, 1, false)
    `, [threadId2, businessId, mailboxId, leadId, "Automatisez votre cabinet dentaire"]);

    // 5. Seed email messages (outbound & inbound)
    const emails = [
      { threadId, direction: 'out', from: 'grace@sideloot.xyz', to: 'dentist1@richardlenoir.fr', subject: 'Optimisez vos réservations avec l\'IA', body: 'Bonjour, nous avons remarqué que...', status: 'sent', date: '2026-06-07T10:00:00Z' },
      { threadId, direction: 'out', from: 'grace@sideloot.xyz', to: 'dentist2@beaumarchais.fr', subject: 'Nouvel outil de secrétariat automatisé', body: 'Cher Docteur, Sideloot vous propose...', status: 'sent', date: '2026-06-06T14:30:00Z' },
      { threadId, direction: 'in', from: 'dentist1@richardlenoir.fr', to: 'grace@sideloot.xyz', subject: 'Re: Optimisez vos réservations avec l\'IA', body: 'Bonjour, votre solution m\'intéresse. Pouvons-nous nous appeler?', status: 'read', date: '2026-06-07T11:15:00Z' },
      { threadId: threadId2, direction: 'out', from: 'grace@sideloot.xyz', to: 'dentist3@rosenzweig.com', subject: 'Automatisez votre cabinet dentaire', body: 'Bonjour Rosenzweig, avec Sideloot...', status: 'sent', date: '2026-06-05T09:00:00Z' },
      { threadId: threadId2, direction: 'in', from: 'dentist3@rosenzweig.com', to: 'grace@sideloot.xyz', subject: 'Re: Automatisez votre cabinet dentaire', body: 'Est-ce compatible avec notre logiciel de gestion Julie?', status: 'read', date: '2026-06-05T12:00:00Z' }
    ];

    for (const em of emails) {
      await client.query(`
        INSERT INTO public."email_messages" (
          id, thread_id, business_id, mailbox_id, direction, from_address, to_address, subject, body_text, status, sent_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `, [em.threadId, businessId, mailboxId, em.direction, em.from, em.to, em.subject, em.body, em.status, em.date]);
    }
    console.log('Seeded email_messages.');

    // 6. Get or create an X account for the business
    let xAccountId;
    const xAccRes = await client.query('SELECT id FROM public."x_accounts" WHERE business_id = $1 LIMIT 1', [businessId]);
    if (xAccRes.rows.length > 0) {
      xAccountId = xAccRes.rows[0].id;
    } else {
      const xAccInsert = await client.query(`
        INSERT INTO public."x_accounts" (id, business_id, owner_position_id, x_user_id, handle, display_name, status)
        VALUES (gen_random_uuid(), $1, 'sales_rep', '123456', 'sideloot_outreach', 'Sideloot Outreach', 'connected')
        RETURNING id
      `, [businessId]);
      xAccountId = xAccInsert.rows[0].id;
    }
    console.log('Using x_account_id:', xAccountId);

    // 7. Seed X messages (DMs)
    const xMessages = [
      { direction: 'out', recipient: '@tech_dentist', body: 'Hey! Loved your post on digital clinic workflows. Have you tried automating patient recalls?', date: '2026-06-07T08:20:00Z' },
      { direction: 'out', recipient: '@dentistry_today', body: 'Hello, I see you guys share dental tips. We built an AI that runs outreach for clinics, would love feedback.', date: '2026-06-06T18:00:00Z' },
      { direction: 'in', recipient: '@tech_dentist', body: 'Hey, not yet. What tool do you suggest?', date: '2026-06-07T09:45:00Z' }
    ];

    for (const xm of xMessages) {
      await client.query(`
        INSERT INTO public."x_messages" (
          id, x_account_id, business_id, direction, recipient_handle, body, status, sent_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'sent', $6
        )
      `, [xAccountId, businessId, xm.direction, xm.recipient, xm.body, xm.date]);
    }
    console.log('Seeded x_messages.');

    // 8. Create mock campaigns in prospection_campaigns
    const emailCampaignId = 'e1133f24-3ada-4dd6-9343-87da30c84845';
    const xDmCampaignId = 'd2233f24-3ada-4dd6-9343-87da30c84845';
    const xReplyCampaignId = 'c3333f24-3ada-4dd6-9343-87da30c84845';
    const redditCampaignId = 'a4433f24-3ada-4dd6-9343-87da30c84845';

    await client.query(`DELETE FROM public."prospection_campaigns" WHERE business_id = $1`, [businessId]);

    await client.query(`
      INSERT INTO public."prospection_campaigns" (id, business_id, kind, name, active)
      VALUES ($1, $2, 'email', 'Campagne Email Dentistes Paris', true)
    `, [emailCampaignId, businessId]);

    await client.query(`
      INSERT INTO public."prospection_campaigns" (id, business_id, kind, name, active)
      VALUES ($1, $2, 'x_dm', 'X Outreach Startup Founders', true)
    `, [xDmCampaignId, businessId]);

    await client.query(`
      INSERT INTO public."prospection_campaigns" (id, business_id, kind, name, active)
      VALUES ($1, $2, 'x_reply', 'X Comments Reply Health', true)
    `, [xReplyCampaignId, businessId]);

    await client.query(`
      INSERT INTO public."prospection_campaigns" (id, business_id, kind, name, active)
      VALUES ($1, $2, 'reddit', 'Reddit Promotion', true)
    `, [redditCampaignId, businessId]);

    console.log('Seeded prospection_campaigns.');

    // 9. Seed prospection sends (X comment replies, Reddit posts)
    const sends = [
      { campaignId: xReplyCampaignId, kind: 'x_reply', recipient: '@clinique_dental', body: 'Totalement d\'accord avec cette analyse des goulots d\'étranglement en clinique. Sideloot aide à résoudre ça en gérant les relances.', date: '2026-06-08T09:00:00Z' },
      { campaignId: xReplyCampaignId, kind: 'x_reply', recipient: '@sante_mag', body: 'L\'IA dans le médical n\'est plus le futur, c\'est le présent. Notre agent Sideloot en est la preuve vivante.', date: '2026-06-07T15:20:00Z' },
      { campaignId: redditCampaignId, kind: 'reddit', recipient: 'r/dentistry', body: 'How we automated 90% of our patient acquisition using local search scraping and custom AI outreach agents.', date: '2026-06-08T11:00:00Z' },
      { campaignId: redditCampaignId, kind: 'reddit', recipient: 'r/startup', body: 'Sideloot is launching fully autonomous side businesses. Here is how our multi-channel prospecting works.', date: '2026-06-06T13:00:00Z' }
    ];

    for (const s of sends) {
      await client.query(`
        INSERT INTO public."prospection_sends" (
          id, campaign_id, campaign_kind, recipient, body, status, sent_at, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'sent', $5, $5
        )
      `, [s.campaignId, s.kind, s.recipient, s.body, s.date]);
    }
    console.log('Seeded prospection_sends.');

    // 10. Link emails and X DMs to campaign IDs
    await client.query(`UPDATE public.email_messages SET campaign_id = $1 WHERE business_id = $2`, [emailCampaignId, businessId]);
    await client.query(`UPDATE public.x_messages SET campaign_id = $1 WHERE business_id = $2`, [xDmCampaignId, businessId]);
    console.log('Linked emails and X messages to campaigns.');

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seed();
