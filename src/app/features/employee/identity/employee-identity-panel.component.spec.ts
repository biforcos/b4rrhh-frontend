import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { EmployeeIdentityPanelComponent } from './employee-identity-panel.component';
import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { EmployeeDetailStore } from '../data-access/employee-detail.store';

const KEY = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'EMP',
  employeeNumber: 'EMP-0001',
} as const;

function createFixture() {
  TestBed.configureTestingModule({
    imports: [EmployeeIdentityPanelComponent],
    providers: [
      provideRouter([]),
      {
        provide: EmployeePhotoService,
        useValue: { deletePhoto: vi.fn().mockReturnValue(of(undefined)) },
      },
      {
        provide: EmployeeDetailStore,
        useValue: {
          refreshEmployeeDetailByBusinessKey: vi.fn(),
          selectedEmployeeDetail: signal(null),
          loadingDetail: signal(false),
          mutating: signal(false),
          mutationError: signal(null),
          mutationSuccess: signal(null),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmployeeIdentityPanelComponent);
  fixture.componentRef.setInput('employeeKey', KEY);
  return fixture;
}

describe('EmployeeIdentityPanelComponent', () => {
  describe('isOverview', () => {
    it('defaults to false (panel expanded by default)', () => {
      const fixture = createFixture();
      const component = fixture.componentInstance as unknown as {
        isOverview: () => boolean;
      };
      expect(component.isOverview()).toBe(false);
    });

    it('returns true when activeSection is "overview"', () => {
      const fixture = createFixture();
      fixture.componentRef.setInput('activeSection', 'overview');
      const component = fixture.componentInstance as unknown as {
        isOverview: () => boolean;
      };
      expect(component.isOverview()).toBe(true);
    });

    it('returns false when activeSection is "contact"', () => {
      const fixture = createFixture();
      fixture.componentRef.setInput('activeSection', 'contact');
      const component = fixture.componentInstance as unknown as {
        isOverview: () => boolean;
      };
      expect(component.isOverview()).toBe(false);
    });
  });

  describe('copyMatricula', () => {
    it('writes employeeNumber to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      const fixture = createFixture();
      const component = fixture.componentInstance as unknown as {
        copyMatricula: () => void;
      };
      component.copyMatricula();
      await Promise.resolve();

      expect(writeText).toHaveBeenCalledWith('EMP-0001');
      vi.unstubAllGlobals();
    });
  });

  describe('navItems', () => {
    it('each nav item has an icon property', () => {
      const fixture = createFixture();
      const component = fixture.componentInstance as unknown as {
        navItems: () => ReadonlyArray<{ section: string; icon: string }>;
      };
      const items = component.navItems();
      expect(items.length).toBe(5);
      items.forEach((item) => {
        expect(item.icon).toBeTruthy();
        expect(item.icon).toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });
  });
});
