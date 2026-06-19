/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { useTranslation } from "@plane/i18n";
import type { IWebhook } from "@plane/types";
import { Checkbox } from "@plane/ui";

export const INDIVIDUAL_WEBHOOK_OPTIONS: {
  key: keyof IWebhook;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    key: "project",
    labelKey: "workspace_settings.settings.webhooks.events.projects.label",
    descriptionKey: "workspace_settings.settings.webhooks.events.projects.description",
  },
  {
    key: "cycle",
    labelKey: "workspace_settings.settings.webhooks.events.cycles.label",
    descriptionKey: "workspace_settings.settings.webhooks.events.cycles.description",
  },
  {
    key: "issue",
    labelKey: "workspace_settings.settings.webhooks.events.work_items.label",
    descriptionKey: "workspace_settings.settings.webhooks.events.work_items.description",
  },
  {
    key: "module",
    labelKey: "workspace_settings.settings.webhooks.events.modules.label",
    descriptionKey: "workspace_settings.settings.webhooks.events.modules.description",
  },
  {
    key: "issue_comment",
    labelKey: "workspace_settings.settings.webhooks.events.work_item_comments.label",
    descriptionKey: "workspace_settings.settings.webhooks.events.work_item_comments.description",
  },
];

type Props = {
  control: Control<IWebhook, any>;
};

export function WebhookIndividualEventOptions({ control }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
      {INDIVIDUAL_WEBHOOK_OPTIONS.map((option) => (
        <Controller
          key={option.key}
          control={control}
          name={option.key}
          render={({ field: { onChange, value } }) => (
            <div>
              <div className="flex items-center gap-2">
                <Checkbox id={option.key} onChange={() => onChange(!value)} checked={value === true} />
                <label className="text-13" htmlFor={option.key}>
                  {t(option.labelKey)}
                </label>
              </div>
              <p className="mt-0.5 ml-6 text-11 text-tertiary">{t(option.descriptionKey)}</p>
            </div>
          )}
        />
      ))}
    </div>
  );
}
