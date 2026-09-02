import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UiDateInputComponent } from './ui-date-input.component';

describe('UiDateInputComponent', () => {
  let fixture: ComponentFixture<UiDateInputComponent>;
  let component: UiDateInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiDateInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiDateInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits local yyyy-mm-dd when the input value changes', () => {
    const emittedValues: string[] = [];
    component.valueChanged.subscribe((value) => emittedValues.push(value));

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '2020-01-05';
    input.dispatchEvent(new Event('input'));

    expect(emittedValues).toEqual(['2020-01-05']);
  });

  it('sets min and max attributes on the native input', () => {
    fixture.componentRef.setInput('min', '2020-01-05');
    fixture.componentRef.setInput('max', '2020-01-31');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.min).toBe('2020-01-05');
    expect(input.max).toBe('2020-01-31');
  });
});
