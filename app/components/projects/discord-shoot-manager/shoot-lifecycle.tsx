"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Clapperboard, Hash, LockKeyhole, Pin } from "lucide-react";
import AnimationPlayer from "@/app/components/ui/animation-player";
import type { AnimationFrame } from "@/lib/animation/timeline";
import {
  createShootRenderer,
  SHOOT_STAGES,
} from "@/lib/discord-shoot-manager/lifecycle";
import styles from "./shoot-lifecycle.module.css";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function ShootDetails() {
  return (
    <div className={styles.details}>
      <div>
        <span>Call time</span>
        <p>Friday · 14:00</p>
      </div>
      <div>
        <span>Location</span>
        <p>Arts building</p>
      </div>
    </div>
  );
}

export default function ShootLifecycle() {
  const root = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createShootRenderer> | null>(null);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const onFrame = useCallback(
    (frame: AnimationFrame) => renderer.current?.(frame),
    [],
  );

  useEffect(() => {
    const element = root.current!;
    renderer.current = createShootRenderer(({ reacted, joined, archived }) => {
      element.style.setProperty("--reacted", String(reacted));
      element.style.setProperty("--joined", String(joined));
      element.style.setProperty("--archived", String(archived));
      element.dataset.joined = String(joined);
      element.dataset.archived = String(archived);
      element.dataset.sceneStage =
        archived >= 0.5 ? "archive" : joined >= 0.5 ? "join" : "create";
    });
    return () => {
      renderer.current = null;
    };
  }, []);

  return (
    <figure className="my-10" aria-label="Shoot lifecycle illustration">
      <AnimationPlayer
        label="Shoot lifecycle"
        stages={SHOOT_STAGES}
        ready={ready}
        onFrame={onFrame}
      >
        <div
          ref={root}
          className={styles.root}
          data-shoot-lifecycle
          data-scene-stage="create"
          data-joined="0"
          data-archived="0"
        >
          <div className={styles.scene} data-shoot-scene aria-hidden="true">
            <div className={styles.header}>
              <div className={styles.channelTitle}>
                <span className={styles.publicTitle}>
                  <Hash size={16} />
                  shoot-invitations
                </span>
                <span className={styles.privateTitle}>
                  <LockKeyhole size={15} />
                  campus-interview
                </span>
              </div>
              <span className={styles.viewLabel}>Illustrated member view</span>
            </div>
            <div className={styles.body}>
              <div className={styles.sidebar}>
                <p className={styles.category}>Shared</p>
                <div className={styles.invitationChannel}>
                  <Hash size={13} />
                  shoot-invitations
                </div>
                <p className={styles.activeCategory}>Active shoots</p>
                <p className={styles.archiveCategory}>Archive</p>
                <div className={styles.shootChannel} data-shoot-channel>
                  <LockKeyhole size={12} />
                  campus-interview
                </div>
              </div>
              <div className={styles.messages}>
                <div className={styles.invitation} data-shoot-invitation>
                  <div className={styles.sender}>
                    <Clapperboard size={17} />
                    <strong>TVM Bot</strong>
                    <span>App</span>
                  </div>
                  <p className={styles.shootName}>Campus interview</p>
                  <ShootDetails />
                  <p className={styles.joinInstruction}>
                    React 🎬 to join; remove your reaction to leave.
                  </p>
                  <div className={styles.reaction}>
                    🎬{" "}
                    <span className={styles.reactionCount}>
                      <span>1</span>
                      <span>2</span>
                    </span>
                  </div>
                </div>
                <div className={styles.workspace} data-shoot-workspace>
                  <div className={styles.pinned}>
                    <Pin size={13} />
                    <span>Pinned brief</span>
                  </div>
                  <p className={styles.shootName}>Campus interview</p>
                  <ShootDetails />
                  <div className={styles.crew}>
                    <span>Crew</span>
                    <p>Sam · Alex</p>
                  </div>
                  <div className={styles.message} data-shoot-message>
                    <strong>Sam</strong>
                    <p>I’ll bring the camera and audio kit.</p>
                  </div>
                  <div className={styles.composer}>
                    <span
                      className={styles.openComposer}
                      data-shoot-composer="open"
                    >
                      Message #campus-interview
                    </span>
                    <span
                      className={styles.closedComposer}
                      data-shoot-composer="closed"
                    >
                      <LockKeyhole size={13} />
                      Read-only archive
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.captions} aria-hidden="true">
            <p className={styles.createCaption}>
              An administrator publishes a shoot invitation.
            </p>
            <p className={styles.joinCaption}>
              Alex reacts to join and gains access to the private chat.
            </p>
            <p className={styles.archiveCaption}>
              The shoot closes. Participants can still read the conversation.
            </p>
          </div>
        </div>
      </AnimationPlayer>
      <figcaption className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
        Illustrated workflow using synthetic members—not a recording. Archive
        permissions show an ordinary participant’s view.
      </figcaption>
      <p className="sr-only">
        Create: an administrator publishes a Campus interview shoot invitation.
        Join: Alex reacts and gains access to the private chat and pinned brief.
        Archive: the channel moves into the archive; the brief and conversation
        remain readable, while ordinary participants can no longer post.
      </p>
    </figure>
  );
}
