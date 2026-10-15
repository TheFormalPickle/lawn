import test from "node:test";
import assert from "node:assert/strict";
import {
  muxUploadIdentity,
  parseMuxUploadIdentity,
} from "../convex/uploadIdentity";

test("Mux receipt carries exact video and original identity; legacy and malformed input stay distinct", () => {
  assert.deepEqual(
    parseMuxUploadIdentity(
      muxUploadIdentity("video", "videos/video/original.mp4"),
    ),
    { videoId: "video", uploadId: "videos/video/original.mp4" },
  );
  assert.deepEqual(parseMuxUploadIdentity("legacy"), {
    videoId: "legacy",
    uploadId: undefined,
  });
  for (const value of [
    undefined,
    "",
    "{",
    '{"version":2}',
    '{"version":1,"videoId":"video","uploadId":42}',
  ])
    assert.equal(parseMuxUploadIdentity(value), null);
});
