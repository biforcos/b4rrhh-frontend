import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.includes('/dev/auth/token')) {
    return next(request);
  }

  if (!request.url.startsWith('/')) {
    return next(request);
  }

  const token = inject(AuthStore).getAccessToken();
  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
