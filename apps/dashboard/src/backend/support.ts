import type { ApiClient } from "./types";

export interface SupportTicketAttachmentInput {
  filename: string;
  content_base64: string;
}

export interface CreateSupportTicketBody {
  message: string;
  subject?: string;
  files?: SupportTicketAttachmentInput[];
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  attachments: number;
}

export interface SupportApi {
  createTicket(input: CreateSupportTicketBody): Promise<SupportTicket>;
}

interface Envelope<T> {
  message: string;
  data: T;
}

export function createSupportApi(client: ApiClient): SupportApi {
  const basePath = "/core/v1/support/tickets";

  return {
    async createTicket(input) {
      const response = await client.request<Envelope<SupportTicket>>(basePath, {
        method: "POST",
        body: {
          subject: input.subject,
          message: input.message,
          files: input.files,
        },
      });
      return response.data;
    },
  };
}
