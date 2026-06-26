/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// hooks
// components
import { cn } from "@plane/utils";
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
// ui
// helpers
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// types
import type { TIssueOperations } from "./root";

type TIssueModuleSelect = {
  className?: string;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled?: boolean;
};

export const IssueModuleSelect = observer(function IssueModuleSelect(props: TIssueModuleSelect) {
  const { className = "", workspaceSlug, projectId, issueId, issueOperations, disabled = false } = props;
  const { t } = useTranslation();
  // states
  const [isUpdating, setIsUpdating] = useState(false);
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);
  const directModuleIds = issue?.module_ids ?? [];
  const inheritedModuleIds = (() => {
    if (!issue || directModuleIds.length > 0) return [];

    const visitedIssueIds = new Set<string>();
    let parentId = issue.parent_id ?? issue.parent?.id;

    while (parentId) {
      if (visitedIssueIds.has(parentId)) return [];

      visitedIssueIds.add(parentId);
      const parentIssue = getIssueById(parentId);
      const parentModuleIds =
        parentIssue?.module_ids ?? (issue.parent?.id === parentId ? issue.parent.module_ids : null);

      if (parentModuleIds?.length) return parentModuleIds;

      parentId = parentIssue?.parent_id ?? parentIssue?.parent?.id;
    }

    return [];
  })();
  const displayedModuleIds = directModuleIds.length > 0 ? directModuleIds : inheritedModuleIds;
  const disableSelect = disabled || isUpdating;

  const handleIssueModuleChange = async (moduleIds: string[]) => {
    if (!issue) return;

    setIsUpdating(true);
    const selectedModuleIds = moduleIds.filter(
      (moduleId) => directModuleIds.includes(moduleId) || !inheritedModuleIds.includes(moduleId)
    );
    const updatedModuleIds = xor(directModuleIds, selectedModuleIds);
    const modulesToAdd: string[] = [];
    const modulesToRemove: string[] = [];

    for (const moduleId of updatedModuleIds) {
      if (directModuleIds.includes(moduleId)) {
        modulesToRemove.push(moduleId);
      } else {
        modulesToAdd.push(moduleId);
      }
    }

    await issueOperations.changeModulesInIssue?.(workspaceSlug, projectId, issueId, modulesToAdd, modulesToRemove);

    setIsUpdating(false);
  };

  return (
    <div className={cn(`flex h-full items-center gap-1`, className)}>
      <ModuleDropdown
        projectId={projectId}
        value={displayedModuleIds}
        onChange={handleIssueModuleChange}
        placeholder={t("module.no_module")}
        disabled={disableSelect}
        className="group h-full w-full"
        buttonContainerClassName="w-full text-left rounded-sm"
        buttonClassName={`text-body-xs-medium justify-between ${displayedModuleIds.length ? "" : "text-placeholder"}`}
        buttonVariant="transparent-with-text"
        hideIcon
        dropdownArrow
        dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
        multiple
        itemClassName="px-2"
      />
    </div>
  );
});
