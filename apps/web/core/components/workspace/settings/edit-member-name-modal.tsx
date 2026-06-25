/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IUserLite } from "@plane/types";
// plane ui
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
// hooks
import { useMember } from "@/hooks/store/use-member";
// local imports
import type { RowData } from "./member-columns";

type EditMemberNameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  rowData: RowData | null;
  workspaceSlug: string;
};

type TMemberNameForm = Pick<IUserLite, "display_name" | "first_name" | "last_name">;

const defaultNameValues: TMemberNameForm = {
  display_name: "",
  first_name: "",
  last_name: "",
};

export const EditMemberNameModal = observer(function EditMemberNameModal(props: EditMemberNameModalProps) {
  const { isOpen, onClose, rowData, workspaceSlug } = props;
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<TMemberNameForm>({ defaultValues: defaultNameValues });
  const {
    workspace: { updateMember },
  } = useMember();

  useEffect(() => {
    reset({
      display_name: rowData?.member.display_name ?? "",
      first_name: rowData?.member.first_name ?? "",
      last_name: rowData?.member.last_name ?? "",
    });
  }, [reset, rowData]);

  const handleClose = () => {
    reset(defaultNameValues);
    onClose();
  };

  const handleFormSubmit = async (formData: TMemberNameForm) => {
    if (!rowData) return;

    try {
      await updateMember(workspaceSlug, rowData.member.id, {
        member: {
          display_name: formData.display_name.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
        },
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Готово",
        message: "Имя пользователя обновлено.",
      });
      handleClose();
    } catch (err: unknown) {
      const error = err as { error?: string | string[] };
      const errorString = Array.isArray(error?.error) ? error.error[0] : error?.error;

      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Не удалось обновить имя",
        message: errorString ?? "Проверьте поля и попробуйте еще раз.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-h5-medium text-primary">Изменить имя пользователя</h3>
            {rowData?.member.email && (
              <p className="mt-1 text-body-xs-regular text-secondary">{rowData.member.email}</p>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="member-display-name" className="mb-1 block text-body-xs-medium text-secondary">
                Отображаемое имя
              </label>
              <Controller
                control={control}
                name="display_name"
                rules={{ required: "Укажите отображаемое имя." }}
                render={({ field: { value, onChange } }) => (
                  <Input
                    id="member-display-name"
                    value={value}
                    onChange={onChange}
                    hasError={!!errors.display_name}
                    className="w-full"
                    placeholder="Например, Кирилл Петров"
                  />
                )}
              />
              {errors.display_name?.message && (
                <p className="mt-1 text-caption-sm-regular text-danger-primary">{errors.display_name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="member-first-name" className="mb-1 block text-body-xs-medium text-secondary">
                  Имя
                </label>
                <Controller
                  control={control}
                  name="first_name"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      id="member-first-name"
                      value={value}
                      onChange={onChange}
                      className="w-full"
                      placeholder="Имя"
                    />
                  )}
                />
              </div>
              <div>
                <label htmlFor="member-last-name" className="mb-1 block text-body-xs-medium text-secondary">
                  Фамилия
                </label>
                <Controller
                  control={control}
                  name="last_name"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      id="member-last-name"
                      value={value}
                      onChange={onChange}
                      className="w-full"
                      placeholder="Фамилия"
                    />
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-subtle p-4">
          <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            Сохранить
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
