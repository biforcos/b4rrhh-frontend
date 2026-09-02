import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyListItemModel } from '../models/company-list-item.model';
import { CompanyListComponent } from './company-list.component';

describe('CompanyListComponent', () => {
  let fixture: ComponentFixture<CompanyListComponent>;

  const companiesFixture: ReadonlyArray<CompanyListItemModel> = [
    {
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Empresa Uno',
      legalName: 'Empresa Uno SA',
      taxIdentifier: 'A12345678',
      countryCode: 'ESP',
      active: true,
      startDate: '2026-01-01',
      endDate: null,
    },
    {
      ruleSystemCode: 'ESP',
      companyCode: 'ES02',
      name: 'Empresa Dos',
      legalName: 'Compania Dos SL',
      taxIdentifier: null,
      countryCode: 'PRT',
      active: false,
      startDate: '2025-06-01',
      endDate: '2026-03-01',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyListComponent);
  });

  it('renders rich list items instead of table rows', () => {
    fixture.componentRef.setInput('companies', companiesFixture);
    fixture.componentRef.setInput('selectedKey', { ruleSystemCode: 'ESP', companyCode: 'ES01' });
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', null);
    fixture.detectChanges();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.master-list-panel__item'),
    ) as HTMLElement[];
    expect(items.length).toBe(2);
    expect(items[0]?.textContent ?? '').toContain('Empresa Uno');
    expect(items[0]?.textContent ?? '').toContain('Empresa Uno SA');
    expect(items[0]?.classList.contains('master-list-panel__item--selected')).toBe(true);
  });

  it('filters companies by search term', async () => {
    fixture.componentRef.setInput('companies', companiesFixture);
    fixture.componentRef.setInput('selectedKey', null);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', null);
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector(
      '#master-list-search',
    ) as HTMLInputElement;
    searchInput.value = 'dos';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.master-list-panel__item'),
    ) as HTMLElement[];
    expect(items.length).toBe(1);
    expect(items[0]?.textContent ?? '').toContain('Empresa Dos');
  });

  it('emits companySelected when selecting a company item', () => {
    const component = fixture.componentInstance;
    const emitSpy = vi.spyOn(component.companySelected, 'emit');

    fixture.componentRef.setInput('companies', companiesFixture);
    fixture.componentRef.setInput('selectedKey', null);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', null);
    fixture.detectChanges();

    const firstItem = fixture.nativeElement.querySelector(
      '.master-list-panel__item',
    ) as HTMLButtonElement;
    firstItem.click();

    expect(emitSpy).toHaveBeenCalledWith({ ruleSystemCode: 'ESP', companyCode: 'ES01' });
  });

  it('hides empty secondary metadata instead of rendering filler text', () => {
    fixture.componentRef.setInput('companies', companiesFixture);
    fixture.componentRef.setInput('selectedKey', null);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', null);
    fixture.detectChanges();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.master-list-panel__item'),
    ) as HTMLElement[];
    expect(items[1]?.textContent ?? '').not.toContain('Sin dato');
  });
});
