import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { diagnosePhotoGraphR2Access } from "@/lib/server/photo-graph-r2";

describe("Photo Graph production R2 diagnostic", () => {
  it("checks the published object, verifies a private staging write, and removes it", async () => {
    let put: PutObjectCommand | undefined;
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        if (command.input.Bucket === "dextery-photo-graph")
          return { ContentLength: 42709 };
        return {
          ContentLength: (put?.input.Body as Buffer).length,
          ContentType: "image/png",
          Metadata: put?.input.Metadata,
        };
      }
      if (command instanceof PutObjectCommand) {
        put = command;
        return {};
      }
      if (command instanceof DeleteObjectCommand) return {};
      throw new Error("Unexpected R2 command.");
    });
    expect(
      await diagnosePhotoGraphR2Access({ send } as unknown as S3Client),
    ).toEqual({
      ok: true,
    });
    expect(put?.input.Bucket).toBe("dextery-photo-graph-staging");
    expect(put?.input.Key).toMatch(/^staging\/[0-9a-f-]+\.png$/);
    expect(send.mock.calls.at(-1)?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls.at(-1)?.[0] as DeleteObjectCommand).input.Key).toBe(
      put?.input.Key,
    );
  });

  it("returns only the failed stage and status when the production key cannot write", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: 42709 };
      throw { $metadata: { httpStatusCode: 403 } };
    });
    expect(
      await diagnosePhotoGraphR2Access({ send } as unknown as S3Client),
    ).toEqual({
      ok: false,
      stage: "staging write",
      upstreamStatus: 403,
      cleanupPending: false,
    });
    expect(send.mock.calls).toHaveLength(2);
  });
});
