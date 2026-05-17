import * as Dialog from "@radix-ui/react-dialog";
import { Formik, Form as FormikForm } from "formik";
import { TriangleAlert } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Modal } from "../shared/modal";
import { GlossyButton } from "../shared/glossy-button";
import { dashInputClassName } from "../shared/dash-input";
import { useCancelSubscription } from "@/hooks/use-payments";
import { hapticToast as toast } from "@/utils/haptic-toast";
import {
  CANCEL_COMMENT_MAX,
  cancelSubscriptionInitialValues,
  cancelSubscriptionSchema,
  type CancelSubscriptionFormValues,
} from "@/utils/billing";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
}

export function CancelSubscriptionModal({ open, onOpenChange, currentPlan }: CancelSubscriptionModalProps) {
  const router = useRouter();
  const cancelMutation = useCancelSubscription();

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={420}>
      <Formik<CancelSubscriptionFormValues>
        initialValues={cancelSubscriptionInitialValues}
        validationSchema={cancelSubscriptionSchema}
        enableReinitialize
        onSubmit={async (values, { setSubmitting }) => {
          try {
            await cancelMutation.mutateAsync({ comment: values.comment.trim() });
            toast.success("Subscription cancelled. You'll keep access until the end of this billing period.");
            void invalidateActiveMatches(router);
            onOpenChange(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, isSubmitting, handleChange, handleBlur }) => (
          <FormikForm>
            <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#ef2f1f]/10">
                <TriangleAlert className="size-5 text-[#ef2f1f]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Dialog.Title className="text-base font-medium leading-[1.4] tracking-[-0.096px] text-dash-text-strong">
                  Cancel your subscription?
                </Dialog.Title>
                <Dialog.Description className="text-sm leading-5 text-dash-text-faded">
                  You'll keep {currentPlan} features until the end of this billing period, then move to Free.
                </Dialog.Description>
              </div>

              <div className="flex w-full flex-col gap-1.5 pt-1 text-left">
                <label htmlFor="cancel-comment" className="text-sm font-medium text-dash-text-strong">
                  Why are you cancelling? <span className="text-[#ef2f1f]">*</span>
                </label>
                <textarea
                  id="cancel-comment"
                  name="comment"
                  value={values.comment}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={CANCEL_COMMENT_MAX}
                  rows={4}
                  placeholder="Your feedback helps us improve."
                  className={`${dashInputClassName} resize-none`}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#ef2f1f]">{touched.comment && errors.comment ? errors.comment : " "}</span>
                  <span className="tabular-nums text-dash-text-faded">
                    {values.comment.length} / {CANCEL_COMMENT_MAX}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t-[0.5px] border-dash-border px-4 py-4 sm:flex-row sm:items-center">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="flex h-[40px] flex-1 items-center justify-center rounded-[8px] border border-dash-border bg-dash-bg text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated disabled:opacity-60"
                >
                  Keep my plan
                </button>
              </Dialog.Close>
              <GlossyButton
                type="submit"
                variant="red"
                fullWidth
                disableHaptic
                disabled={isSubmitting}
                loading={isSubmitting}
                loadingLabel="Cancelling..."
                className="flex-1"
              >
                Cancel subscription
              </GlossyButton>
            </div>
          </FormikForm>
        )}
      </Formik>
    </Modal>
  );
}
