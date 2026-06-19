import { useEffect, useReducer, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, Mic, Pause, Play } from "lucide-react";
// plane imports
import type { TCommentsOperations, TIssueComment } from "@plane/types";
import { cn, getFileURL } from "@plane/utils";
// services
import { IssueTranscriptionService } from "@/services/issue";
// local imports
import { appendVoiceTranscriptToCommentHTML } from "./voice-message.helpers";
import type { TVoiceAttachment } from "./voice-message.helpers";

const issueTranscriptionService = new IssueTranscriptionService();

const VOICE_WAVEFORM_BARS = [
  { id: "a", height: 12 },
  { id: "b", height: 18 },
  { id: "c", height: 26 },
  { id: "d", height: 16 },
  { id: "e", height: 30 },
  { id: "f", height: 22 },
  { id: "g", height: 14 },
  { id: "h", height: 24 },
  { id: "i", height: 18 },
  { id: "j", height: 28 },
  { id: "k", height: 16 },
  { id: "l", height: 20 },
  { id: "m", height: 12 },
  { id: "n", height: 26 },
  { id: "o", height: 18 },
  { id: "p", height: 14 },
];

const formatVoiceDuration = (duration: number | undefined) => {
  if (!duration || Number.isNaN(duration)) return "00:00";
  const minutes = Math.floor(duration / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

type TVoiceMessageBubbleProps = {
  activityOperations: TCommentsOperations;
  attachment: TVoiceAttachment;
  comment: TIssueComment;
  entityId: string;
  projectId?: string;
  workspaceSlug: string;
};

type TVoiceMessageBubbleState = {
  isPlaying: boolean;
  duration?: number;
  transcript?: string;
  isTranscriptOpen: boolean;
  isTranscribing: boolean;
  transcriptionError?: string;
};

const voiceMessageBubbleReducer = (
  state: TVoiceMessageBubbleState,
  action: Partial<TVoiceMessageBubbleState>
): TVoiceMessageBubbleState => ({ ...state, ...action });

export const VoiceMessageBubble = (props: TVoiceMessageBubbleProps) => {
  const { activityOperations, attachment, comment, entityId, projectId, workspaceSlug } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useReducer(voiceMessageBubbleReducer, {
    isPlaying: false,
    duration: attachment.duration,
    transcript: attachment.transcript,
    isTranscriptOpen: false,
    isTranscribing: false,
    transcriptionError: undefined,
  });

  useEffect(() => {
    setState({ transcript: attachment.transcript });
  }, [attachment.transcript]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.isPlaying) {
      audio.pause();
      setState({ isPlaying: false });
      return;
    }

    try {
      await audio.play();
      setState({ isPlaying: true });
    } catch {
      setState({ isPlaying: false });
    }
  };

  const handleTranscriptToggle = async () => {
    if (state.transcript) {
      setState({ isTranscriptOpen: !state.isTranscriptOpen });
      return;
    }

    if (!projectId) {
      setState({ transcriptionError: "Расшифровка доступна только в задаче проекта." });
      return;
    }

    setState({ isTranscribing: true, transcriptionError: undefined });
    try {
      const audioUrl = getFileURL(attachment.url);
      if (!audioUrl) throw new Error("Audio URL unavailable");

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error("Audio fetch failed");

      const audioBlob = await audioResponse.blob();
      const audioFile = new File([audioBlob], attachment.name ?? "voice-message.webm", {
        type: audioBlob.type || "audio/webm",
      });
      const response = await issueTranscriptionService.transcribeIssueCommentAudio(
        workspaceSlug,
        projectId.toString(),
        entityId,
        audioFile
      );
      const nextTranscript = response.text.trim();
      if (!nextTranscript) {
        setState({ transcriptionError: "Не удалось распознать речь в записи." });
        return;
      }

      setState({ transcript: nextTranscript, isTranscriptOpen: true });
      await activityOperations.updateComment(comment.id, {
        comment_html: appendVoiceTranscriptToCommentHTML(comment.comment_html, nextTranscript, attachment),
      });
    } catch {
      setState({ transcriptionError: "Не удалось расшифровать запись. Попробуйте позже." });
    } finally {
      setState({ isTranscribing: false });
    }
  };

  return (
    <div className="flex max-w-full flex-col gap-2 rounded-lg border border-subtle bg-surface-1 p-3 sm:max-w-xl">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-primary text-primary hover:bg-accent-primary/80"
          aria-label={state.isPlaying ? "Пауза" : "Воспроизвести"}
        >
          {state.isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1" aria-hidden="true">
          {VOICE_WAVEFORM_BARS.map((bar) => (
            <span
              key={bar.id}
              className={cn("w-1 rounded-full bg-accent-primary/70", state.isPlaying && "bg-accent-primary")}
              style={{ height: bar.height }}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-caption-sm-medium text-secondary">
          <Mic className="size-3.5" />
          <span>{formatVoiceDuration(state.duration)}</span>
        </div>
        <audio
          ref={audioRef}
          src={getFileURL(attachment.url)}
          preload="metadata"
          className="hidden"
          aria-label="Голосовое сообщение"
          onLoadedMetadata={(event) => {
            if (!state.duration) setState({ duration: Math.round(event.currentTarget.duration) });
          }}
          onEnded={() => setState({ isPlaying: false })}
          onPause={() => setState({ isPlaying: false })}
        >
          <track kind="captions" />
        </audio>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleTranscriptToggle}
          disabled={state.isTranscribing}
          className="inline-flex items-center gap-1 rounded border border-subtle px-2 py-1 text-caption-sm-medium text-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.isTranscribing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Распознаём...</span>
            </>
          ) : state.transcript ? (
            <>
              {state.isTranscriptOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              <span>{state.isTranscriptOpen ? "Скрыть расшифровку" : "Показать расшифровку"}</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              <span>Расшифровать</span>
            </>
          )}
        </button>
        {state.transcriptionError && (
          <span className="text-red-600 text-caption-sm-regular">{state.transcriptionError}</span>
        )}
      </div>
      {state.transcript && state.isTranscriptOpen && (
        <div className="text-sm rounded border border-subtle bg-surface-2 px-3 py-2 text-secondary">
          {state.transcript}
        </div>
      )}
    </div>
  );
};
