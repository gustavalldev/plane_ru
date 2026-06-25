/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useParams, useRouter } from "next/navigation";
import { EUserPermissionsLevel, EPageAccess } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TPage, TPageNavigationTabs } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// components
import { PageLoader } from "@/components/pages/loaders/page-loader";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";

type Props = {
  children: React.ReactNode;
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

const PAGES_EMPTY_STATE_LAYOUT_PROPS = {
  rootClassName: "items-start px-3 pt-8 sm:items-center sm:px-0 sm:pt-0",
  className: "h-auto max-w-[22rem] justify-start gap-4 sm:h-full sm:max-w-[25rem] sm:justify-center sm:gap-6",
  assetClassName: "h-auto w-28 sm:w-40",
} as const;

export const PagesListMainContent = observer(function PagesListMainContent(props: Props) {
  const { children, pageType, storeType } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { currentProjectDetails } = useProject();
  const { isAnyPageAvailable, getCurrentProjectFilteredPageIdsByTab, getCurrentProjectPageIdsByTab, loader } =
    usePageStore(storeType);
  const { allowPermissions } = useUserPermissions();
  const { createPage } = usePageStore(EPageStoreType.PROJECT);
  // states
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  // router
  const router = useRouter();
  const { workspaceSlug } = useParams();
  // derived values
  const pageIds = getCurrentProjectPageIdsByTab(pageType);
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);
  const canPerformEmptyStateActions = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  // handle page create
  const handleCreatePage = async () => {
    setIsCreatingPage(true);

    const payload: Partial<TPage> = {
      access: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
    };

    try {
      const res = await createPage(payload);
      const pageId = `/${workspaceSlug}/projects/${currentProjectDetails?.id}/pages/${res?.id}`;
      router.push(pageId);
    } catch (err) {
      const error = err as { data?: { error?: string } };

      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.toast.error"),
        message: error?.data?.error || t("wiki_collections.toasts.create_page_error"),
      });
    } finally {
      setIsCreatingPage(false);
    }
  };

  const renderPagesEmptyState = () => (
    <EmptyStateDetailed
      assetKey="page"
      title={t("project_empty_state.pages.title")}
      description={t("project_empty_state.pages.description")}
      {...PAGES_EMPTY_STATE_LAYOUT_PROPS}
      actions={[
        {
          label: t("project_empty_state.pages.cta_primary"),
          onClick: () => {
            handleCreatePage();
          },
          variant: "primary",
          disabled: !canPerformEmptyStateActions || isCreatingPage,
          className: "self-start px-4",
        },
      ]}
    />
  );

  if (loader === "init-loader") return <PageLoader />;
  // if no pages exist in the active page type
  if (!isAnyPageAvailable || pageIds?.length === 0) {
    if (!isAnyPageAvailable) return renderPagesEmptyState();
    if (pageType === "public") return renderPagesEmptyState();
    if (pageType === "private") return renderPagesEmptyState();
    if (pageType === "archived")
      return (
        <EmptyStateDetailed
          assetKey="page"
          title={t("project_empty_state.archive_pages.title")}
          description={t("project_empty_state.archive_pages.description")}
          {...PAGES_EMPTY_STATE_LAYOUT_PROPS}
        />
      );
  }
  // if no pages match the filter criteria
  if (filteredPageIds?.length === 0)
    return (
      <EmptyStateDetailed
        assetKey="search"
        title={t("common_empty_state.search.title")}
        description={t("common_empty_state.search.description")}
      />
    );

  return <div className="h-full w-full overflow-hidden">{children}</div>;
});
