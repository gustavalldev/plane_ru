/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/register";

export const clientLoader = ({ request }: Route.ClientLoaderArgs) => {
  const search = new URL(request.url).search;
  throw redirect(`/${search}`);
};

export default function Register() {
  return null;
}
