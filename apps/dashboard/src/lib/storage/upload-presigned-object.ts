type UploadPresignedObjectInput = {
  url: string;
  body: Blob;
  contentType?: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
};

export function uploadPresignedObject({ url, body, contentType, onProgress }: UploadPresignedObjectInput): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader("ETag"));
        return;
      }

      reject(new Error("Upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    xhr.send(body);
  });
}
