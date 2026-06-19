/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useForm, Controller } from "react-hook-form";
// plane imports
import { EIssueCommentAccessSpecifier } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { Loader2, Mic, Send, Square, Trash2, X } from "lucide-react";
import type { TIssueComment, TCommentsOperations } from "@plane/types";
import { cn, isCommentEmpty } from "@plane/utils";
// components
import { LiteTextEditor } from "@/components/editor/lite-text";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
// services
import { FileService } from "@/services/file.service";
import { IssueAttachmentService } from "@/services/issue";

type TCommentCreate = {
  entityId: string;
  workspaceSlug: string;
  activityOperations: TCommentsOperations;
  showToolbarInitially?: boolean;
  projectId?: string;
  onSubmitCallback?: (elementId: string) => void;
};

// services
const fileService = new FileService();
const issueAttachmentService = new IssueAttachmentService();

const MAX_RECORDING_DURATION_SECONDS = 120;
const VOICE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type TVoiceDraftStatus = "idle" | "recording" | "preview" | "uploading" | "error";

type TVoiceDraft = {
  status: TVoiceDraftStatus;
  duration: number;
  file?: File;
  previewUrl?: string;
  errorKey?: string;
  warningKey?: string;
};

const getSupportedRecordingMimeType = () => {
  if (typeof MediaRecorder === "undefined") return undefined;
  return VOICE_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

const getVoiceFileExtension = (mimeType: string) => {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
};

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const escapeHTML = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const appendCommentHTML = (currentHTML: string | undefined, blockHTML: string) => {
  if (isCommentEmpty(currentHTML ?? undefined)) return blockHTML;
  return `${currentHTML ?? ""}${blockHTML}`;
};

const buildVoiceMessageHTML = (assetUrl: string, fileName: string, duration: number) =>
  `<div data-plane-voice-message="true" data-plane-voice-duration="${duration}" data-plane-voice-name="${escapeHTML(
    fileName
  )}"><a href="${escapeHTML(assetUrl)}" data-plane-voice-attachment="true" data-plane-voice-name="${escapeHTML(
    fileName
  )}">Голосовое сообщение</a></div>`;

export const CommentCreate = observer(function CommentCreate(props: TCommentCreate) {
  const {
    workspaceSlug,
    entityId,
    activityOperations,
    showToolbarInitially = false,
    projectId,
    onSubmitCallback,
  } = props;
  // states
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);
  const [voiceDraft, setVoiceDraft] = useState<TVoiceDraft>({ status: "idle", duration: 0 });
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const shouldKeepRecordingRef = useRef(true);
  // store hooks
  const workspaceStore = useWorkspace();
  const { t } = useTranslation();
  // derived values
  const workspaceId = workspaceStore.getWorkspaceBySlug(workspaceSlug)?.id as string;
  // form info
  const {
    handleSubmit,
    control,
    watch,
    formState: { isSubmitting },
    reset,
  } = useForm<Partial<TIssueComment>>({
    defaultValues: {
      comment_html: "<p></p>",
    },
  });

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const stopTimer = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  };

  const clearVoiceDraft = () => {
    if (voiceDraft.previewUrl) URL.revokeObjectURL(voiceDraft.previewUrl);
    shouldKeepRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopTimer();
    stopMediaStream();
    recordingChunksRef.current = [];
    setVoiceDraft({ status: "idle", duration: 0 });
  };

  const startRecording = async () => {
    if (!projectId) {
      setVoiceDraft({ status: "error", duration: 0, errorKey: "issue.comments.voice.errors.issue_only" });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceDraft({ status: "error", duration: 0, errorKey: "issue.comments.voice.errors.unsupported" });
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    if (!mimeType) {
      setVoiceDraft({ status: "error", duration: 0, errorKey: "issue.comments.voice.errors.unsupported" });
      return;
    }

    try {
      clearVoiceDraft();
      shouldKeepRecordingRef.current = true;
      recordingChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stopMediaStream();
        if (!shouldKeepRecordingRef.current) return;

        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        if (!blob.size) {
          setVoiceDraft({ status: "error", duration: 0, errorKey: "issue.comments.voice.errors.empty" });
          return;
        }

        const extension = getVoiceFileExtension(mimeType);
        const file = new File([blob], `voice-message-${new Date().toISOString()}.${extension}`, {
          type: mimeType.split(";")[0],
        });
        const previewUrl = URL.createObjectURL(blob);
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        setVoiceDraft((current) => ({
          status: "preview",
          duration,
          file,
          previewUrl,
          warningKey:
            current.warningKey ??
            (duration >= MAX_RECORDING_DURATION_SECONDS ? "issue.comments.voice.max_duration_reached" : undefined),
        }));
      };

      recordingStartedAtRef.current = Date.now();
      recorder.start();
      setVoiceDraft({ status: "recording", duration: 0 });
      recordingTimerRef.current = setInterval(() => {
        const duration = Math.round((Date.now() - recordingStartedAtRef.current) / 1000);
        if (duration >= MAX_RECORDING_DURATION_SECONDS) {
          setVoiceDraft((current) => ({
            ...current,
            duration: MAX_RECORDING_DURATION_SECONDS,
            warningKey: "issue.comments.voice.max_duration_reached",
          }));
          stopRecording();
          return;
        }

        setVoiceDraft((current) => ({
          ...current,
          duration,
        }));
      }, 500);
    } catch {
      stopTimer();
      stopMediaStream();
      setVoiceDraft({ status: "error", duration: 0, errorKey: "issue.comments.voice.errors.permission" });
    }
  };

  const stopRecording = () => {
    shouldKeepRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  useEffect(
    () => () => {
      if (voiceDraft.previewUrl) URL.revokeObjectURL(voiceDraft.previewUrl);
      stopTimer();
      stopMediaStream();
    },
    [voiceDraft.previewUrl]
  );

  const onSubmit = async (formData: Partial<TIssueComment>) => {
    const voiceFile = voiceDraft.status === "preview" ? voiceDraft.file : undefined;

    try {
      let submitData = formData;
      if (voiceFile && projectId) {
        setVoiceDraft((current) => ({ ...current, status: "uploading" }));
        const attachment = await issueAttachmentService.uploadIssueAttachment(
          workspaceSlug,
          projectId.toString(),
          entityId,
          voiceFile
        );

        submitData = {
          ...submitData,
          comment_html: appendCommentHTML(
            submitData.comment_html ?? "<p></p>",
            buildVoiceMessageHTML(
              attachment.asset_url,
              attachment.attributes.name ?? voiceFile.name,
              voiceDraft.duration
            )
          ),
        };
      }

      const comment = await activityOperations.createComment(submitData);
      if (!comment?.id) {
        if (voiceFile)
          setVoiceDraft((current) => ({
            ...current,
            status: "preview",
            errorKey: "issue.comments.voice.errors.submit",
          }));
        return;
      }

      onSubmitCallback?.(comment.id);
      if (uploadedAssetIds.length > 0) {
        if (projectId) {
          await fileService.updateBulkProjectAssetsUploadStatus(workspaceSlug, projectId.toString(), entityId, {
            asset_ids: uploadedAssetIds,
          });
        } else {
          await fileService.updateBulkWorkspaceAssetsUploadStatus(workspaceSlug, entityId, {
            asset_ids: uploadedAssetIds,
          });
        }
        setUploadedAssetIds([]);
      }

      reset({
        comment_html: "<p></p>",
      });
      editorRef.current?.clearEditor();
      if (voiceFile) clearVoiceDraft();
    } catch (error) {
      console.error(error);
      if (voiceFile)
        setVoiceDraft((current) => ({ ...current, status: "preview", errorKey: "issue.comments.voice.errors.submit" }));
    }
  };

  const commentHTML = watch("comment_html");
  const isVoiceSubmitReady = voiceDraft.status === "preview" && !!voiceDraft.file;
  const isVoiceBusy = voiceDraft.status === "uploading";
  const isEmpty = isCommentEmpty(commentHTML ?? undefined) && !isVoiceSubmitReady;

  return (
    <div
      role="presentation"
      className={cn("sticky bottom-0 z-[4] bg-surface-1 sm:static")}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          !isEmpty &&
          !isSubmitting &&
          editorRef.current?.isEditorReadyToDiscard()
        )
          handleSubmit(onSubmit)(e);
      }}
    >
      <Controller
        name="access"
        control={control}
        render={({ field: { onChange: onAccessChange, value: accessValue } }) => (
          <Controller
            name="comment_html"
            control={control}
            render={({ field: { value, onChange } }) => (
              <LiteTextEditor
                editable
                workspaceId={workspaceId}
                id={"add_comment_" + entityId}
                value={"<p></p>"}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                onEnterKeyPress={(e) => {
                  if (!isEmpty && !isSubmitting) {
                    handleSubmit(onSubmit)(e);
                  }
                }}
                ref={editorRef}
                initialValue={value ?? "<p></p>"}
                containerClassName="min-h-min"
                onChange={(comment_json, comment_html) => onChange(comment_html)}
                accessSpecifier={accessValue ?? EIssueCommentAccessSpecifier.INTERNAL}
                handleAccessChange={onAccessChange}
                isSubmitting={isSubmitting}
                uploadFile={async (blockId, file) => {
                  const { asset_id } = await activityOperations.uploadCommentAsset(blockId, file);
                  setUploadedAssetIds((prev) => [...prev, asset_id]);
                  return asset_id;
                }}
                duplicateFile={async (assetId: string) => {
                  const { asset_id } = await activityOperations.duplicateCommentAsset(assetId);
                  setUploadedAssetIds((prev) => [...prev, asset_id]);
                  return asset_id;
                }}
                showToolbarInitially={showToolbarInitially}
                parentClassName="p-2"
                displayConfig={{
                  fontSize: "small-font",
                }}
              />
            )}
          />
        )}
      />
      <div className="text-xs flex flex-wrap items-center gap-2 px-2 pb-2 text-secondary">
        {voiceDraft.status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            disabled={isSubmitting || isVoiceBusy}
            className="inline-flex items-center gap-1 rounded border border-subtle px-2 py-1 text-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mic className="size-3.5" />
            <span>{t("issue.comments.voice.record")}</span>
          </button>
        )}

        {voiceDraft.status === "recording" && (
          <div className="border-red-500/30 bg-red-500/10 flex max-w-full items-center gap-2 rounded-full border px-2 py-1">
            <span className="text-red-500 inline-flex min-w-0 items-center gap-2 font-medium">
              <span className="bg-red-500 size-2 shrink-0 rounded-full" />
              {t("issue.comments.voice.recording", { duration: formatDuration(voiceDraft.duration) })}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex size-7 items-center justify-center rounded-full bg-accent-primary text-primary hover:bg-accent-primary/80"
              aria-label="Остановить запись"
            >
              <Square className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={clearVoiceDraft}
              className="inline-flex size-7 items-center justify-center rounded-full border border-subtle text-secondary hover:bg-surface-2"
              aria-label={t("issue.comments.voice.cancel")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {["preview", "uploading"].includes(voiceDraft.status) && voiceDraft.previewUrl && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-subtle bg-surface-1 p-2 sm:w-auto">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <Mic className="size-4 shrink-0 text-accent-primary" />
              <audio controls src={voiceDraft.previewUrl} className="h-8 max-w-full min-w-0 sm:w-56">
                <track kind="captions" />
              </audio>
              <span className="shrink-0 text-tertiary">{formatDuration(voiceDraft.duration)}</span>
            </div>
            {voiceDraft.warningKey && <span className="text-amber-600">{t(voiceDraft.warningKey)}</span>}
            {voiceDraft.errorKey && <span className="text-red-600">{t(voiceDraft.errorKey)}</span>}
            {voiceDraft.status === "uploading" && (
              <span className="inline-flex items-center gap-1 text-tertiary">
                <Loader2 className="size-3.5 animate-spin" />
                {t("issue.comments.voice.uploading")}
              </span>
            )}
            {voiceDraft.status === "preview" && (
              <button
                type="button"
                onClick={(e) => handleSubmit(onSubmit)(e)}
                disabled={isSubmitting || isVoiceBusy}
                className="inline-flex items-center gap-1 rounded bg-accent-primary px-2 py-1 text-primary hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="size-3.5" />
                <span>{t("issue.comments.voice.send")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={clearVoiceDraft}
              disabled={isSubmitting || isVoiceBusy}
              className="inline-flex items-center gap-1 rounded border border-subtle px-2 py-1 text-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
              <span>{t("issue.comments.voice.cancel")}</span>
            </button>
          </div>
        )}

        {voiceDraft.status === "error" && voiceDraft.errorKey && (
          <div className="border-red-500/30 bg-red-500/10 text-red-600 flex flex-wrap items-center gap-2 rounded border px-2 py-1">
            <span>{t(voiceDraft.errorKey)}</span>
            <button type="button" onClick={clearVoiceDraft} className="font-medium hover:underline">
              {t("issue.comments.voice.dismiss")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
