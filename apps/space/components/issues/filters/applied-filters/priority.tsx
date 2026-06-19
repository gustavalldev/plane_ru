/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CloseIcon, PriorityIcon } from "@plane/propel/icons";
import type { TIssuePriorities } from "@plane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { getIssuePriorityFilters } from "@plane/utils";

type Props = {
  handleRemove: (val: string) => void;
  values: TIssuePriorities[];
};

export function AppliedPriorityFilters(props: Props) {
  const { handleRemove, values } = props;
  const { t } = useTranslation();

  return (
    <>
      {values?.map((priority) => {
        const priorityDetails = getIssuePriorityFilters(priority);

        return (
          <div key={priority} className="flex items-center gap-1 rounded-sm bg-layer-3 p-1 text-11">
            <PriorityIcon priority={priority} className={`h-3 w-3`} />
            {priorityDetails ? t(priorityDetails.titleTranslationKey) : priority}
            <button
              type="button"
              className="grid place-items-center text-tertiary hover:text-secondary"
              onClick={() => handleRemove(priority)}
            >
              <CloseIcon height={10} width={10} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </>
  );
}
