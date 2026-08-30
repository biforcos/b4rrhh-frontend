import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { EmployeeShellPageComponent } from './employee-shell-page.component';
import { EmployeeDirectoryStore } from '../../data-access/employee-directory.store';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeeContactStore } from '../../data-access/employee-contact.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';

function buildSnapshot(paths: string[], queryParams: Record<string, string | null> = {}) {
  let current: any = {
    url: [],
    paramMap: new Map(),
    queryParamMap: {
      get: (key: string) => queryParams[key] ?? null,
    },
    firstChild: null,
  };

  const root = current;

  for (const path of paths) {
    const child = {
      url: [{ path }],
      paramMap: {
        get: (key: string) => {
          if (key === 'ruleSystemCode') return 'ESP';
          if (key === 'employeeTypeCode') return 'EMP';
          if (key === 'employeeNumber') return 'E001';
          return null;
        },
      },
      queryParamMap: {
        get: (key: string) => queryParams[key] ?? null,
      },
      firstChild: null,
    };

    current.firstChild = child;
    current = child;
  }

  return root;
}

describe('EmployeeShellPageComponent', () => {
  let fixture: ComponentFixture<EmployeeShellPageComponent>;
  const routerEvents = new Subject<NavigationEnd>();
  const routeMock: { snapshot: any } = {
    snapshot: buildSnapshot(['personas', 'empleados', 'ESP', 'EMP', 'E001', 'contact']),
  };
  const routerMock = {
    events: routerEvents.asObservable(),
    navigate: vi.fn(() => Promise.resolve(true)),
  };
  const directoryStoreMock = {
    employees: signal([]).asReadonly(),
    total: signal<number | null>(null).asReadonly(),
    query: signal('').asReadonly(),
    status: signal<string | null>(null).asReadonly(),
    page: signal(0).asReadonly(),
    size: signal(50).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal(null).asReadonly(),
    setQuery: vi.fn(),
    setStatus: vi.fn(),
    setPage: vi.fn(),
    refreshDirectory: vi.fn(),
  };
  const detailStoreMock = {
    selectedEmployeeDetail: signal(null).asReadonly(),
    loadingDetail: signal(false).asReadonly(),
    detailError: signal(null).asReadonly(),
    mutating: signal(false).asReadonly(),
    mutationError: signal(null).asReadonly(),
    mutationSuccess: signal(null).asReadonly(),
    loadEmployeeDetailByBusinessKey: vi.fn(),
    refreshEmployeeDetailByBusinessKey: vi.fn(),
    clearMutationFeedback: vi.fn(),
    updateEmployeeCoreIdentity: vi.fn(),
  };
  const contactStoreMock = {
    contacts: signal([]).asReadonly(),
    loadContactsByBusinessKey: vi.fn(),
  };
  const presenceStoreMock = {
    presences: signal([]).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal(null).asReadonly(),
    loadPresencesByBusinessKey: vi.fn(),
    refreshPresencesByBusinessKey: vi.fn(),
  };
  const workCenterStoreMock = {
    workCenters: signal([]).asReadonly(),
    loadWorkCenters: vi.fn(),
    refreshWorkCenters: vi.fn(),
  };
  const journeyStoreMock = {
    journey: signal(null).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal(null).asReadonly(),
    loadJourneyByBusinessKey: vi.fn(),
    refreshJourneyByBusinessKey: vi.fn(),
  };
  const globalMessageServiceMock = {
    messages: signal([]).asReadonly(),
    summary: signal({ errorCount: 0, warningCount: 0, infoCount: 0, successCount: 0 }).asReadonly(),
    expanded: signal(false).asReadonly(),
    reset: vi.fn(),
    setSourceMessages: vi.fn(),
    clearSourceMessages: vi.fn(),
    success: vi.fn(),
    expand: vi.fn(),
    collapse: vi.fn(),
    toggleExpanded: vi.fn(),
    dismissTransientMessages: vi.fn(),
  };

  beforeEach(async () => {
    // Los mocks son const de fichero: sin esto, el historial de llamadas se
    // arrastra de un test al siguiente y un test negativo ve las llamadas del
    // anterior. Limpia el historial, no las implementaciones.
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [EmployeeShellPageComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: EmployeeDirectoryStore, useValue: directoryStoreMock },
        { provide: EmployeeDetailStore, useValue: detailStoreMock },
        { provide: EmployeeContactStore, useValue: contactStoreMock },
        { provide: EmployeePresenceStore, useValue: presenceStoreMock },
        { provide: EmployeeWorkCenterStore, useValue: workCenterStoreMock },
        { provide: EmployeeJourneyStore, useValue: journeyStoreMock },
        { provide: GlobalMessageService, useValue: globalMessageServiceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(EmployeeShellPageComponent, {
        set: {
          template: '',
          imports: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EmployeeShellPageComponent);
    fixture.detectChanges();
  });

  it('refreshes the employee directory when returning from a rehire', () => {
    routeMock.snapshot = buildSnapshot(['personas', 'empleados', 'ESP', 'EMP', 'E001', 'overview'], { refresh: 'rehire' });

    routerEvents.next(new NavigationEnd(1, '/personas/empleados/ESP/EMP/E001/overview?refresh=rehire', '/personas/empleados/ESP/EMP/E001/overview?refresh=rehire'));

    expect(directoryStoreMock.refreshDirectory).toHaveBeenCalled();
  });

  it('does not refresh the directory when there is no rehire marker', () => {
    routeMock.snapshot = buildSnapshot(['personas', 'empleados', 'ESP', 'EMP', 'E001', 'overview']);

    routerEvents.next(new NavigationEnd(2, '/personas/empleados/ESP/EMP/E001/overview', '/personas/empleados/ESP/EMP/E001/overview'));

    expect(directoryStoreMock.refreshDirectory).not.toHaveBeenCalled();
  });
});
