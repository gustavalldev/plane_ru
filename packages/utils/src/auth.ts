/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane imports
import type { TAuthErrorInfo } from "@plane/constants";
import { E_PASSWORD_STRENGTH, EErrorAlertType, EAuthErrorCodes } from "@plane/constants";

/**
 * @description Password strength levels
 */
export enum PasswordStrength {
  EMPTY = "empty",
  WEAK = "weak",
  FAIR = "fair",
  GOOD = "good",
  STRONG = "strong",
}

/**
 * Calculate password strength based on various criteria
 */
export const getPasswordStrength = (password: string): E_PASSWORD_STRENGTH => {
  if (!password || password === "" || password.length <= 0) {
    return E_PASSWORD_STRENGTH.EMPTY;
  }

  if (password.length < 8) {
    return E_PASSWORD_STRENGTH.LENGTH_NOT_VALID;
  }

  // Check all criteria
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()\-_+=[\]{}|;:'",.<>?/]/.test(password);

  if (hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar) {
    return E_PASSWORD_STRENGTH.STRENGTH_VALID;
  }

  return E_PASSWORD_STRENGTH.STRENGTH_NOT_VALID;
};

export type PasswordCriteria = {
  key: string;
  label: string;
  isValid: boolean;
};

/**
 * Get password criteria for validation display
 */
export const getPasswordCriteria = (password: string): PasswordCriteria[] => [
  {
    key: "length",
    label: "Минимум 8 символов",
    isValid: password.length >= 8,
  },
  {
    key: "uppercase",
    label: "Минимум 1 заглавная буква",
    isValid: /[A-Z]/.test(password),
  },
  {
    key: "lowercase",
    label: "Минимум 1 строчная буква",
    isValid: /[a-z]/.test(password),
  },
  {
    key: "number",
    label: "Минимум 1 цифра",
    isValid: /[0-9]/.test(password),
  },
  {
    key: "special",
    label: "Минимум 1 специальный символ",
    isValid: /[!@#$%^&*()\-_+=[\]{}|;:'",.<>?/]/.test(password),
  },
];

// Error code messages
const errorCodeMessages: {
  [key in EAuthErrorCodes]: { title: string; message: (email?: string) => ReactNode };
} = {
  // global
  [EAuthErrorCodes.INSTANCE_NOT_CONFIGURED]: {
    title: `Сервер не настроен`,
    message: () => `Сервер не настроен. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.SIGNUP_DISABLED]: {
    title: `Регистрация отключена`,
    message: () => `Регистрация отключена. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.INVALID_PASSWORD]: {
    title: `Некорректный пароль`,
    message: () => `Некорректный пароль. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.PASSWORD_TOO_WEAK]: {
    title: `Слишком слабый пароль`,
    message: () => `Используйте более надежный пароль.`,
  },
  [EAuthErrorCodes.SMTP_NOT_CONFIGURED]: {
    title: `SMTP не настроен`,
    message: () => `SMTP не настроен. Обратитесь к администратору.`,
  },
  // email check in both sign up and sign in
  [EAuthErrorCodes.INVALID_EMAIL]: {
    title: `Некорректный email`,
    message: () => `Некорректный email. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EMAIL_REQUIRED]: {
    title: `Email обязателен`,
    message: () => `Введите email и попробуйте еще раз.`,
  },
  // sign up
  [EAuthErrorCodes.USER_ALREADY_EXIST]: {
    title: `Пользователь уже существует`,
    message: () => `Аккаунт уже зарегистрирован. Войдите в систему.`,
  },
  [EAuthErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP]: {
    title: `Email и пароль обязательны`,
    message: () => `Введите email и пароль, затем попробуйте еще раз.`,
  },
  [EAuthErrorCodes.AUTHENTICATION_FAILED_SIGN_UP]: {
    title: `Ошибка авторизации`,
    message: () => `Не удалось авторизоваться. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_EMAIL_SIGN_UP]: {
    title: `Некорректный email`,
    message: () => `Некорректный email. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED]: {
    title: `Email и код обязательны`,
    message: () => `Введите email и код, затем попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP]: {
    title: `Некорректный email`,
    message: () => `Некорректный email. Попробуйте еще раз.`,
  },
  // sign in
  [EAuthErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    title: `Аккаунт деактивирован`,
    message: () => `Аккаунт деактивирован. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.USER_DOES_NOT_EXIST]: {
    title: `Пользователь не найден`,
    message: () => `Пользователь с такой почтой не найден. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN]: {
    title: `Email и пароль обязательны`,
    message: () => `Введите email и пароль, затем попробуйте еще раз.`,
  },
  [EAuthErrorCodes.AUTHENTICATION_FAILED_SIGN_IN]: {
    title: `Ошибка входа`,
    message: () => `Не удалось войти. Проверьте данные и попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_EMAIL_SIGN_IN]: {
    title: `Некорректный email`,
    message: () => `Некорректный email. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED]: {
    title: `Email и код обязательны`,
    message: () => `Введите email и код, затем попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN]: {
    title: `Некорректный email`,
    message: () => `Некорректный email. Попробуйте еще раз.`,
  },
  // Both Sign in and Sign up
  [EAuthErrorCodes.INVALID_MAGIC_CODE_SIGN_IN]: {
    title: `Ошибка входа`,
    message: () => `Некорректный код. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_MAGIC_CODE_SIGN_UP]: {
    title: `Ошибка входа`,
    message: () => `Некорректный код. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN]: {
    title: `Код истек`,
    message: () => `Срок действия кода истек. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP]: {
    title: `Код истек`,
    message: () => `Срок действия кода истек. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN]: {
    title: `Код истек`,
    message: () => `Срок действия кода истек. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP]: {
    title: `Код истек`,
    message: () => `Срок действия кода истек. Попробуйте еще раз.`,
  },
  // Oauth
  [EAuthErrorCodes.OAUTH_NOT_CONFIGURED]: {
    title: `OAuth не настроен`,
    message: () => `OAuth не настроен. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.GOOGLE_NOT_CONFIGURED]: {
    title: `Google не настроен`,
    message: () => `Google не настроен. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.GITHUB_NOT_CONFIGURED]: {
    title: `GitHub не настроен`,
    message: () => `GitHub не настроен. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.GITLAB_NOT_CONFIGURED]: {
    title: `GitLab не настроен`,
    message: () => `GitLab не настроен. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: {
    title: `Ошибка Google OAuth`,
    message: () => `Ошибка провайдера Google OAuth. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR]: {
    title: `Ошибка GitHub OAuth`,
    message: () => `Ошибка провайдера GitHub OAuth. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR]: {
    title: `Ошибка GitLab OAuth`,
    message: () => `Ошибка провайдера GitLab OAuth. Попробуйте еще раз.`,
  },
  // Reset Password
  [EAuthErrorCodes.INVALID_PASSWORD_TOKEN]: {
    title: `Некорректная ссылка`,
    message: () => `Ссылка для восстановления пароля некорректна. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.EXPIRED_PASSWORD_TOKEN]: {
    title: `Ссылка истекла`,
    message: () => `Срок действия ссылки истек. Запросите восстановление пароля заново.`,
  },
  // Change password
  [EAuthErrorCodes.MISSING_PASSWORD]: {
    title: `Пароль обязателен`,
    message: () => `Введите пароль и попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INCORRECT_OLD_PASSWORD]: {
    title: `Некорректный старый пароль`,
    message: () => `Старый пароль указан неверно. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_NEW_PASSWORD]: {
    title: `Некорректный новый пароль`,
    message: () => `Новый пароль некорректен. Попробуйте еще раз.`,
  },
  // set password
  [EAuthErrorCodes.PASSWORD_ALREADY_SET]: {
    title: `Пароль уже задан`,
    message: () => `Пароль уже задан. Попробуйте войти в систему.`,
  },
  // admin
  [EAuthErrorCodes.ADMIN_ALREADY_EXIST]: {
    title: `Администратор уже существует`,
    message: () => `Администратор уже существует. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    title: `Заполните обязательные поля`,
    message: () => `Email, пароль и имя обязательны. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_ADMIN_EMAIL]: {
    title: `Некорректный email администратора`,
    message: () => `Email администратора некорректен. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.INVALID_ADMIN_PASSWORD]: {
    title: `Некорректный пароль администратора`,
    message: () => `Пароль администратора некорректен. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    title: `Email и пароль обязательны`,
    message: () => `Введите email и пароль, затем попробуйте еще раз.`,
  },
  [EAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    title: `Ошибка авторизации`,
    message: () => `Не удалось авторизоваться. Попробуйте еще раз.`,
  },
  [EAuthErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    title: `Администратор уже существует`,
    message: () => `Администратор уже существует. Войдите в систему.`,
  },
  [EAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    title: `Администратор не найден`,
    message: () => `Администратор не найден. Войдите в систему.`,
  },
  [EAuthErrorCodes.MAGIC_LINK_LOGIN_DISABLED]: {
    title: `Вход по коду отключен`,
    message: () => `Вход по коду отключен. Используйте пароль.`,
  },
  [EAuthErrorCodes.PASSWORD_LOGIN_DISABLED]: {
    title: `Вход по паролю отключен`,
    message: () => `Вход по паролю отключен. Используйте вход по коду.`,
  },
  [EAuthErrorCodes.ADMIN_USER_DEACTIVATED]: {
    title: `Администратор деактивирован`,
    message: () => `Аккаунт администратора деактивирован. Обратитесь к администратору.`,
  },
  [EAuthErrorCodes.RATE_LIMIT_EXCEEDED]: {
    title: `Слишком много запросов`,
    message: () => `Слишком много запросов. Попробуйте позже.`,
  },
};

// Error handler
export const authErrorHandler = (errorCode: EAuthErrorCodes, email?: string): TAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAuthErrorCodes.INSTANCE_NOT_CONFIGURED,
    EAuthErrorCodes.INVALID_EMAIL,
    EAuthErrorCodes.EMAIL_REQUIRED,
    EAuthErrorCodes.SIGNUP_DISABLED,
    EAuthErrorCodes.INVALID_PASSWORD,
    EAuthErrorCodes.SMTP_NOT_CONFIGURED,
    EAuthErrorCodes.USER_ALREADY_EXIST,
    EAuthErrorCodes.AUTHENTICATION_FAILED_SIGN_UP,
    EAuthErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP,
    EAuthErrorCodes.INVALID_EMAIL_SIGN_UP,
    EAuthErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP,
    EAuthErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED,
    EAuthErrorCodes.USER_DOES_NOT_EXIST,
    EAuthErrorCodes.AUTHENTICATION_FAILED_SIGN_IN,
    EAuthErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN,
    EAuthErrorCodes.INVALID_EMAIL_SIGN_IN,
    EAuthErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN,
    EAuthErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED,
    EAuthErrorCodes.INVALID_MAGIC_CODE_SIGN_IN,
    EAuthErrorCodes.INVALID_MAGIC_CODE_SIGN_UP,
    EAuthErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN,
    EAuthErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP,
    EAuthErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN,
    EAuthErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP,
    EAuthErrorCodes.OAUTH_NOT_CONFIGURED,
    EAuthErrorCodes.GOOGLE_NOT_CONFIGURED,
    EAuthErrorCodes.GITHUB_NOT_CONFIGURED,
    EAuthErrorCodes.GITLAB_NOT_CONFIGURED,
    EAuthErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR,
    EAuthErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR,
    EAuthErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR,
    EAuthErrorCodes.INVALID_PASSWORD_TOKEN,
    EAuthErrorCodes.EXPIRED_PASSWORD_TOKEN,
    EAuthErrorCodes.INCORRECT_OLD_PASSWORD,
    EAuthErrorCodes.INVALID_NEW_PASSWORD,
    EAuthErrorCodes.PASSWORD_ALREADY_SET,
    EAuthErrorCodes.ADMIN_ALREADY_EXIST,
    EAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAuthErrorCodes.INVALID_ADMIN_EMAIL,
    EAuthErrorCodes.INVALID_ADMIN_PASSWORD,
    EAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAuthErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAuthErrorCodes.USER_ACCOUNT_DEACTIVATED,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode]?.title || "Error",
      message: errorCodeMessages[errorCode]?.message(email) || "Something went wrong. Please try again.",
    };

  return undefined;
};
