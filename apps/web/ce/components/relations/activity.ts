/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueActivity } from "@plane/types";

export const getRelationActivityContent = (activity: TIssueActivity | undefined): string | undefined => {
  if (!activity) return;

  switch (activity.field) {
    case "blocking":
      return activity.old_value === ""
        ? `отметил(а), что эта задача блокирует `
        : `удалил(а) блокируемую задачу `;
    case "blocked_by":
      return activity.old_value === ""
        ? `отметил(а), что эта задача заблокирована задачей `
        : `удалил(а) связь с блокирующей задачей `;
    case "duplicate":
      return activity.old_value === ""
        ? `отметил(а) эту задачу как дубликат `
        : `удалил(а) связь с дубликатом `;
    case "relates_to":
      return activity.old_value === "" ? `связал(а) эту задачу с ` : `удалил(а) связь с `;
  }

  return;
};
