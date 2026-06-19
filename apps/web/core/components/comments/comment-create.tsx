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
import { Loader2, Mic, Square, Trash2, X } from "lucide-react";
import type { TIssueComment, TCommentsOperations } from "@plane/types";
import { cn, isCommentEmpty } from "@plane/utils";
// components
import { LiteTextEditor } from "@/components/editor/lite-text";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
// services
import { FileService } from "@/services/file.service";
import { IssueAttachmentService, IssueTranscriptionService } from "@/services/issue";

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
const issueTranscriptionService = new IssueTranscriptionService();

const VOICE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type TVoiceDraftStatus = "idle" | "recording" | "preview" | "transcribing" | "ready" | "uploading" | "error";

type TVoiceDraft = {
  status: TVoiceDraftStatus;
  duration: number;
  file?: File;
  previewUrl?: string;
  transcript?: string;
  errorKey?: string;
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
    setValue,
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

  const buildTranscriptHTML = (transcript: string) =>
    `<p data-plane-voice-transcript="true"><strong>${escapeHTML(
      t("issue.comments.voice.transcript_label")
    )}:</strong> ${escapeHTML(transcript)}</p>`;

  const buildAudioHTML = (assetUrl: string, fileName: string) =>
    `<p><a href="${escapeHTML(assetUrl)}" data-plane-voice-attachment="true" data-plane-voice-name="${escapeHTML(
      fileName
    )}">${escapeHTML(t("issue.comments.voice.audio_link"))}</a></p>`;

  const insertTranscriptIntoEditor = (transcript: string) => {
    const currentHTML = editorRef.current?.getDocument().html ?? watch("comment_html") ?? "<p></p>";
    const escapedTranscript = escapeHTML(transcript);
    if (currentHTML.includes(escapedTranscript)) return;

    const nextHTML = appendCommentHTML(currentHTML, buildTranscriptHTML(transcript));
    editorRef.current?.setEditorValue(nextHTML);
    setValue("comment_html", nextHTML, { shouldDirty: true });
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
        setVoiceDraft({ status: "preview", duration, file, previewUrl });
      };

      recordingStartedAtRef.current = Date.now();
      recorder.start();
      setVoiceDraft({ status: "recording", duration: 0 });
      recordingTimerRef.current = setInterval(() => {
        setVoiceDraft((current) => ({
          ...current,
          duration: Math.round((Date.now() - recordingStartedAtRef.current) / 1000),
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

  const transcribeRecording = async () => {
    if (!voiceDraft.file || !projectId) return;
    setVoiceDraft((current) => ({ ...current, status: "transcribing", errorKey: undefined }));
    try {
      const response = await issueTranscriptionService.transcribeIssueCommentAudio(
        workspaceSlug,
        projectId.toString(),
        entityId,
        voiceDraft.file
      );
      const transcript = response.text.trim();
      if (!transcript) {
        setVoiceDraft((current) => ({
          ...current,
          status: "error",
          errorKey: "issue.comments.voice.errors.empty_transcript",
        }));
        return;
      }
      insertTranscriptIntoEditor(transcript);
      setVoiceDraft((current) => ({ ...current, status: "ready", transcript }));
    } catch {
      setVoiceDraft((current) => ({ ...current, status: "error", errorKey: "issue.comments.voice.errors.transcribe" }));
    }
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
    const voiceFile = voiceDraft.status === "ready" ? voiceDraft.file : undefined;
    const voiceTranscript = voiceDraft.status === "ready" ? voiceDraft.transcript : undefined;

    try {
      let submitData = formData;
      if (voiceFile && voiceTranscript && projectId) {
        setVoiceDraft((current) => ({ ...current, status: "uploading" }));
        const attachment = await issueAttachmentService.uploadIssueAttachment(
          workspaceSlug,
          projectId.toString(),
          entityId,
          voiceFile
        );

        const currentHTML = submitData.comment_html ?? "<p></p>";
        const escapedTranscript = escapeHTML(voiceTranscript);
        const htmlWithTranscript = currentHTML.includes(escapedTranscript)
          ? currentHTML
          : appendCommentHTML(currentHTML, buildTranscriptHTML(voiceTranscript));
        submitData = {
          ...submitData,
          comment_html: appendCommentHTML(
            htmlWithTranscript,
            buildAudioHTML(attachment.asset_url, attachment.attributes.name ?? voiceFile.name)
          ),
        };
      }

      const comment = await activityOperations.createComment(submitData);
      if (comment?.id) onSubmitCallback?.(comment.id);
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
      if (voiceFile) clearVoiceDraft();
    } catch (error) {
      console.error(error);
    } finally {
      reset({
        comment_html: "<p></p>",
      });
      editorRef.current?.clearEditor();
    }
  };

  const commentHTML = watch("comment_html");
  const isVoiceSubmitReady = voiceDraft.status === "ready" && !!voiceDraft.file && !!voiceDraft.transcript;
  const isVoiceBusy = voiceDraft.status === "transcribing" || voiceDraft.status === "uploading";
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-red-500 inline-flex items-center gap-2 font-medium">
              <span className="bg-red-500 size-2 rounded-full" />
              {t("issue.comments.voice.recording", { duration: formatDuration(voiceDraft.duration) })}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1 rounded border border-subtle px-2 py-1 text-secondary hover:bg-surface-2"
            >
              <Square className="size-3.5" />
              <span>{t("issue.comments.voice.stop")}</span>
            </button>
            <button
              type="button"
              onClick={clearVoiceDraft}
              className="inline-flex items-center gap-1 rounded border border-subtle px-2 py-1 text-secondary hover:bg-surface-2"
            >
              <X className="size-3.5" />
              <span>{t("issue.comments.voice.cancel")}</span>
            </button>
          </div>
        )}

        {["preview", "transcribing", "ready", "uploading"].includes(voiceDraft.status) && voiceDraft.previewUrl && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded border border-subtle bg-surface-1 p-2">
            <audio controls src={voiceDraft.previewUrl} className="h-8 max-w-full">
              <track kind="captions" />
            </audio>
            <span className="text-tertiary">{formatDuration(voiceDraft.duration)}</span>
            {voiceDraft.status === "preview" && (
              <button
                type="button"
                onClick={transcribeRecording}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 rounded bg-accent-primary px-2 py-1 text-primary hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mic className="size-3.5" />
                <span>{t("issue.comments.voice.transcribe")}</span>
              </button>
            )}
            {(voiceDraft.status === "transcribing" || voiceDraft.status === "uploading") && (
              <span className="inline-flex items-center gap-1 text-tertiary">
                <Loader2 className="size-3.5 animate-spin" />
                {voiceDraft.status === "transcribing"
                  ? t("issue.comments.voice.transcribing")
                  : t("issue.comments.voice.uploading")}
              </span>
            )}
            {voiceDraft.status === "ready" && (
              <span className="text-green-600 font-medium">{t("issue.comments.voice.ready")}</span>
            )}
            {voiceDraft.status === "ready" && (
              <button
                type="button"
                onClick={(e) => handleSubmit(onSubmit)(e)}
                disabled={isSubmitting || isVoiceBusy}
                className="inline-flex items-center gap-1 rounded bg-accent-primary px-2 py-1 text-primary hover:bg-accent-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mic className="size-3.5" />
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
