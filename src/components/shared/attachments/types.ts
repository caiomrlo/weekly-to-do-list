import { AttachmentWithUrl } from "@/app/actions/attachments";

export type AttachmentEntityTarget =
  | { type: "task"; id: string }
  | { type: "doc"; id: string };

export interface AttachmentsAndDocsSectionProps {
  target: AttachmentEntityTarget;
  attachments: AttachmentWithUrl[];
  onAttachmentsChange: (updated: AttachmentWithUrl[]) => void;
  isLoading?: boolean;
  variant?: "modal" | "card";
  onDocsCountChange?: (count: number) => void;
}
