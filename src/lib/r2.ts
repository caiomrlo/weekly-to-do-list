import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "";

/**
 * Singleton client S3 configurado para a API S3-compatible do Cloudflare R2.
 */
export const r2 = new S3Client({
  region: "auto", // Exigido pelo SDK S3, mas ignorado pelo R2
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Normaliza e sanitiza o nome original do arquivo conforme as recomendações do Cloudflare R2:
 * 1. Normalização Unicode NFC
 * 2. Remoção de caminhos absolutos/relativos (path traversal)
 * 3. Substituição de caracteres problemáticos em chaves S3/URLs
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName) return "unnamed-file";
  // Normalização Unicode NFC (recomendada pela documentação da Cloudflare R2)
  const normalized = rawName.normalize("NFC");
  // Remove qualquer caractere de diretório (\ ou /)
  const baseName = normalized.replace(/^.*[\\/]/, "").trim();
  // Substitui espaços e caracteres especiais mantendo pontos, traços e underscores
  const sanitized = baseName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return sanitized || "unnamed-file";
}

/**
 * Gera o caminho relativo inteligente para o arquivo no bucket R2.
 * Padrão: files/{attachmentId}/{sanitizedFileName}
 */
export function generateFilePath(attachmentId: string, fileName: string): string {
  const cleanName = sanitizeFileName(fileName);
  return `files/${attachmentId}/${cleanName}`;
}

/**
 * Realiza upload de um Buffer/Uint8Array para o Cloudflare R2 via PutObjectCommand.
 */
export async function uploadToR2(
  filePath: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    Body: buffer,
    ContentType: contentType,
  });

  await r2.send(command);
}

/**
 * Exclui um objeto individual do Cloudflare R2 via DeleteObjectCommand.
 */
export async function deleteFromR2(filePath: string): Promise<void> {
  if (!filePath) return;
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
  });

  await r2.send(command);
}

/**
 * Exclui múltiplos objetos em lote do Cloudflare R2 via DeleteObjectsCommand.
 */
export async function deleteManyFromR2(filePaths: string[]): Promise<void> {
  const validKeys = filePaths.filter(Boolean);
  if (validKeys.length === 0) return;

  const command = new DeleteObjectsCommand({
    Bucket: R2_BUCKET,
    Delete: {
      Objects: validKeys.map((Key) => ({ Key })),
      Quiet: true,
    },
  });

  await r2.send(command);
}

/**
 * Gera uma URL assinada temporária para visualização (inline) no navegador.
 */
export async function getPresignedViewUrl(
  filePath: string,
  expiresInSeconds = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    ResponseContentDisposition: fileName
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : undefined,
  });

  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

/**
 * Gera uma URL assinada temporária forçando download (attachment).
 */
export async function getPresignedDownloadUrl(
  filePath: string,
  expiresInSeconds = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${encodeURIComponent(fileName)}"`
      : "attachment",
  });

  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}
