import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../convex/s3";

test("browser PUT signatures do not invent an empty checksum and retain explicit payload checksums", async () => {
  const values = {
    RAILWAY_ACCESS_KEY_ID: "owned-test-access",
    RAILWAY_SECRET_ACCESS_KEY: "owned-test-signing-secret-not-production",
    RAILWAY_ENDPOINT: "https://storage.example.invalid",
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  const client = getS3Client();
  try {
    const input = {
      Bucket: "owned-test",
      Key: "video.mp4",
      ContentType: "video/mp4",
    };
    const signed = new URL(
      await getSignedUrl(client, new PutObjectCommand(input), {
        expiresIn: 60,
      }),
    );
    assert.equal(signed.searchParams.has("x-amz-checksum-crc32"), false);
    assert.equal(
      signed.searchParams.has("x-amz-sdk-checksum-algorithm"),
      false,
    );
    assert(signed.searchParams.get("X-Amz-Signature"));
    const checksum = createHash("sha256")
      .update("known nonempty body")
      .digest("base64");
    const explicit = new URL(
      await getSignedUrl(
        client,
        new PutObjectCommand({ ...input, ChecksumSHA256: checksum }),
        { expiresIn: 60 },
      ),
    );
    assert.equal(explicit.searchParams.get("x-amz-checksum-sha256"), checksum);
  } finally {
    client.destroy();
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
