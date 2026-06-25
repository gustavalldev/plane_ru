/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { PageHead } from "@/components/core/page-title";
import { EAuthModes } from "@/helpers/authentication.helper";

const authContentMap = {
  [EAuthModes.SIGN_IN]: {
    pageTitle: "Вход",
  },
  [EAuthModes.SIGN_UP]: {
    pageTitle: "Регистрация",
  },
};

type AuthHeaderProps = {
  type: EAuthModes;
};

export const AuthHeader = observer(function AuthHeader({ type }: AuthHeaderProps) {
  return <AuthHeaderBase pageTitle={authContentMap[type].pageTitle} />;
});

type TAuthHeaderBase = {
  pageTitle: string;
  additionalAction?: React.ReactNode;
};

export function AuthHeaderBase(props: TAuthHeaderBase) {
  const { pageTitle, additionalAction } = props;
  return (
    <>
      <PageHead title={pageTitle + " - LeadUp"} />
      <div className="sticky top-0 flex w-full flex-shrink-0 items-center justify-between gap-6">
        <Link href="/" className="text-18 font-semibold text-primary">
          LeadUp
        </Link>
        {additionalAction}
      </div>
    </>
  );
}
