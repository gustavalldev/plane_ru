/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TIssueVoiceTranscription = {
  text: string;
  language?: string;
  duration?: number | null;
  segments?: {
    start: number;
    end: number;
    text: string;
  }[];
};

export class IssueTranscriptionService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async transcribeIssueCommentAudio(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    file: File
  ): Promise<TIssueVoiceTranscription> {
    const formData = new FormData();
    formData.append("audio", file);

    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/voice-transcription/`,
      formData
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data ?? error;
      });
  }
}
