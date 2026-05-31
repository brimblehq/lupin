interface ValidateS3SourceInput {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ValidateS3SourceResult {
  valid: boolean;
  message: string;
}

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const SIGNED_HEADERS = "host;x-amz-content-sha256;x-amz-date";

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeUtf8(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encodeUtf8(value));
  return toHex(digest);
}

async function hmac(key: ArrayBuffer, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encodeUtf8(value));
}

async function getSigningKey(secret: string, date: string, region: string) {
  const dateKey = await hmac(encodeUtf8(`AWS4${secret}`), date);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function buildValidationUrl(bucket: string, region: string, endpoint?: string) {
  if (endpoint) {
    const base = new URL(endpoint);
    const pathname = `${base.pathname.replace(/\/+$/, "")}/${encodePathSegment(bucket)}`;
    base.pathname = pathname;
    base.search = "";
    return base;
  }

  return new URL(`https://${bucket}.s3.${region}.amazonaws.com/`);
}

function buildAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export async function validateS3SourceBucket(input: ValidateS3SourceInput): Promise<ValidateS3SourceResult> {
  const bucket = input.bucket.trim();
  const region = input.region.trim();
  const endpoint = input.endpoint?.trim();
  const accessKeyId = input.accessKeyId.trim();
  const secretAccessKey = input.secretAccessKey.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return { valid: false, message: "Enter the source bucket, region, access key ID, and secret key." };
  }

  const url = buildValidationUrl(bucket, region, endpoint);
  const now = new Date();
  const amzDate = buildAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${UNSIGNED_PAYLOAD}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = ["HEAD", url.pathname || "/", "", canonicalHeaders, SIGNED_HEADERS, UNSIGNED_PAYLOAD].join("\n");
  const stringToSign = [ALGORITHM, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const authorization = `${ALGORITHM} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        Authorization: authorization,
        "x-amz-content-sha256": UNSIGNED_PAYLOAD,
        "x-amz-date": amzDate,
      },
    });

    if (response.ok) {
      return { valid: true, message: "Bucket name is valid." };
    }

    if (response.status === 403) {
      return { valid: false, message: "The credentials cannot access this bucket." };
    }

    if (response.status === 404) {
      return { valid: false, message: "Source bucket was not found." };
    }

    return { valid: false, message: `Bucket validation failed with status ${response.status}.` };
  } catch {
    return { valid: false, message: "Unable to validate this bucket from the browser. Check the endpoint and bucket CORS settings." };
  }
}
