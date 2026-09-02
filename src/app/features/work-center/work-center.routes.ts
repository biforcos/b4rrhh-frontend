import { Routes } from '@angular/router';

export const workCenterRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ui/work-center-page.component').then((m) => m.WorkCenterPageComponent),
  },
];
