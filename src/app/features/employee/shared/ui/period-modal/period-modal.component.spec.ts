import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PeriodModalComponent } from './period-modal.component';

describe('PeriodModalComponent', () => {
  let fix: ComponentFixture<PeriodModalComponent>;
  let c: PeriodModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeriodModalComponent, NoopAnimationsModule],
    }).compileComponents();
    fix = TestBed.createComponent(PeriodModalComponent);
    c = fix.componentInstance;
  });

  it('creates', () => expect(c).toBeTruthy());

  it('emits submitted when enabled and not saving', () => {
    fix.componentRef.setInput('submitEnabled', true);
    fix.componentRef.setInput('saving', false);
    const spy = vi.fn();
    c.submitted.subscribe(spy);
    c.onSubmit();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit submitted when saving', () => {
    fix.componentRef.setInput('saving', true);
    fix.componentRef.setInput('submitEnabled', true);
    const spy = vi.fn();
    c.submitted.subscribe(spy);
    c.onSubmit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits cancelled and visibleChange(false) on cancel', () => {
    const cancelSpy = vi.fn();
    const visibleSpy = vi.fn();
    c.cancelled.subscribe(cancelSpy);
    c.visibleChange.subscribe(visibleSpy);
    c.onCancel();
    expect(cancelSpy).toHaveBeenCalled();
    expect(visibleSpy).toHaveBeenCalledWith(false);
  });

  it('emits closeActionClicked', () => {
    const spy = vi.fn();
    c.closeActionClicked.subscribe(spy);
    c.onCloseAction();
    expect(spy).toHaveBeenCalled();
  });

  it('takes the note as one line or as several', () => {
    const lines = () => (c as unknown as { noteLines: () => ReadonlyArray<string> }).noteLines();

    expect(lines()).toEqual([]);

    fix.componentRef.setInput('note', 'Una sola frase.');
    expect(lines()).toEqual(['Una sola frase.']);

    fix.componentRef.setInput('note', ['Se cerrará el 15.', 'Quedaría un hueco.']);
    expect(lines()).toEqual(['Se cerrará el 15.', 'Quedaría un hueco.']);
  });
});
