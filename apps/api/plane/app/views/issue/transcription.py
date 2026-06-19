# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging

import requests

from django.conf import settings

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission

from .. import BaseAPIView

logger = logging.getLogger("plane")


class IssueVoiceTranscriptionEndpoint(BaseAPIView):
    parser_classes = (MultiPartParser, FormParser)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def post(self, request, slug, project_id, issue_id):
        audio = request.FILES.get("audio")
        if not audio:
            return Response({"error": "Audio file is required."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = getattr(audio, "content_type", "")
        if content_type not in settings.ATTACHMENT_MIME_TYPES or not (
            content_type.startswith("audio/") or content_type == "video/webm"
        ):
            return Response({"error": "Unsupported audio type."}, status=status.HTTP_400_BAD_REQUEST)

        if audio.size > settings.TRANSCRIPTION_UPLOAD_SIZE_LIMIT:
            return Response({"error": "Audio file is too large."}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        if not settings.TRANSCRIPTION_SERVICE_URL or not settings.TRANSCRIPTION_API_TOKEN:
            return Response(
                {"error": "Transcription service is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        audio.file.seek(0)
        try:
            response = requests.post(
                f"{settings.TRANSCRIPTION_SERVICE_URL.rstrip('/')}/v1/transcribe",
                headers={"Authorization": f"Bearer {settings.TRANSCRIPTION_API_TOKEN}"},
                files={"audio": (audio.name, audio.file, content_type)},
                timeout=settings.TRANSCRIPTION_REQUEST_TIMEOUT,
            )
        except requests.RequestException:
            return Response(
                {"error": "Transcription service is unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if response.status_code >= 400:
            logger.warning(
                "Voice transcription service failed",
                extra={
                    "status_code": response.status_code,
                    "response_body": response.text[:500],
                    "content_type": content_type,
                },
            )
            return Response(
                {"error": "Transcription failed. Please try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            payload = response.json()
        except ValueError:
            logger.warning(
                "Voice transcription service returned invalid JSON",
                extra={"status_code": response.status_code, "content_type": content_type},
            )
            return Response(
                {"error": "Transcription service returned an invalid response."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(payload, status=status.HTTP_200_OK)
