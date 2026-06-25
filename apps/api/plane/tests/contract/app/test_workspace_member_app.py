# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.db.models import User, WorkspaceMember


@pytest.mark.contract
class TestWorkspaceMemberAPI:
    @pytest.mark.django_db
    def test_admin_can_update_workspace_member_name(self, session_client, workspace):
        member = User.objects.create(
            email="member-name-edit@plane.so",
            username="member-name-edit",
            first_name="Old",
            last_name="Name",
            display_name="Old Name",
        )
        workspace_member = WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)

        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/members/{workspace_member.id}/",
            {
                "member": {
                    "display_name": "Наталья Иванова",
                    "first_name": "Наталья",
                    "last_name": "Иванова",
                }
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["member"]["display_name"] == "Наталья Иванова"
        assert response.data["member"]["first_name"] == "Наталья"
        assert response.data["member"]["last_name"] == "Иванова"

        member.refresh_from_db()
        assert member.display_name == "Наталья Иванова"
        assert member.first_name == "Наталья"
        assert member.last_name == "Иванова"
