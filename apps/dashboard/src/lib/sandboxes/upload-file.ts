import config from "@/config";

export interface UploadFileInput {
  sandboxId: string;
  destPath: string;
  file: File;
  token: string;
  onProgress?: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

export function uploadSandboxFile({ sandboxId, destPath, file, token, onProgress, signal }: UploadFileInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const trimmed = destPath.replace(/^\/+/, "");
    const segments = trimmed.split("/").map((seg) => encodeURIComponent(seg));
    const url = `${config.apiUrl}/v1/sandboxes/${encodeURIComponent(sandboxId)}/files/${segments.join("/")}`;

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status === 204) {
        resolve();
        return;
      }
      let message = "Upload failed";
      try {
        const body = JSON.parse(xhr.responseText || "{}");
        if (typeof body?.message === "string") message = body.message;
      } catch {
        // keep default
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}
