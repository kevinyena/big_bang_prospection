import { z } from 'zod';
import type { BaseSkill, SkillContext } from '../BaseSkill.js';
import { broadcastKpis } from '../runtime/whatsapp-api.js';

export const WhatsAppExchangeInputSchema = z.object({
  action: z.enum(['broadcast_kpis']).default('broadcast_kpis').describe('Action à déclencher. Par défaut, envoie les KPIs.'),
});
export type WhatsAppExchangeInput = z.infer<typeof WhatsAppExchangeInputSchema>;

export const WhatsAppExchangeOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string().describe('Message de statut.'),
});
export type WhatsAppExchangeOutput = z.infer<typeof WhatsAppExchangeOutputSchema>;

export class WhatsAppExchangeSkill implements BaseSkill<WhatsAppExchangeInput, WhatsAppExchangeOutput> {
  public readonly name = 'whatsapp_exchange';
  public readonly description = "Permet de déclencher l'envoi du rapport KPI unifié sur WhatsApp.";
  public readonly schema = WhatsAppExchangeInputSchema;

  public readonly displayName = 'WhatsApp CEO Exchange';
  public readonly category = 'whatsapp_ceo';
  public readonly order = 0;
  public readonly type = 'api' as const;

  async execute(input: WhatsAppExchangeInput, _ctx?: SkillContext): Promise<WhatsAppExchangeOutput> {
    if (input.action === 'broadcast_kpis') {
      const res = await broadcastKpis();
      return { ok: true, message: `KPIs envoyés avec succès à la conversation ${res.conversationId}` };
    }
    return { ok: false, message: 'Action inconnue' };
  }
}
