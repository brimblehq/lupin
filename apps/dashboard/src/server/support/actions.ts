import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { withTokenRefresh } from "@/server/shared/backend";

const FILENAME_PATTERN = /\.(png|jpe?g|gif|webp|log)$/i;

const createTicketSchema = Yup.object({
  subject: Yup.string().trim().max(120).optional(),
  message: Yup.string().trim().min(1).max(5000).required("Please describe what happened"),
  files: Yup.array()
    .of(
      Yup.object({
        filename: Yup.string().trim().required().matches(FILENAME_PATTERN, "Only images and .log files are allowed"),
        content_base64: Yup.string().required(),
      }),
    )
    .max(10)
    .optional(),
});

export const createSupportTicketServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const { subject, message, files } = createTicketSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh((api) => api.support.createTicket({ subject, message, files }));
});
