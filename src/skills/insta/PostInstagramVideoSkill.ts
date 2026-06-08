import { z } from 'zod';
import type { BaseSkill, SkillContext } from '../BaseSkill.js';
import { proxyDownload } from '../runtime/veo.js';
import { postVideo } from '../runtime/insta-api.js';

// ----- Schemas -----
export const PostInstagramVideoInputSchema = z.object({
  videoUri: z
    .string()
    .min(1)
    .describe("URI de la vidéo source (Veo 3.1 ou URL publique d'un MP4)."),
  caption: z
    .string()
    .max(2200)
    .optional()
    .describe("Caption affichée sur le post Instagram Reels. Max 2200 chars."),
});
export type PostInstagramVideoInput = z.infer<typeof PostInstagramVideoInputSchema>;

export const PostInstagramVideoOutputSchema = z.object({
  publishId: z.string().describe("ID du publish Instagram. Utilisable pour re-poller le statut."),
  status: z
    .enum(['published', 'failed', 'pending'])
    .describe("État final. 'published' = visible publiquement. 'failed' = échec."),
  failReason: z.string().optional(),
  publicPostUrl: z.string().optional().describe('URL publique directe du post Instagram.'),
  videoSizeBytes: z.number().describe('Taille du fichier vidéo uploadé.'),
});
export type PostInstagramVideoOutput = z.infer<typeof PostInstagramVideoOutputSchema>;

// ----- Skill -----
export class PostInstagramVideoSkill
  implements BaseSkill<PostInstagramVideoInput, PostInstagramVideoOutput>
{
  public readonly name = 'post_instagram_video';
  public readonly description =
    "Poste une vidéo MP4 (typiquement générée par Veo 3.1) sur le compte Instagram lié via Zernio.";
  public readonly schema = PostInstagramVideoInputSchema;

  public readonly displayName = 'Post to Instagram';
  public readonly category = 'insta';
  public readonly order = 1;
  public readonly type = 'api' as const;
  public readonly endpoint = 'graph.instagram.com/v1/...';

  async execute(input: PostInstagramVideoInput, ctx?: SkillContext): Promise<PostInstagramVideoOutput> {
    // 1. Download the video bytes (Veo URI requires the Gemini key — proxyDownload handles it).
    const { buffer } = await proxyDownload(input.videoUri);
    const videoSizeBytes = buffer.byteLength;
    // eslint-disable-next-line no-console
    console.log(
      `[post_instagram_video] agent=${ctx?.agentId ?? '-'} size=${(videoSizeBytes / 1_000_000).toFixed(2)}MB`,
    );

    // 2. Init + upload + poll until terminal.
    const { publishId, finalStatus } = await postVideo({
      videoBuffer: buffer,
      caption: input.caption,
    });

    let status: PostInstagramVideoOutput['status'];
    switch (finalStatus.status) {
      case 'PUBLISH_COMPLETE':
        status = 'published';
        break;
      case 'FAILED':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    return {
      publishId,
      status,
      failReason: finalStatus.failReason,
      publicPostUrl: finalStatus.publicPostUrl,
      videoSizeBytes,
    };
  }
}
