import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useWorkspaceRole } from "@/contexts/workspace-role-context";
import { PageHeader } from "@/components/shared/page-header";
import { formatRelativeTime } from "@/utils/dashboard";
import {
  parseWorkspaceSearchValue,
  workspacePageLoaderDeps,
} from "@/utils/workspace-route-search";
import {
  getBucketDetailsServerFn,
  listBucketObjectsServerFn,
  createBucketTokenServerFn,
  generateDownloadUrlServerFn,
  presignUploadServerFn,
  confirmUploadServerFn,
  initiateMultipartUploadServerFn,
  getMultipartUrlsServerFn,
  completeMultipartUploadServerFn,
  deleteObjectServerFn,
  deleteBucketServerFn,
  updateBucketServerFn,
} from "@/server/storage/actions";

export const Route = createFileRoute("/buckets/$bucketId/")({
  validateSearch: (search: Record<string, unknown>) => {
    const workspace = parseWorkspaceSearchValue(search.workspace);
    return workspace ? { workspace } : {};
  },
  loaderDeps: ({ search }) => workspacePageLoaderDeps(search),
  loader: async ({ params, deps }) => {
    const workspace = deps.workspace;
    const bucketId = params.bucketId;

    const [bucket, objects] = await Promise.all([
      (getBucketDetailsServerFn as any)({ data: { workspace, bucketId } }).catch(() => null),
      (listBucketObjectsServerFn as any)({ data: { workspace, bucketId } }).catch(() => []),
    ]);

    return { workspace, bucket, objects: Array.isArray(objects) ? objects : [] };
  },
  component: BucketDetailPage,
  pendingComponent: () => <div className="p-8 text-center text-sm text-gray-500">Loading bucket...</div>,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function BucketDetailPage() {
  const { canWrite } = useWorkspaceRole();
  const { bucket, objects, workspace } = Route.useLoaderData() as any;
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const createToken = useServerFn(createBucketTokenServerFn as any) as any;
  const generateDownloadUrl = useServerFn(generateDownloadUrlServerFn as any) as any;
  const presignUpload = useServerFn(presignUploadServerFn as any) as any;
  const confirmUpload = useServerFn(confirmUploadServerFn as any) as any;
  const initiateMultipart = useServerFn(initiateMultipartUploadServerFn as any) as any;
  const getMultipartUrls = useServerFn(getMultipartUrlsServerFn as any) as any;
  const completeMultipart = useServerFn(completeMultipartUploadServerFn as any) as any;
  const deleteObject = useServerFn(deleteObjectServerFn as any) as any;
  const deleteBucketAction = useServerFn(deleteBucketServerFn as any) as any;
  const updateBucketAction = useServerFn(updateBucketServerFn as any) as any;

  const [openingObject, setOpeningObject] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isDeletingBucket, setIsDeletingBucket] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bucket) return;
    
    e.target.value = '';
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    try {
      setUploading(true);
      
      if (file.size <= CHUNK_SIZE) {
        const result = await presignUpload({
          data: { workspace, bucketId: bucket._id || bucket.id, path: file.name, contentType: file.type || 'application/octet-stream', size: file.size }
        });
        
        const res = await fetch(result.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });
        if (!res.ok) throw new Error("Upload failed");

        await confirmUpload({
          data: { workspace, bucketId: bucket._id || bucket.id, uploadId: result.uploadId }
        });
      } else {
        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        
        const initResult = await initiateMultipart({
          data: { workspace, bucketId: bucket._id || bucket.id, path: file.name, contentType: file.type || 'application/octet-stream', size: file.size }
        });
        
        const { uploadId } = initResult;
        
        const urlsResult = await getMultipartUrls({
          data: { workspace, bucketId: bucket._id || bucket.id, uploadId, totalParts }
        });
        
        const parts = [];
        for (let i = 0; i < totalParts; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const uploadUrl = urlsResult.urls[i];
          
          const res = await fetch(uploadUrl, {
            method: 'PUT',
            body: chunk,
          });
          
          if (!res.ok) throw new Error(`Failed to upload part ${i + 1}`);
          const etag = res.headers.get('ETag');
          if (!etag) throw new Error(`Missing ETag for part ${i + 1}`);
          
          parts.push({ PartNumber: i + 1, ETag: etag });
        }
        
        await completeMultipart({
          data: { workspace, bucketId: bucket._id || bucket.id, uploadId, parts }
        });
      }

      toast.success("File uploaded successfully");
      Route.router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteObject(obj: any) {
    if (!confirm(`Are you sure you want to delete ${obj.path || obj.key}?`)) return;
    try {
      setDeleting(obj._id || obj.key);
      await deleteObject({
        data: { workspace, bucketId: bucket._id || bucket.id, path: obj.path || obj.key }
      });
      toast.success("Object deleted");
      Route.router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete object");
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteBucket() {
    if (!confirm(`Are you sure you want to delete the bucket "${bucket.name}"? This will permanently delete all objects. This action cannot be undone.`)) return;
    try {
      setIsDeletingBucket(true);
      await deleteBucketAction({ data: { workspace, bucketId: bucket._id || bucket.id, force: true } });
      toast.success("Bucket deleted successfully");
      Route.router.navigate({ to: "/buckets", search: { workspace } });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete bucket");
    } finally {
      setIsDeletingBucket(false);
    }
  }

  async function handleToggleVisibility() {
    const newVisibility = !bucket.is_public;
    const action = newVisibility ? "make public" : "make private";
    if (!confirm(`Are you sure you want to ${action} this bucket?`)) return;
    try {
      setIsUpdatingVisibility(true);
      await updateBucketAction({ data: { workspace, bucketId: bucket._id || bucket.id, isPublic: newVisibility } });
      toast.success(`Bucket is now ${newVisibility ? "public" : "private"}`);
      Route.router.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to update visibility");
    } finally {
      setIsUpdatingVisibility(false);
    }
  }

  async function handleGenerateToken() {
    if (!bucket) return;
    try {
      setGenerating(true);
      const result = await createToken({
        data: { workspace, bucketId: bucket._id || bucket.id, name: `${bucket.name}-token` },
      });
      setGeneratedToken(result?.token || result?.data?.token);
      toast.success("API key generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleViewObject(obj: any) {
    if (openingObject) return;
    try {
      setOpeningObject(obj._id || obj.key);
      const result = await generateDownloadUrl({
        data: { workspace, bucketId: bucket._id || bucket.id, path: obj.path || obj.key },
      });
      if (result?.url) {
        window.open(result.url, '_blank');
      } else {
        throw new Error("Could not generate URL");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to open object");
    } finally {
      setOpeningObject(null);
    }
  }

  if (!bucket) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <span className="text-sm text-dash-text-faded">Bucket not found</span>
        <Link to="/buckets" search={{ workspace }} className="text-sm text-[#3c6ce7] hover:underline">← Back to buckets</Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-4 py-8">
      <div>
        <Link to="/buckets" search={{ workspace }} className="text-sm text-dash-text-faded hover:text-dash-text-body transition-colors">← Back to buckets</Link>
      </div>

      <div className="flex items-center justify-between">
        <PageHeader title={bucket.name} image="/images/lamp.svg">
          {bucket.region || "Global"} · Created {formatRelativeTime(bucket.createdAt || bucket.updatedAt)}
        </PageHeader>

        {canWrite && (
          <div className="flex items-center gap-2">
            <label className={`flex cursor-pointer items-center gap-2 rounded-[4px] bg-[#222222] px-4 py-2 text-sm font-medium text-dash-text-strong transition-colors hover:bg-[#333333] ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? "Uploading..." : "Upload File"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <button
              onClick={handleGenerateToken}
              disabled={generating}
              className="flex items-center gap-2 rounded-[4px] bg-[#3c6ce7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#345cc7] disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate API Key"}
            </button>
          </div>
        )}
      </div>

      {generatedToken && (
        <div className="mt-4 rounded-[4px] border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-4">
          <p className="mb-2 text-sm font-medium text-dash-text-strong">Your API Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-[4px] bg-[#1a1a2e] px-3 py-2.5 font-mono text-xs text-[#e2e8f0] break-all select-all">
              {generatedToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-[4px] border border-dash-border px-3 py-2 text-xs font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#f59e0b]">⚠ Save this key now. You won't be able to see it again.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Objects</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{bucket.objectCount ?? objects.length}</p>
        </div>
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Storage Used</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{formatBytes(bucket.storage_used || 0)}</p>
        </div>
        <div className="rounded-[4px] border border-dash-border bg-dash-bg p-4">
          <span className="text-xs text-dash-text-faded">Region</span>
          <p className="mt-1 text-lg font-medium text-dash-text-strong">{bucket.region || "Global"}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-dash-text-strong">Objects</h3>
        {objects.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[4px] bg-dash-bg-elevated/40 border border-dash-border">
            <span className="text-sm text-dash-text-faded">No objects yet</span>
            <span className="text-xs text-dash-text-extra-faded">Upload files using your API key</span>
          </div>
        ) : (
          <div className="overflow-clip rounded-[4px] border-[0.5px] border-dash-border">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-dash-border bg-dash-bg-elevated/50">
                  <th className="py-2 pl-3.5 text-left text-xs font-medium text-dash-text-faded">Path</th>
                  <th className="py-2 text-left text-xs font-medium text-dash-text-faded">Size</th>
                  <th className="py-2 text-left text-xs font-medium text-dash-text-faded">Type</th>
                  <th className="py-2 text-right text-xs font-medium text-dash-text-faded">Modified</th>
                  <th className="py-2 pr-3.5 text-right text-xs font-medium text-dash-text-faded"></th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj: any, i: number) => (
                  <tr key={obj._id || i} className={`transition-colors hover:bg-dash-bg-elevated ${i !== objects.length - 1 ? "border-b border-dash-border" : ""}`}>
                    <td className="py-2.5 pl-3.5 text-sm text-dash-text-body">
                      <button 
                        onClick={() => handleViewObject(obj)}
                        disabled={openingObject === (obj._id || obj.key)}
                        className="hover:text-[#3c6ce7] hover:underline text-left"
                      >
                        {openingObject === (obj._id || obj.key) ? "Opening..." : (obj.path || obj.key)}
                      </button>
                    </td>
                    <td className="py-2.5 text-sm text-dash-text-faded">{formatBytes(obj.size || 0)}</td>
                    <td className="py-2.5 text-sm text-dash-text-faded">{obj.content_type || "—"}</td>
                    <td className="py-2.5 text-right text-sm text-dash-text-faded">{obj.last_modified ? formatRelativeTime(obj.last_modified) : "—"}</td>
                    <td className="py-2.5 pr-3.5 text-right text-sm">
                      <button 
                        onClick={() => handleDeleteObject(obj)}
                        disabled={deleting === (obj._id || obj.key)}
                        className="text-red-500 hover:text-red-400 disabled:opacity-50"
                      >
                        {deleting === (obj._id || obj.key) ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canWrite && (
        <div className="mt-12 rounded-[4px] border border-[#ef4444]/30 bg-[#ef4444]/5">
          <div className="border-b border-[#ef4444]/20 p-4">
            <h3 className="text-base font-medium text-dash-text-strong">Danger Zone</h3>
            <p className="mt-1 text-sm text-dash-text-faded">Settings that can permanently affect your bucket and its contents.</p>
          </div>
          
          <div className="p-4 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium text-dash-text-strong">Bucket Visibility</h4>
                <p className="mt-1 text-sm text-dash-text-faded">
                  Current visibility: <strong className="text-dash-text-body">{bucket.is_public ? "Public" : "Private"}</strong>. 
                  {bucket.is_public ? " Anyone with the URL can view objects." : " Only authorized users can view objects."}
                </p>
              </div>
              <button
                onClick={handleToggleVisibility}
                disabled={isUpdatingVisibility}
                className="shrink-0 rounded-[4px] border border-dash-border bg-transparent px-4 py-2 text-sm font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated disabled:opacity-50"
              >
                {isUpdatingVisibility ? "Updating..." : `Make ${bucket.is_public ? "Private" : "Public"}`}
              </button>
            </div>

            <div className="h-[1px] w-full bg-[#ef4444]/20"></div>

            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium text-dash-text-strong">Delete Bucket</h4>
                <p className="mt-1 text-sm text-dash-text-faded">Permanently delete this bucket and all of its objects. This action is irreversible.</p>
              </div>
              <button
                onClick={handleDeleteBucket}
                disabled={isDeletingBucket}
                className="shrink-0 rounded-[4px] bg-[#ef4444] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#dc2626] disabled:opacity-50"
              >
                {isDeletingBucket ? "Deleting..." : "Delete Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
