/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TGroupedIssues, TIssueMap, TSubGroupedIssues } from "@plane/types";

const isIssueIdList = (value: unknown): value is string[] => Array.isArray(value);

const collectIssueIds = (groupedIssueIds: TGroupedIssues | TSubGroupedIssues): Set<string> => {
  const issueIds = new Set<string>();

  for (const value of Object.values(groupedIssueIds)) {
    if (isIssueIdList(value)) {
      value.forEach((issueId) => issueIds.add(issueId));
    } else {
      for (const subGroupIssueIds of Object.values(value as TGroupedIssues)) {
        subGroupIssueIds.forEach((issueId) => issueIds.add(issueId));
      }
    }
  }

  return issueIds;
};

const hasVisibleAncestor = (issueId: string, visibleIssueIds: Set<string>, issuesMap: TIssueMap): boolean => {
  const visited = new Set<string>();
  let parentId = issuesMap[issueId]?.parent_id;

  while (parentId) {
    if (visibleIssueIds.has(parentId)) return true;
    if (visited.has(parentId)) return false;

    visited.add(parentId);
    parentId = issuesMap[parentId]?.parent_id;
  }

  return false;
};

export const filterModuleTopLevelIssueIds = (
  issueIds: string[],
  issuesMap: TIssueMap,
  allModuleIssueIds: Set<string> = new Set(issueIds)
): string[] => issueIds.filter((issueId) => !hasVisibleAncestor(issueId, allModuleIssueIds, issuesMap));

export const filterModuleGroupedIssueIds = <T extends TGroupedIssues | TSubGroupedIssues>(
  groupedIssueIds: T,
  issuesMap: TIssueMap
): T => {
  const allModuleIssueIds = collectIssueIds(groupedIssueIds);
  const filteredGroupedIssueIds = {} as T;

  for (const [groupId, value] of Object.entries(groupedIssueIds)) {
    if (isIssueIdList(value)) {
      filteredGroupedIssueIds[groupId as keyof T] = filterModuleTopLevelIssueIds(
        value,
        issuesMap,
        allModuleIssueIds
      ) as T[keyof T];
    } else {
      const subGroupedIssueIds = value as TGroupedIssues;

      filteredGroupedIssueIds[groupId as keyof T] = Object.fromEntries(
        Object.entries(subGroupedIssueIds).map(([subGroupId, issueIds]) => [
          subGroupId,
          filterModuleTopLevelIssueIds(issueIds, issuesMap, allModuleIssueIds),
        ])
      ) as T[keyof T];
    }
  }

  return filteredGroupedIssueIds;
};
