/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TTranslationStore } from "@plane/i18n";
import { replaceUnderscoreIfSnakeCase } from "@plane/utils";
import type { TNotificationContentMap } from "@/components/workspace-notifications/sidebar/notification-card/content";

type TNotificationTranslator = TTranslationStore["t"];

// Additional notification content map for CE (empty - EE extends this)
export const ADDITIONAL_NOTIFICATION_CONTENT_MAP: TNotificationContentMap = {};

const FALLBACK_VERB_TRANSLATION_KEYS: Record<string, string> = {
  created: "notification.card.fallback.verbs.created",
  updated: "notification.card.fallback.verbs.updated",
  deleted: "notification.card.fallback.verbs.deleted",
};

const FALLBACK_FIELD_TRANSLATION_KEYS: Record<string, string> = {
  attachment: "notification.card.fallback.fields.attachment",
  cycle: "notification.card.fallback.fields.cycle",
  cycle_id: "notification.card.fallback.fields.cycle",
  description: "notification.card.fallback.fields.description",
  estimate: "notification.card.fallback.fields.estimate",
  estimate_point: "notification.card.fallback.fields.estimate",
  estimate_time: "notification.card.fallback.fields.estimate",
  link: "notification.card.fallback.fields.link",
  module: "notification.card.fallback.fields.module",
  module_id: "notification.card.fallback.fields.module",
  name: "notification.card.fallback.fields.name",
  priority: "notification.card.fallback.fields.priority",
  state: "notification.card.fallback.fields.state",
  state_id: "notification.card.fallback.fields.state",
};

const getTranslatedFallbackVerb = (verb: string | undefined, t: TNotificationTranslator) => {
  if (!verb) return "";

  const translationKey = FALLBACK_VERB_TRANSLATION_KEYS[verb];
  return translationKey ? t(translationKey) : verb;
};

const getTranslatedFallbackField = (notificationField: string, t: TNotificationTranslator) => {
  const translationKey = FALLBACK_FIELD_TRANSLATION_KEYS[notificationField];
  return translationKey ? t(translationKey) : replaceUnderscoreIfSnakeCase(notificationField);
};

// Fallback action renderer for fields not in the map
export const renderAdditionalAction = (
  notificationField: string,
  verb: string | undefined,
  t: TNotificationTranslator
) => {
  const baseAction = !["comment", "archived_at"].includes(notificationField) ? getTranslatedFallbackVerb(verb, t) : "";
  const field = getTranslatedFallbackField(notificationField, t);

  return [baseAction, field].filter(Boolean).join(" ");
};

// Fallback value renderer for fields not in the map
export const renderAdditionalValue = (
  _notificationField: string | undefined,
  newValue: string | undefined,
  _oldValue: string | undefined
) => newValue;

export const shouldShowConnector = (notificationField: string | undefined) =>
  !["comment", "archived_at", "None", "assignees", "labels", "start_date", "target_date", "parent"].includes(
    notificationField || ""
  );

export const shouldRender = (notificationField: string | undefined, verb: string | undefined) => verb !== "deleted";
