import { BackendApiError } from "../errors";
import { asRecord, pickNumber, pickString } from "../normalize";
import type { DeveloperTrialResult, OutstandingDeveloperTrialInvoice, OutstandingDeveloperTrialInvoiceData } from "./types";

function parseOutstandingInvoices(data: unknown): OutstandingDeveloperTrialInvoiceData | null {
  const record = asRecord(data);
  if (!record || record.error_code !== "OUTSTANDING_INVOICE_REQUIRED") {
    return null;
  }

  const invoices = Array.isArray(record.invoices) ? record.invoices : [];

  return {
    error_code: "OUTSTANDING_INVOICE_REQUIRED",
    scope: "customer_core_plan",
    customer_id: pickString(record, "customer_id") ?? "",
    invoice_count: pickNumber(record, "invoice_count") ?? invoices.length,
    invoices: invoices.map((invoice): OutstandingDeveloperTrialInvoice => {
      const invoiceRecord = asRecord(invoice);

      return {
        id: pickString(invoiceRecord, "id") ?? "",
        subscription_id: pickString(invoiceRecord, "subscription_id") ?? "",
        amount_due: pickNumber(invoiceRecord, "amount_due") ?? 0,
        currency: pickString(invoiceRecord, "currency") ?? "",
        status: pickString(invoiceRecord, "status") ?? "",
        attempt_count: pickNumber(invoiceRecord, "attempt_count") ?? 0,
        next_payment_attempt: pickString(invoiceRecord, "next_payment_attempt") ?? null,
        created: pickString(invoiceRecord, "created") ?? "",
        hosted_invoice_url: pickString(invoiceRecord, "hosted_invoice_url") ?? null,
        invoice_pdf: pickString(invoiceRecord, "invoice_pdf") ?? null,
      };
    }),
  };
}

export function mapDeveloperTrialError(error: unknown): DeveloperTrialResult {
  if (!(error instanceof BackendApiError)) {
    throw error;
  }

  const details = asRecord(error.details);
  const envelope = asRecord(details?.data);
  const data = asRecord(envelope?.data ?? details?.data ?? error.details);

  if (error.status === 402) {
    const paymentIntent = pickString(data, "payment_intent_id")?.trim();
    const clientSecret = pickString(data, "client_secret")?.trim();

    if (paymentIntent && clientSecret) {
      return {
        status: "pending",
        message: error.message || "Trial requires payment confirmation",
        data: {
          requires_action: Boolean(data?.requires_action),
          payment_intent_id: paymentIntent,
          client_secret: clientSecret,
        },
      };
    }
  }

  return {
    status: "error",
    message: error.message || "Developer trial could not be started",
    data: parseOutstandingInvoices(data),
  };
}
