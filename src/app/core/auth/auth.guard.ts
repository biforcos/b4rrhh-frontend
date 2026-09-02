import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  if (authStore.getAccessToken()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url },
  });
};
