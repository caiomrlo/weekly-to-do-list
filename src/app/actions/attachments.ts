"use server";

import { db } from "@/db";
import { attachments, tasks, Attachment } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  uploadToR2,
  deleteFromR2,
  generateFilePath,
} from "@/lib/r2";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

// Tipos permitidos: imagens e documentos PDF
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

// Limite máximo de arquivo: 20 MB
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export interface AttachmentWithUrl extends Attachment {
  url: string;
}

/**
 * Busca todos os anexos de uma tarefa específica pertencente ao usuário autenticado.
 */
export async function getTaskAttachmentsAction(
  taskId: string
): Promise<{ attachments?: AttachmentWithUrl[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const rows = await db
      .select()
      .from(attachments)
      .where(
        and(eq(attachments.taskId, taskId), eq(attachments.userId, session.userId))
      )
      .orderBy(desc(attachments.createdAt));

    const list: AttachmentWithUrl[] = rows.map((att) => ({
      ...att,
      url: `/api/attachments/${att.id}`,
    }));

    return { attachments: list };
  } catch (err: unknown) {
    console.error("Erro ao buscar anexos da tarefa:", err);
    return { error: "Erro ao buscar anexos da tarefa." };
  }
}

/**
 * Realiza o upload de um arquivo para o Cloudflare R2 e cria o registro na tabela attachments.
 */
export async function uploadAttachmentAction(
  formData: FormData
): Promise<{ attachment?: AttachmentWithUrl; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  const taskId = formData.get("taskId");
  const file = formData.get("file");

  if (!taskId || typeof taskId !== "string") {
    return { error: "ID da tarefa inválido." };
  }

  if (!file || !(file instanceof File)) {
    return { error: "Nenhum arquivo enviado." };
  }

  // 1. Validação de formato (MIME type)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      error:
        "Formato não suportado. Apenas imagens (PNG, JPG, WebP, GIF) e documentos PDF são permitidos.",
    };
  }

  // 2. Validação de tamanho
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      error: `O arquivo excede o limite máximo permitido de ${
        MAX_FILE_SIZE_BYTES / (1024 * 1024)
      }MB.`,
    };
  }

  // 3. Validação de permissão na tarefa
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.userId)))
    .limit(1);

  if (!task) {
    return { error: "Tarefa não encontrada ou acesso não autorizado." };
  }

  // 4. Preparação do ID do anexo e do caminho relativo no R2
  const attachmentId = randomUUID();
  const filePath = generateFilePath(attachmentId, file.name);

  try {
    // 5. Upload do arquivo para o Cloudflare R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadToR2(filePath, buffer, file.type);

    // 6. Inserção na tabela 'attachments'
    try {
      const [inserted] = await db
        .insert(attachments)
        .values({
          id: attachmentId,
          taskId,
          userId: session.userId,
          fileName: file.name,
          filePath,
          contentType: file.type,
          fileSize: file.size,
        })
        .returning();

      revalidatePath("/");

      return {
        attachment: {
          ...inserted,
          url: `/api/attachments/${inserted.id}`,
        },
      };
    } catch (dbErr) {
      // Rollback no Cloudflare R2 se falhar a persistência no banco
      console.error("Falha ao salvar anexo no banco de dados. Executando rollback no R2:", dbErr);
      await deleteFromR2(filePath).catch((r2Err) =>
        console.error("Falha no rollback do R2:", r2Err)
      );
      throw dbErr;
    }
  } catch (err: unknown) {
    console.error("Erro ao fazer upload do anexo:", err);
    return { error: "Falha ao enviar o arquivo. Verifique sua conexão e tente novamente." };
  }
}

/**
 * Exclui um anexo do Cloudflare R2 e remove seu registro do banco de dados.
 */
export async function deleteAttachmentAction(
  attachmentId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const [existing] = await db
      .select({ id: attachments.id, filePath: attachments.filePath })
      .from(attachments)
      .where(
        and(eq(attachments.id, attachmentId), eq(attachments.userId, session.userId))
      )
      .limit(1);

    if (!existing) {
      return { error: "Anexo não encontrado ou acesso não autorizado." };
    }

    // 1. Exclui o arquivo físico no Cloudflare R2
    await deleteFromR2(existing.filePath);

    // 2. Remove o registro no banco de dados
    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    console.error("Erro ao deletar anexo:", err);
    return { error: "Erro ao excluir o anexo." };
  }
}
