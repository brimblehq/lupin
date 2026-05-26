import { useState } from "react";
import { Modal } from "./modal";
import { useHaptics } from "@/hooks/use-haptics";
import { LoadingButtonContent } from "./loading-button-content";
import { Dropdown, type DropdownOption } from "./dropdown";

interface AddBucketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (data: { name: string; description: string; region: string; isPublic: boolean }) => Promise<{ bucket: any; token?: string }>;
}

const regionOptions: DropdownOption[] = [
  { id: "Global", label: "Global (Automatic)" },
  { id: "US East (N. Virginia)", label: "US East (N. Virginia)" },
  { id: "EU (Frankfurt)", label: "EU (Frankfurt)" },
];

export function AddBucketModal({ open, onOpenChange, onContinue }: AddBucketModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [bucketName, setBucketName] = useState("");
  const [description, setDescription] = useState("");
  const [bucketRegion, setBucketRegion] = useState("Global");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  async function handleCreate() {
    const normalizedName = bucketName.trim().toLowerCase();
    
    if (!normalizedName) {
      setError("Bucket name is required.");
      setStep(1);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(normalizedName)) {
      setError("Bucket name can only contain lowercase letters, numbers, and hyphens.");
      setStep(1);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const result = await onContinue({
        name: normalizedName,
        description: description.trim(),
        region: bucketRegion === "Global" ? "" : bucketRegion,
        isPublic
      });
      setSuccessToken(result?.token || null);
    } catch (e: any) {
      setError(e.message || "Failed to create bucket");
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!successToken) return;
    await navigator.clipboard.writeText(successToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(1);
      setBucketName("");
      setDescription("");
      setBucketRegion("Global");
      setIsPublic(false);
      setError(null);
      setSuccessToken(null);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  if (successToken) {
    return (
      <Modal open={open} onOpenChange={handleOpenChange} width={500}>
        <div className="flex flex-col gap-0.5 rounded-t-[8px] border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4">
          <h2 className="text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong">Bucket Created!</h2>
          <p className="text-sm font-light leading-[1.3] text-dash-text-faded">Your storage bucket is ready to use</p>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-5 pt-4">
          <div className="flex items-center gap-2 rounded-[4px] bg-[#22c55e]/10 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-[#22c55e]">Bucket created successfully</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium leading-5 text-dash-text-strong">Your API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-[4px] bg-[#1a1a2e] px-3 py-2.5 font-mono text-xs text-[#e2e8f0] break-all select-all">
                {successToken}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded-[4px] border border-dash-border px-3 py-2 text-xs font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="flex items-center gap-1 text-xs text-[#f59e0b]">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Save this key now. You won't be able to see it again.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end border-t-[0.5px] border-dash-border px-4 py-4">
          <button
            onClick={() => handleOpenChange(false)}
            className="rounded-[4px] bg-[#3c6ce7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#345cc7]"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  const sharedHeader = (
    <>
      <div className="flex flex-col px-6 pt-5 pb-4 bg-dash-bg">
        <h2 style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "14px", lineHeight: "100%", letterSpacing: "-0.006em" }} className="text-dash-text-strong">
          Create Storage Bucket
        </h2>
        <p style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 300, fontSize: "14px", lineHeight: "130%", letterSpacing: "0%" }} className="mt-1 text-dash-text-faded">
          Connect to frontend-web-store
        </p>
      </div>
      <div className="h-[0.5px] w-full bg-dash-border" />
      <div className="flex items-center gap-2 px-6 py-4 bg-dash-bg">
        <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: step === 1 ? 700 : 400, fontSize: "12px", lineHeight: "20px", letterSpacing: "-0.0016em" }} className={step === 1 ? "text-dash-text-strong" : "text-dash-text-faded"}>
          Bucket Details
        </span>
        <div className="h-[1px] w-4 bg-dash-border" />
        <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: step === 2 ? 700 : 400, fontSize: "12px", lineHeight: "20px", letterSpacing: "-0.0016em" }} className={step === 2 ? "text-dash-text-strong" : "text-dash-text-faded"}>
          Bucket Visibility
        </span>
      </div>
    </>
  );

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={500} className="!h-[437px] rounded-[8px]">
      {sharedHeader}

      <div className="flex-1 overflow-y-auto px-[14px]">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "14px", lineHeight: "20px", letterSpacing: "-0.0016em" }} className="text-dash-text-strong">Name your Bucket</label>
              <input
                type="text"
                placeholder="Name"
                value={bucketName}
                onChange={(e) => {
                  setBucketName(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                className="w-full h-[33px] px-2 py-[6px] rounded-[6px] border-[0.5px] border-dash-border bg-transparent text-sm text-dash-text-strong outline-none focus:border-[#3c6ce7] placeholder:text-dash-text-faded"
              />
              {error && <p className="text-xs text-[#e1291d]">{error}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "14px", lineHeight: "20px", letterSpacing: "-0.0016em" }} className="text-dash-text-strong">Describe your bucket</label>
              <input
                type="text"
                placeholder="Enter a description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-[33px] px-2 py-[6px] rounded-[6px] border-[0.5px] border-dash-border bg-transparent text-sm text-dash-text-strong outline-none focus:border-[#3c6ce7] placeholder:text-dash-text-faded"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "14px", lineHeight: "20px", letterSpacing: "-0.0016em" }} className="text-dash-text-strong">Storage location</label>
              <Dropdown
                value={bucketRegion}
                options={regionOptions}
                onChange={setBucketRegion}
                placeholder="Select region"
                className="!min-h-[33px] !px-2 !py-[6px] !rounded-[6px]"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 300, fontSize: "14px", lineHeight: "150%", letterSpacing: "-0.015em" }} className="text-dash-text-faded">
              Store, organize, and manage application 
            </p>
            
            <div 
              onClick={() => setIsPublic(true)}
              className={`flex h-[71px] w-full cursor-pointer items-start gap-3 rounded-[10px] border-[2px] p-3 transition-colors ${isPublic ? "border-[#3c6ce7] bg-[#3c6ce7]/5" : "border-dash-border hover:border-dash-border/80"}`}
            >
              <div className="flex-1 flex flex-col gap-1.5">
                <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "12px", lineHeight: "100%", letterSpacing: "-0.006em" }} className="text-dash-text-strong">Public</span>
                <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 300, fontSize: "12px", lineHeight: "130%", letterSpacing: "0%" }} className="text-dash-text-faded">Files are accessible publicly using direct URLs.</span>
              </div>
              <div className={`mt-1 flex h-[14px] w-[14px] items-center justify-center rounded-full border ${isPublic ? "border-[#3c6ce7]" : "border-[#7A7C81]"}`}>
                {isPublic && <div className="h-2 w-2 rounded-full bg-[#3c6ce7]" />}
              </div>
            </div>

            <div 
              onClick={() => setIsPublic(false)}
              className={`flex h-[71px] w-full cursor-pointer items-start gap-3 rounded-[10px] border-[2px] p-3 transition-colors ${!isPublic ? "border-[#3c6ce7] bg-[#3c6ce7]/5" : "border-dash-border hover:border-dash-border/80"}`}
            >
              <div className="flex-1 flex flex-col gap-1.5">
                <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 400, fontSize: "12px", lineHeight: "100%", letterSpacing: "-0.006em" }} className="text-dash-text-strong">Private</span>
                <span style={{ fontFamily: "ABC Marfa Variable Unlicensed Trial, sans-serif", fontWeight: 300, fontSize: "12px", lineHeight: "130%", letterSpacing: "0%" }} className="text-dash-text-faded">Files require authentication or secure access tokens.</span>
              </div>
              <div className={`mt-1 flex h-[14px] w-[14px] items-center justify-center rounded-full border ${!isPublic ? "border-[#3c6ce7]" : "border-[#7A7C81]"}`}>
                {!isPublic && <div className="h-2 w-2 rounded-full bg-[#3c6ce7]" />}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-[0.5px] w-full bg-dash-border mt-4" />
      
      <div className="flex items-center justify-end gap-2 px-6 py-4">
        <button
          onClick={() => handleOpenChange(false)}
          className="flex h-[34px] w-[64px] items-center justify-center rounded-[4px] border border-dash-border text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated px-4"
        >
          Cancel
        </button>
        
        {step === 1 ? (
          <button
            onClick={() => setStep(2)}
            disabled={!bucketName.trim()}
            className="flex h-[34px] w-[64px] items-center justify-center rounded-[4px] bg-[#010F1A] dark:bg-white text-sm font-medium text-white dark:text-[#010F1A] transition-colors hover:opacity-90 disabled:opacity-50 px-4"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => {
              if (!submitting) {
                haptics.medium();
                void handleCreate();
              }
            }}
            disabled={submitting}
            className="flex h-[34px] items-center justify-center px-4 rounded-[4px] bg-[#010F1A] dark:bg-white text-sm font-medium text-white dark:text-[#010F1A] transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <LoadingButtonContent loading={submitting} loadingLabel="Creating...">
              Create Storage Bucket
            </LoadingButtonContent>
          </button>
        )}
      </div>
    </Modal>
  );
}
