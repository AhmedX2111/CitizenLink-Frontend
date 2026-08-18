/*
 * VolumeReportComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - should create
 *   - ngOnDestroy destroys the Chart.js instance so listeners/canvas refs are
 *     released (M-24); safe to call when no chart exists
 *
 * SKIPPED (with reason):
 *   - Full chart rendering (ngOnInit/ngAfterViewInit with Chart.js): needs a real
 *     canvas 2D context that jsdom does not provide; exercised in e2e.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { VolumeReportComponent } from './volume-report';
import { ReportService } from '../../../core/services/report.service';
import { TranslocoService } from '@jsverse/transloco';

describe('VolumeReportComponent', () => {
  let fixture: ComponentFixture<VolumeReportComponent>;
  let component: VolumeReportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VolumeReportComponent],
      providers: [
        {
          provide: ReportService,
          useValue: {
            getVolumeReport: vi.fn(),
            exportCsv: vi.fn()
          }
        },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: new BehaviorSubject('en'),
            _loadDependencies: () => of(undefined),
            _translate: (key: string) => key
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VolumeReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('destroys the chart instance on destroy so listeners are released (M-24)', () => {
    const destroy = vi.fn();
    (component as unknown as { chartInstance: { destroy: ReturnType<typeof vi.fn> } }).chartInstance = { destroy };

    component.ngOnDestroy();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not throw on destroy when no chart has been created', () => {
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
